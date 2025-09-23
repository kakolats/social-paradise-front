import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { Demand, DemandStatus, DemandType } from '../../models/demand';
import { Guest as FrontGuest } from '../../models/guest';
import { Payment as FrontPayment } from '../../models/payment';
import { Event as FrontEvent } from '../../models/event';
import { environment } from '../../../environments/environment';

// ⚙️ À remplacer par environment.apiBaseUrl si tu préfères
const API_BASE_URL = environment.apiUrl

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
    isMainGuest?: boolean; // ⚠️ exactement un invité principal au niveau de la demande
}
export interface CreateDemandPayload {
    eventSlug: string;            // UUID de l'événement côté API
    guests: CreateGuestPayload[]; // >= 1
}

/** Type de liste renvoyé par GET /demand/by-event/:slug (DemandWithMainGuestDto) */
export interface DemandSummary {
    id: number;
    slug: string;
    status: DemandStatus;
    type: DemandType;
    numberOfGuests: number;
    createdAt: Date;
    mainGuest: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        age: number;
    };
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

        return this.http.get<ApiResponse<any[]>>(`${this.base}/by-event/${eventSlug}`, { params }).pipe(
            map(res => (res.data ?? []).map(d => this.parseDemandSummary(d)))
        );
    }

    // ----------------- UPDATE
    updateStatus(slug: string, status: DemandStatus): Observable<void> {
        return this.http.patch<ApiResponse<unknown>>(`${this.base}/${slug}/status`, { status }).pipe(
            map(() => void 0)
        );
    }

    // ================= PARSERS =================

    /** Parser pour le DÉTAIL (payload de findOneBySlug) */
    private parseDemandDetail(json: any): Demand {
        return {
            id: json.id,
            date: json.createdAt ? new Date(json.createdAt) : (undefined as unknown as Date),
            slug: json.slug,
            demandStatus: json.status as DemandStatus,
            type: json.type as DemandType,
            payments: Array.isArray(json.payments) ? json.payments.map((p: any) => this.parsePayment(p)) : [],
            guests: Array.isArray(json.guests) ? json.guests.map((g: any) => this.parseGuest(g)) : [],
            event: json.event ? this.parseEvent(json.event) : undefined,
            eventSlug: json.event?.slug, // pratique pour des actions ultérieures
        };
    }

    /** Parser pour la LISTE (DemandWithMainGuestDto) */
    private parseDemandSummary(j: any): DemandSummary {
        // Le backend garantit la présence d'un mainGuest (sinon lève une erreur)
        return {
            id: j.id,
            slug: j.slug,
            status: j.status as DemandStatus,
            type: j.type as DemandType,
            numberOfGuests: j.numberOfGuests ?? 1,
            createdAt: j.createdAt ? new Date(j.createdAt) : (undefined as unknown as Date),
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
        // NOTE : l’API renvoie slug=UUID (string). Si ton interface Front `Guest.slug` est `number?`,
        // ne l’hydrate pas pour rester strict. Si tu la passes en `string?`, décommente la ligne.
        return {
            id: String(j.id),
            firstName: j.firstName,
            lastName: j.lastName,
            email: j.email,
            phoneNumber: j.phoneNumber,
            age: j.age,
            // slug: j.slug, // ← active si Guest.slug est string?
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
            paymentCanal: j.paymentCanal, // "WAVE" | "ORANGE_MONEY" | "CASH"
        };
    }

    private parseEvent(j: any): FrontEvent {
        return {
            id: j.id,
            name: j.name,
            date: j.date ? new Date(j.date) : (undefined as unknown as Date),
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
}
