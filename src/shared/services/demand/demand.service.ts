import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Demand, DemandStatus, DemandType } from '../../models/demand';
import { Guest as FrontGuest } from '../../models/guest';
import { Payment as FrontPayment } from '../../models/payment';
import { Event as FrontEvent } from '../../models/event';
import { TableItem, Table } from '../../models/table';
import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiUrl;

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}

export interface CreateGuestPayload {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    age: number;
    isMainGuest?: boolean;
}

interface TableSelection {
    tableId: number;
    quantity: number;
}

export interface CreateDemandPayload {
    eventSlug: string;
    guests: CreateGuestPayload[];
    tableSelections?: TableSelection[];
}

/** Type de liste renvoyé par GET /demand/by-event/:slug (DemandWithMainGuestDto) */
export interface DemandSummary {
    id: number;
    slug: string;
    status: DemandStatus;
    type: DemandType;
    numberOfGuests: number;
    createdAt: Date;
    guests: FrontGuest[];
    mainGuest: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        age: number;
    };
}

/** Stat d'un statut donné */
export interface DemandStatsEntry {
    status: DemandStatus;
    totalDemands: number;
    totalParticipants: number;
}

@Injectable({ providedIn: 'root' })
export class DemandService {
    private http = inject(HttpClient);
    private base = `${API_BASE_URL}/demand`;

    // ----------------- CREATE
    create(payload: CreateDemandPayload): Observable<Demand> {
        return this.http.post<ApiResponse<any>>(this.base, payload).pipe(
            map(res => this.parseDemandDetail(res.data))
        );
    }

    // ----------------- READ (DETAIL)
    /** Detail complet (with guests[], event, etc.) */
    getBySlug(slug: string): Observable<Demand> {
        return this.http.get<ApiResponse<any>>(`${this.base}/${slug}`).pipe(
            map(res => this.parseDemandDetail(res.data))
        );
    }

    // ----------------- READ (LISTE / RÉSUMÉ)
    /** Liste sans filtres (pas de query params) — renvoie DemandSummary[] */
    listByEventSlug(eventSlug: string): Observable<DemandSummary[]> {
        return this.http.get<ApiResponse<any[]>>(`${this.base}/by-event/${eventSlug}`).pipe(
            map(res => (res.data ?? []).map(d => this.parseDemandSummary(d)))
        );
    }

    /** Variante avec filtres si nécessaire (status/type) — renvoie DemandSummary[] */
    listByEventSlugFiltered(
        eventSlug: string,
        filter: { status?: DemandStatus; type?: DemandType }
    ): Observable<DemandSummary[]> {
        let params = new HttpParams();
        if (filter?.status) params = params.set('status', filter.status);
        if (filter?.type)   params = params.set('type', filter.type);

        return this.http.get<ApiResponse<any[]>>(
            `${this.base}/by-event/${eventSlug}`,
            { params }
        ).pipe(
            map(res => (res.data ?? []).map(d => this.parseDemandSummary(d)))
        );
    }

    // ----------------- UPDATE
    updateStatus(slug: string, status: DemandStatus): Observable<void> {
        return this.http.patch<ApiResponse<unknown>>(
            `${this.base}/${slug}/status`,
            { status }
        ).pipe(
            map(() => void 0)
        );
    }

