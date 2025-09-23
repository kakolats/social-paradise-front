import { PublicEventComponent } from './public-event.component';
import { Routes } from '@angular/router';
import { PublicEventDetailComponent } from './public-event-detail/public-event-detail.component';

export default [
    {
        path : ':slug',
        component : PublicEventComponent
    },
    {
        path: 'demand/:slug',
        component: PublicEventDetailComponent
    },
] as Routes;
