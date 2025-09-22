import { EventsComponent } from './events.component';
import { CreateEventComponent } from './create-event/create-event.component';
import { EventListComponent } from './event-list/event-list.component';

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
            }
        ]
    }
]
