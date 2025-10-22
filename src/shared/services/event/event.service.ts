import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Event } from '../../models/event';
import { Price } from '../../models/price';
import { map, Observable } from 'rxjs';

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

    private serializeEvent(e: Partial<Event>): any {
        return {
            ...e,
            ...(e.date ? { date: this.toDateOnly(e.date) } : {}),
            prices: e.prices?.map(p => ({
                id: p.id,
                name: p.name,
                amount: p.amount,
                startDate: this.toDateOnly(p.startDate),
                endDate: this.toDateOnly(p.endDate),
            })),
        };
    }

    private parseEvent(json: any): Event {
        return {
            id: json.id,
            name: json.name,
            slug: json.slug,
            date: json.date ? new Date(json.date) : undefined as unknown as Date,
            prices: Array.isArray(json.prices)
                ? json.prices.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    amount: p.amount,
                    startDate: new Date(p.startDate),
                    endDate: new Date(p.endDate),
                } as Price))
                : [],
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

    // -------- Helpers métier
    getActivePrice(e: Event, at: Date = new Date()): Price | null {
        if (!e?.prices?.length) return null;
        const t = new Date(this.toDateOnly(at));
        return (
            e.prices.find(p => {
                const from = new Date(this.toDateOnly(p.startDate));
                const to = new Date(this.toDateOnly(p.endDate));
                return t >= from && t <= to;
            }) ?? null
        );
    }
}
