import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiUrl;
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
    error: any;
}

// Ce que renvoie concrètement l’API dans "data"
export interface GuestValidationData {
    slug: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    age?: number;
    isMainGuest?: boolean;
    state?: boolean;
}
@Injectable({
  providedIn: 'root'
})
export class GuestService {
    private http = inject(HttpClient);
    private base = `${API_BASE_URL}/guest`;

    constructor() { }

    validateGuestBySlug(slug: string) {
        return this.http.post<ApiResponse<GuestValidationData>>(
            `${this.base}/${slug}`,
            {},
        );
    }
}
