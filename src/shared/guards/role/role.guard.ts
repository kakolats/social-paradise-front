import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { Observable, of } from 'rxjs';

export function RoleGuard(authService:AuthService,router:Router) : CanActivateFn {
    return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> => {
        const requiredPermissions = route.data["roles"] as string[]

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return of(true)
        }

        authService.getUserRole().then(
            (role:string|null) => {
                if(role === null) {
                    router.navigate(['/unauthorized'])
                    return of (false)
                }
                if (requiredPermissions.includes(role)) {
                    return of (true)
                } else {
                    router.navigate(['/unauthorized'])
                    return of (false)
                }
            }
        )
    }
}
