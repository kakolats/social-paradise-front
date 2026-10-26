import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { catchError, map, of } from 'rxjs';

export const AuthGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService)
    const router = inject(Router)
    const redirectUrl = state.url === "/sign-out" ? "/" : state.url
    const signIn = router.createUrlTree(["sign-in"], { queryParams: { redirectURL: redirectUrl } })

    return authService.check().pipe(
        map((authenticated) => authenticated ? true : signIn),
        catchError((err) => {
            console.error("Error checking authentication", err)
            return of(signIn)
        }),
    )
}
