import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { catchError, map, Observable, of } from 'rxjs';

export function AuthGuard(authService: AuthService, router: Router): CanActivateFn {
    return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> => {
        const redirectUrl = state.url === "/sign-out" ? "/" : state.url

        return authService.check().pipe(
            map((authenticated) => {
                if (!authenticated) {
                    router.navigate(["sign-in"], { queryParams: { redirectURL: redirectUrl } })
                    return false
                }
                return true
            }),
            catchError((err) => {
                console.error("Error checking authentication", err)
                router.navigate(["sign-in"], { queryParams: { redirectURL: redirectUrl } })
                return of(false)
            }),
        )
    }
}
