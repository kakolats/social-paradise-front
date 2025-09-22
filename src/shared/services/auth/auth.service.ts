import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginResponse } from '../../models/loginResponse';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import { AuthUtils } from '../../../app/core/auth/auth.utils';
import { UserService } from '../user/user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
    private tokenKey = "auth-token"
    private apiUrl = environment.apiUrl + "/auth"
    private _authenticated = false

  constructor(
      private http: HttpClient,
      private router: Router,
      private _userService: UserService
  ) { }


    setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token)
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey)
    }

    removeTokens(): void {
        localStorage.removeItem(this.tokenKey)
    }

    login(credentials: { email: string; password: string }): Observable<LoginResponse> {
        if (this._authenticated) {
            return throwError(() => new Error("User is already logged in."))
        }

        return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
            tap((response) => {
                this.setToken(response.data.access_token)
                this._authenticated = true
                this._userService.user = { email : credentials.email }
            }),
            catchError((error) => {
                console.error("Login error:", error)
                return throwError(() => new Error("Failed to log in: " + (error.error.message || error.statusText)))
            }),
        )
    }

    logout(): Observable<any> {
        this.clearAuthData()
        return of(true)

    }

    private clearAuthData(): void {
        this.removeTokens()
        this._authenticated = false
    }

    checkToken(): boolean {
        const token = this.getToken()
        if (token && !AuthUtils.isTokenExpired(token)) {
            return true
        }
        return false
    }

    check(): Observable<boolean> {
        // Check if the user is logged in
        if (this._authenticated) {
            return of(true)
        }

        // Check the access token availability
        const token = this.getToken()
        if (!token) {
            return of(false)
        }

        // Check the access token expire date
        if (AuthUtils.isTokenExpired(token)) {
            return of(false)
        }

        // If the access token exists and it didn't expire, sign in using it
        this._authenticated = true
        return of(true)
    }
}
