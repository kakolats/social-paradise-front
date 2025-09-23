import { PublicEventComponent } from './public-event.component';
import { Routes } from '@angular/router';

export default [
    {
        path : ':slug',
        component : PublicEventComponent
    }
] as Routes;
