import { EventsComponent } from './events.component';
import { CreateEventComponent } from './create-event/create-event.component';
import { EventListComponent } from './event-list/event-list.component';
import { EventDetailComponent } from './event-detail/event-detail.component';

export default [
    {
        path : '',
        component : EventsComponent,
        children: [
            {
                component : CreateEventComponent,
                path : 'create-event'
            },
            {
                component: EventListComponent,
                path : 'event-list'
            },
            {
                component: EventDetailComponent,
                path: 'event-detail/:slug',
            }
        ]
    }
]
