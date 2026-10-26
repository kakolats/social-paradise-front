import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

// Confort d'affichage uniquement : la vraie vérification des rôles est faite par l'API
export const RoleGuard: CanActivateFn = async (route) => {
    const authService = inject(AuthService)
    const router = inject(Router)
    const requiredRoles = route.data["roles"] as string[] | undefined

    if (!requiredRoles || requiredRoles.length === 0) {
        return true
    }

    const role = await authService.getUserRole()
    if (role && requiredRoles.includes(role)) {
        return true
    }

    return router.parseUrl('/unauthorized')
}
