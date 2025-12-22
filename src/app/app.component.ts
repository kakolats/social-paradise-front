import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxPermissionsService } from 'ngx-permissions';
import { AuthService } from '../shared/services/auth/auth.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
    permissionsService = inject(NgxPermissionsService);
    /**
     * Constructor
     */
    constructor(private authService:AuthService) {}

    ngOnInit(): void {
        /*const perm = [];
        this.authService.getUserRole().then(
            data =>{
                console.log('USER PERM',data);
                perm.push(data);
                this.permissionsService.loadPermissions(perm);
            }
        )*/
        this.loadUserPermissions();
    }

    private async loadUserPermissions(): Promise<void> {
        try {
            // Check if user is authenticated
            const isAuthenticated = await this.authService.check().toPromise()

            if (!isAuthenticated) {
                this.permissionsService.flushPermissions()
                return
            }

            // Get both role and permissions
            const [role] = await Promise.all([
                this.authService.getUserRole()
            ])

            const permissionsToLoad: string[] = []

            // Add all permissions

            // Add role as permission for backward compatibility
            if (role) {
                permissionsToLoad.push(role)
            }

            // Load permissions into ngx-permissions
            this.permissionsService.loadPermissions(permissionsToLoad)

            console.log("Loaded permissions:", permissionsToLoad)
        } catch (error) {
            console.error("Error loading user permissions:", error)
            this.permissionsService.flushPermissions()
        }
    }
}