    // ----------------- STATS
    /**
     * Récupère les stats par statut pour un event donné.
     *
     * Backend renvoie seulement les statuts présents, ex:
     * [
     *   { "status":"VALIDEE","totalDemands":1,"totalParticipants":1 },
     *   { "status":"REFUSEE","totalDemands":1,"totalParticipants":1 },
     *   { "status":"PAYEE","totalDemands":1,"totalParticipants":3 }
     * ]
     *
     * On renvoie toujours un objet contenant toutes les clés DemandStatus,
     * même si certaines sont à 0.
     */
    getStatsByEventSlug(eventSlug: string): Observable<Record<DemandStatus, DemandStatsEntry>> {
        return this.http
            .get<ApiResponse<any[]>>(`${this.base}/stats/${eventSlug}`)
            .pipe(
                map(res => {
                    const rawList = Array.isArray(res.data) ? res.data : [];

                    // point de départ : tout à 0
                    const allStatuses: DemandStatus[] = [
                        DemandStatus.SOUMISE,
                        DemandStatus.VALIDEE,
                        DemandStatus.REFUSEE,
                        DemandStatus.PAIEMENT_NOTIFIE,
                        DemandStatus.PAYEE,
                    ];

                    const statsMap: Record<DemandStatus, DemandStatsEntry> = {} as any;

                    for (const st of allStatuses) {
                        statsMap[st] = {
                            status: st,
                            totalDemands: 0,
                            totalParticipants: 0,
                        };
                    }

                    // injecter les données réelles reçues
                    for (const row of rawList) {
                        const status = row.status as DemandStatus;
                        if (!status) continue;
                        if (!statsMap[status]) {
                            // si jamais le backend renvoie un statut inconnu du front,
                            // on l'ignore plutôt que de crasher
                            continue;
                        }
                        statsMap[status] = {
                            status,
                            totalDemands: row.totalDemands ?? 0,
                            totalParticipants: row.totalParticipants ?? 0,
                        };
                    }

                    return statsMap;
                })
            );
    }

    // ================= PARSERS =================

    /** Parser pour le DÉTAIL (payload de findOneBySlug) */
    private parseDemandDetail(json: any): Demand {
        return {
            id: json.id,
            date: json.createdAt
                ? new Date(json.createdAt)
                : (undefined as unknown as Date),
            slug: json.slug,
            demandStatus: json.status as DemandStatus,
            type: json.type as DemandType,
            payment: json.payment,
            guests: Array.isArray(json.guests)
                ? json.guests.map((g: any) => this.parseGuest(g))
                : [],
            tableItems: Array.isArray(json.tableItems)
                ? json.tableItems.map((t: any) => this.parseTableItem(t))
                : [],
            event: json.event ? this.parseEvent(json.event) : undefined,
            eventSlug: json.event?.slug,
        };
    }

    /** Parser pour la LISTE (DemandWithMainGuestDto) */
    private parseDemandSummary(j: any): DemandSummary {
        return {
            id: j.id,
            slug: j.slug,
            status: j.status as DemandStatus,
            type: j.type as DemandType,
            numberOfGuests: j.numberOfGuests ?? 1,
            createdAt: j.createdAt
                ? new Date(j.createdAt)
                : (undefined as unknown as Date),
            guests: j.guests,
            mainGuest: {
                firstName: j.mainGuest?.firstName,
                lastName: j.mainGuest?.lastName,
                email: j.mainGuest?.email,
                phoneNumber: j.mainGuest?.phoneNumber,
                age: j.mainGuest?.age,
            }
        };
    }

    private parseGuest(j: any): FrontGuest {
        return {
            id: String(j.id),
            firstName: j.firstName,
            lastName: j.lastName,
            email: j.email,
            phoneNumber: j.phoneNumber,
            age: j.age,
            // slug: j.slug, // si interface front Guest.slug devient string
            state: !!j.state,
            isMainGuest: !!j.isMainGuest,
        };
    }

    private parsePayment(j: any): FrontPayment {
        return {
            id: j.id,
            amount: j.amount,
            date: j.date ? new Date(j.date) : undefined,
            phoneNumber: j.phoneNumber,
            paymentCanal: j.paymentCanal,
        };
    }

    private parseEvent(j: any): FrontEvent {
        return {
            id: j.id,
            name: j.name,
            date: j.date
                ? new Date(j.date)
                : (undefined as unknown as Date),
            slug: j.slug,
            prices: Array.isArray(j.prices)
                ? j.prices.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    amount: p.amount,
                    startDate: new Date(p.startDate),
                    endDate: new Date(p.endDate),
                }))
                : [],
        };
    }

    private parseTableItem(j: any): TableItem {
        return {
            id: j.id ?? 0,
            table: this.parseTable(j.table),
            quantity: j.quantity ?? 0,
        };
    }

    private parseTable(j: any): Table {
        return {
            id: j.id,
            name: j.name ?? '',
            amount: typeof j.amount === 'string' ? parseFloat(j.amount) : (j.amount ?? 0),
            capacity: j.capacity ?? 0,
        };
    }
}
