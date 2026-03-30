import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from 'shared/services/auth/auth.service';

export const NoAuthGuard: CanActivateFn | CanActivateChildFn = (
    route,
    state
) => {
    const router: Router = inject(Router);

    // Check the authentication status
    return inject(AuthService)
        .check()
        .pipe(
            switchMap((authenticated) => {
                // If the user is authenticated...
                if (authenticated) {
                    const role = localStorage.getItem('user-role');

                    if (role === 'SECURITY') {
                        return of(router.parseUrl('/security/guest'));
                    }

                    // Default (ADMIN et autres rôles): liste des événements
                    return of(router.parseUrl('/events/event-list'));
                }

                // Allow the access
                return of(true);
            })
        );
};
