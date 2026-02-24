import { Route } from '@angular/router';
import { initialDataResolver } from 'app/app.resolvers';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { LayoutComponent } from 'app/layout/layout.component';
import { AuthGuard } from '../shared/guards/auth/auth.guard';
import { GuestQrScanComponent } from './modules/security/guest-qr-scan/guest-qr-scan.component';
import { RoleGuard } from '../shared/guards/role/role.guard';
import { UnauthorizedComponent } from './modules/landing/unauthorized/unauthorized.component';
import { ReviewFormComponent } from './modules/landing/review-form/review-form.component';

// @formatter:off
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// @ts-ignore
export const appRoutes: Route[] = [

    // Redirect empty path to '/example'
    {path: '', pathMatch : 'full', redirectTo: 'security/guest'},

    {
        path : 'unauthorized',
        pathMatch : 'full',
        component : UnauthorizedComponent
    },

    // Redirect signed-in user to the '/example'
    //
    // After the user signs in, the sign-in page will redirect the user to the 'signed-in-redirect'
    // path. Below is another redirection for that path to redirect the user to the desired
    // location. This is a small convenience to keep all main routes together here on this file.
    {path: 'signed-in-redirect', pathMatch : 'full', redirectTo: 'events/event-list'},

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'confirmation-required', loadChildren: () => import('app/modules/auth/confirmation-required/confirmation-required.routes')},
            {path: 'forgot-password', loadChildren: () => import('app/modules/auth/forgot-password/forgot-password.routes')},
            {path: 'reset-password', loadChildren: () => import('app/modules/auth/reset-password/reset-password.routes')},
            {path: 'sign-in', loadChildren: () => import('app/modules/auth/sign-in/sign-in.routes')},
            {path: 'sign-up', loadChildren: () => import('app/modules/auth/sign-up/sign-up.routes')},
            {path: 'paradise-til-sunrise-review-form', component: ReviewFormComponent},
        ]
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'sign-out', loadChildren: () => import('app/modules/auth/sign-out/sign-out.routes')},
            {path: 'unlock-session', loadChildren: () => import('app/modules/auth/unlock-session/unlock-session.routes')},

        ]
    },

    // Landing routes
    {
        path: '',
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'home', loadChildren: () => import('app/modules/landing/home/home.routes')},
            {path: 'public-event',loadChildren: () =>import('app/modules/landing/public-event/public-event.routes')},
        ]
    },

    // Admin routes
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            // {path: 'example', loadChildren: () => import('app/modules/admin/example/example.routes')},
            {
                path: 'events',
                canActivate:[RoleGuard],
                data : {
                    roles: ['ADMIN']
                },
                loadChildren: () => import('app/modules/admin/events/events.routes')
            },
            {path: 'user-management', loadChildren: () => import('app/modules/admin/user-management/user-management.routes')},
            {path: 'security/guest', component : GuestQrScanComponent}
        ]
    }
];
