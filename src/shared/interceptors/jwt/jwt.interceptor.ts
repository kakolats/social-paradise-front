import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
} from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';

export const jwtInterceptor = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
    const authService = inject(AuthService)
    const token = authService.getToken()

    // Clone the request and add the Authorization header if the token exists
    let newReq = req
    if (token) {
        newReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
            },
        })
    }

    return next(newReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                authService.logout()
                return throwError(() => error)

            }
            return throwError(() => error)
        })
    )
}
