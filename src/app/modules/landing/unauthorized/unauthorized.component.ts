import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../../../shared/services/auth/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-unauthorized',
    standalone: true,
    imports: [],
    templateUrl: './unauthorized.component.html',
    styleUrl: './unauthorized.component.scss',
})
export class UnauthorizedComponent implements OnInit {
    private authService = inject(AuthService);
    private router = inject(Router);

    ngOnInit() {
        const isLoggedIn = this.authService.check();
        if (isLoggedIn) {
            // Rediriger vers une page appropriée si l'utilisateur est connecté mais n'a pas les droits
            this.authService.getUserRole().then(
                (role:string|null) => {
                    if(role){
                        switch (role) {
                            case 'ADMIN':
                                this.router.navigate(['/events/list']);
                                break;
                            case 'SECURITY':
                                this.router.navigate(['/security/guest']);
                                break;
                            default:
                                this.router.navigate(['/security/guest']);
                                break;
                        }
                    }else{
                        this.authService.logout();
                    }
                }
            )
        }else {
            // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
            this.router.navigate(['/sign-in']);
        }
    }
}
