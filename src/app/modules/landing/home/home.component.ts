import { CommonModule, DatePipe } from '@angular/common';
import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { EventService } from 'shared/services/event/event.service';
import { Event as FrontEvent } from 'shared/models/event';

@Component({
    selector: 'landing-home',
    templateUrl: './home.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [CommonModule, DatePipe, MatButtonModule, RouterLink, MatIconModule],
})
export class LandingHomeComponent {
    private eventService = inject(EventService);
    private sanitizer = inject(DomSanitizer);

    upcomingEvents = signal<FrontEvent[]>([]);
    loadingEvents = signal<boolean>(false);

    instagramUrl = 'https://www.instagram.com/';
    /**
     * Renseigne ces champs quand tu as les coordonnées officielles.
     * Le bloc correspondant n'apparaît pas tant que la valeur est vide.
     */
    contactEmail = 'info@socialparadise.sn';
    contactPhone = '+221 77 777 77 77';
    instagramEmbedUrls: SafeResourceUrl[] = [
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DWGza2hDMJ8/embed/'),
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DShaIdXDMVz/embed/'),
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DTLXW2EDH9A/embed/'),
    ];

    constructor() {
        this.fetchUpcoming();
    }

    scrollToUpcoming(): void {
        const el = document.getElementById('upcoming-events');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private fetchUpcoming(): void {
        this.loadingEvents.set(true);
        this.eventService.list().subscribe({
            next: (events) => {
                const now = new Date();
                const upcoming = (events ?? [])
                    .filter((e) => (e as any)?.isActive !== false)
                    .filter((e) => !e.date || e.date >= now)
                    .sort((a, b) => {
                        const ad = a.date?.getTime?.() ?? 0;
                        const bd = b.date?.getTime?.() ?? 0;
                        return ad - bd;
                    })
                    .slice(0, 3);

                this.upcomingEvents.set(upcoming);
                this.loadingEvents.set(false);
            },
            error: () => {
                this.upcomingEvents.set([]);
                this.loadingEvents.set(false);
            },
        });
    }
}
