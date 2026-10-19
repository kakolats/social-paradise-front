import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Event } from '../../models/event';
import { Price } from '../../models/price';
import { map, Observable } from 'rxjs';
import { Table } from 'shared/models/table';
import { EventAccounting } from 'shared/models/event-accounting';

const API_BASE_URL = environment.apiUrl;
interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {

    private http = inject(HttpClient);
    private base = `${API_BASE_URL}/event`;

    // -------- Utils (dates <-> JSON "YYYY-MM-DD")
    private toDateOnly(d: Date | string): string {
        const date = typeof d === 'string' ? new Date(d) : d;
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Parse une date "YYYY-MM-DD" en Date **à minuit local** (évite les décalages UTC de `new Date('YYYY-MM-DD')`).
     * Si une Date est fournie, elle est normalisée en "date-only" locale (minuit).
     */
    private parseDateOnlyLocal(d?: Date | string | null): Date | undefined {
        if (!d) return undefined;
        if (d instanceof Date) {
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
        if (!m) {
            const fallback = new Date(d);
            if (Number.isNaN(fallback.getTime())) return undefined;
            return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
        }
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const day = Number(m[3]);
        return new Date(y, mo, day);
    }

    private serializeEvent(evt: Partial<Event>): any {
        const body: any = {
            name: evt.name,
            date: evt.date instanceof Date ? this.toDateOnly(evt.date) : evt.date,
            location: evt.location,
            description: evt.description,
            coverImage: evt.coverImage,
            isActive: evt.isActive,
            paymentMethods: evt.paymentMethods,
            allowCash: evt.allowCash,
            cashPlacesConfig: evt.cashPlacesConfig,
            initialBalance: evt.initialBalance,
        };

        // IMPORTANT: ne pas envoyer [] par défaut sur update partiel,
        // sinon le backend remplace et "efface" les listes.
        if (Array.isArray(evt.prices)) {
            body.prices = evt.prices.map(p => ({
                id: p.id,
                name: p.name,
                amount: p.amount,
                startDate: p.startDate instanceof Date ? this.toDateOnly(p.startDate) : p.startDate,
                endDate: p.endDate instanceof Date ? this.toDateOnly(p.endDate) : p.endDate,
            }));
        }
        if (Array.isArray(evt.tables)) {
            body.tables = evt.tables.map(t => ({
                id: t.id,
                name: t.name,
                amount: t.amount,
                capacity: t.capacity,
            }));
        }

        return body;
    }

    private parseEvent(raw: any): Event {
        return {
            id: raw.id,
            name: raw.name,
            date: this.parseDateOnlyLocal(raw.date),
            slug: raw.slug,
            location: raw.location,
            description: raw.description,
            coverImage: raw.coverImage,
            isActive: raw.isActive ?? true,
            prices: this.sortPrices((raw.prices ?? []).map((p: any): Price => ({
                id: p.id,
                name: p.name,
                amount: p.amount,
                startDate: this.parseDateOnlyLocal(p.startDate),
                endDate: this.parseDateOnlyLocal(p.endDate),
            }))),
            tables: (raw.tables ?? []).map((t: any): Table => ({
                id: t.id,
                name: t.name,
                amount: t.amount,
                capacity: t.capacity,
            })),
            paymentMethods: raw.paymentMethods ?? undefined,
            allowCash: raw.allowCash ?? true,
            cashPlacesConfig: raw.cashPlacesConfig ?? undefined,
            initialBalance: raw.initialBalance ?? 0,
        };
    }

    // -------- CRUD adaptés au format enveloppé
    create(payload: Omit<Event, 'id' | 'slug'>): Observable<Event> {
        const body = this.serializeEvent(payload);
        return this.http.post<ApiResponse<any>>(this.base, body).pipe(
            map(res => this.parseEvent(res.data))
        );
    }

    list(): Observable<Event[]> {
        return this.http.get<ApiResponse<any[]>>(this.base).pipe(
            map(res => res.data.map(e => this.parseEvent(e)))
        );
    }

    getById(id: number): Observable<Event> {
        return this.http.get<ApiResponse<any>>(`${this.base}/${id}`).pipe(
            map(res => this.parseEvent(res.data))
        );
    }

    getBySlug(slug: string): Observable<Event> {
        return this.http.get<ApiResponse<any>>(`${this.base}/${slug}`).pipe(
            map(res => this.parseEvent(res.data))
        );
    }

    update(slug: string, patch: Partial<Event>): Observable<Event> {
        const body = this.serializeEvent(patch);
        return this.http.put<ApiResponse<any>>(`${this.base}/${slug}`, body).pipe(
            map(res => this.parseEvent(res.data))
        );
    }

    remove(id: number): Observable<void> {
        return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
            map(() => void 0)
        );
    }

    getAccounting(slug: string): Observable<EventAccounting> {
        return this.http
            .get<ApiResponse<any>>(`${this.base}/${slug}/accounting`)
            .pipe(
                map(res => {
                    const j = res.data;
                    return {
                        initialBalance: j.initialBalance ?? 0,
                        totalExpenses: j.totalExpenses ?? 0,
                        totalIncomesManual: j.totalIncomesManual ?? 0,
                        totalPaidFromDemands: j.totalPaidFromDemands ?? 0,
                        currentBalance: j.currentBalance ?? 0,
                        ticketsByPrice: (j.ticketsByPrice ?? []).map((t: any) => ({
                            priceId: t.priceId,
                            name: t.name ?? null,
                            amount: t.amount ?? 0,
                            startDate: this.parseDateOnlyLocal(t.startDate),
                            endDate: this.parseDateOnlyLocal(t.endDate),
                            ticketsSold: t.ticketsSold ?? 0,
                        })),
                        expenses: (j.expenses ?? []).map((e: any) => ({
                            id: e.id,
                            label: e.label,
                            amount: e.amount,
                            createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
                            note: e.note,
                        })),
                        incomes: (j.incomes ?? []).map((i: any) => ({
                            id: i.id,
                            label: i.label,
                            amount: i.amount,
                            createdAt: i.createdAt ? new Date(i.createdAt) : undefined,
                            note: i.note,
                        })),
                    } as EventAccounting;
                })
            );
    }

    addExpense(slug: string, payload: { label: string; amount: number; note?: string }): Observable<void> {
        return this.http
            .post<ApiResponse<any>>(`${this.base}/${slug}/expenses`, payload)
            .pipe(map(() => void 0));
    }

    addIncome(slug: string, payload: { label: string; amount: number; note?: string }): Observable<void> {
        return this.http
            .post<ApiResponse<any>>(`${this.base}/${slug}/incomes`, payload)
            .pipe(map(() => void 0));
    }

    deleteExpense(slug: string, id: number): Observable<void> {
        return this.http
            .delete<ApiResponse<any>>(`${this.base}/${slug}/expenses/${id}`)
            .pipe(map(() => void 0));
    }

    deleteIncome(slug: string, id: number): Observable<void> {
        return this.http
            .delete<ApiResponse<any>>(`${this.base}/${slug}/incomes/${id}`)
            .pipe(map(() => void 0));
    }

    // -------- Helpers métier
    getActivePrice(e: Event, at: Date = new Date()): Price | null {
        if (!e?.prices?.length) return null;
        const t = this.parseDateOnlyLocal(at);
        if (!t) return null;
        return (
            e.prices.find(p => {
                const from = this.parseDateOnlyLocal(p.startDate);
                const to = this.parseDateOnlyLocal(p.endDate);
                if (!from || !to) return false;
                return t >= from && t <= to;
            }) ?? null
        );
    }

    private sortPrices(prices: Price[]): Price[] {
        return [...prices].sort((a, b) => {
            const start = a.startDate.getTime() - b.startDate.getTime();
            if (start !== 0) return start;
            const end = a.endDate.getTime() - b.endDate.getTime();
            if (end !== 0) return end;
            return Number(a.amount) - Number(b.amount) || (a.id ?? 0) - (b.id ?? 0);
        });
    }
}
