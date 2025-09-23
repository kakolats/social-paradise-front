import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiUrl

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}

export interface PaymentNotifyPayload {
    demandSlug: string;
    amount: number;
    phoneNumber: string;
    paymentCanal: 'WAVE' | 'ORANGE_MONEY';
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
    private http = inject(HttpClient);

    notify(payload: PaymentNotifyPayload): Observable<void> {
        // ← ajuste l'endpoint si nécessaire
        return this.http.post<ApiResponse<unknown>>(`${API_BASE_URL}/payment/notify`, payload)
            .pipe(map(() => void 0));
    }
}
