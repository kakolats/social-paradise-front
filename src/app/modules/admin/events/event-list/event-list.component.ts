import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core'
import { EventService } from '../../../../../shared/services/event/event.service';
import { Event } from '../../../../../shared/models/event';
import { Router } from '@angular/router';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss'
})
export class EventListComponent {
    private eventService = inject(EventService);
    private router = inject(Router);

    events: Event[] = [];
    loading = false;
    error: string | null = null;
    togglingSlug: string | null = null;

    ngOnInit() {
        this.fetchEvents();
    }

    fetchEvents() {
        this.loading = true;
        this.error = null;
        this.eventService.list().subscribe({
            next: (res) => {
                this.events = res;
                this.loading = false;
            },
            error: (err) => {
                this.error = err?.error?.message ?? 'Erreur lors du chargement des événements.';
                this.loading = false;
            }
        });
    }

    trackById(_: number, e: Event) {
        return e.id;
    }

    isActive(event: Event): boolean {
        return (event as any)?.isActive !== false;
    }

    onDetails(event: Event) {
        this.router.navigate(['/events/event-detail', event.slug])
    }

    onEdit(event: Event) {
        this.router.navigate(['/events/update-event', event.slug])
    }

    toggleActive(event: Event) {
        if (!event?.slug) return;
        const next = this.isActive(event) ? false : true;
        this.togglingSlug = event.slug;
        this.eventService.update(event.slug, { isActive: next }).subscribe({
            next: (updated) => {
                this.events = this.events.map(e =>
                    e.slug === event.slug
                        ? { ...e, isActive: (updated as any).isActive ?? next }
                        : e
                );
                this.togglingSlug = null;
            },
            error: (err) => {
                this.error = err?.error?.message ?? 'Erreur lors du changement de statut.';
                this.togglingSlug = null;
            }
        });
    }
}
