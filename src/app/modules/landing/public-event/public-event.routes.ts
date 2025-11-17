import { PublicEventComponent } from './public-event.component';
import { Routes } from '@angular/router';
import { PublicEventDetailComponent } from './public-event-detail/public-event-detail.component';
import { PublicEventSuccessComponent } from './public-event-success/public-event-success.component';

export default [
    {
        path: ':slug/success',
        component: PublicEventSuccessComponent
    },
    {
        path: 'demand/:slug',
        component: PublicEventDetailComponent
    },
    {
        path : ':slug',
        component : PublicEventComponent
    },
] as Routes;
