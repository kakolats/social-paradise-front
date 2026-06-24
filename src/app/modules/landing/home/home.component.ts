import { CommonModule, DatePipe } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { EventService } from 'shared/services/event/event.service';
import { Event as FrontEvent } from 'shared/models/event';

const LANDING_REVEAL_VISIBLE_CLASS = 'landing-reveal--visible';

type ContactCard = {
    icon: string;
    iconClass: string;
    title: string;
    subtitle: string;
    cta: string;
    href: string;
    external: boolean;
    subtitleClass?: string;
};

@Component({
    selector: 'landing-home',
    templateUrl: './home.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [CommonModule, DatePipe, MatButtonModule, RouterLink, MatIconModule],
    styles: [
        `
            .landing-reveal {
                --reveal-duration: 2.4s;
                --reveal-stagger: 380ms;
                --reveal-ease: cubic-bezier(0.19, 1, 0.22, 1);
                --reveal-ease-fade: cubic-bezier(0.33, 1, 0.68, 1);
            }

            .landing-reveal__item {
                opacity: 0;
                transform: translate3d(0, 1.75rem, 0) scale(0.985);
                filter: blur(6px);
                transition:
                    opacity calc(var(--reveal-duration) * 0.65) var(--reveal-ease-fade),
                    transform var(--reveal-duration) var(--reveal-ease),
                    filter calc(var(--reveal-duration) * 0.8) var(--reveal-ease);
                transition-delay: var(--reveal-delay, 0ms);
                backface-visibility: hidden;
                will-change: opacity, transform, filter;
            }

            .landing-reveal--visible .landing-reveal__item {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                filter: blur(0);
            }

            .about-collage__item {
                opacity: 0;
                transform: translate3d(0, 1.25rem, 0) scale(0.965);
                filter: blur(5px);
                transition:
                    opacity 1s var(--reveal-ease-fade),
                    transform 1.35s var(--reveal-ease),
                    filter 1.15s var(--reveal-ease);
                backface-visibility: hidden;
                will-change: opacity, transform, filter;
            }

            .landing-reveal--visible .about-collage__item--0 {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                filter: blur(0);
                transition-delay: 0ms;
            }

            .landing-reveal--visible .about-collage__item--1 {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                filter: blur(0);
                transition-delay: 280ms;
            }

            .landing-reveal--visible .about-collage__item--2 {
                opacity: 1;
                transform: translate3d(0, 0, 0) scale(1);
                filter: blur(0);
                transition-delay: 560ms;
            }

            @media (prefers-reduced-motion: reduce) {
                .landing-reveal__item,
                .about-collage__item {
                    opacity: 1;
                    transform: none;
                    filter: none;
                    transition: none;
                    will-change: auto;
                }
            }
        `,
    ],
})
export class LandingHomeComponent implements AfterViewInit, OnDestroy {
    private eventService = inject(EventService);
    private sanitizer = inject(DomSanitizer);

    @ViewChild('pageRoot') private pageRoot?: ElementRef<HTMLElement>;
    private revealObserver?: IntersectionObserver;

    upcomingEvents = signal<FrontEvent[]>([]);
    loadingEvents = signal<boolean>(false);

    instagramUrl = 'https://www.instagram.com/socialparadisedkr/';
    instagramDirectUrl = 'https://ig.me/m/socialparadisedkr/';
    /**
     * Renseigne ces champs quand tu as les coordonnées officielles.
     * Le bloc correspondant n'apparaît pas tant que la valeur est vide.
     */
    contactEmail = 'info@socialparadise.sn';
    contactPhone = '+221 78 663 91 28';
    instagramEmbedUrls: SafeResourceUrl[] = [
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DWGza2hDMJ8/embed/'),
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DShaIdXDMVz/embed/'),
        this.sanitizer.bypassSecurityTrustResourceUrl('https://www.instagram.com/reel/DTLXW2EDH9A/embed/'),
    ];

    howItWorksSteps = [
        {
            step: 1,
            title: 'Découvrez lʼévénement',
            description:
                'Parcourez les événements disponibles et consultez toutes les informations importantes.',
        },
        {
            step: 2,
            title: 'Choisissez votre participation',
            description: 'Selon lʼévénement, vous pouvez faire une demande seul ou en groupe.',
        },
        {
            step: 3,
            title: 'Remplissez le formulaire',
            description: 'Envoyez votre demande directement depuis la page publique de lʼévénement.',
        },
        {
            step: 4,
            title: 'Préparez-vous à vivre le moment',
            description: 'Il ne vous reste plus quʼà rejoindre lʼexpérience Social Paradise.',
        },
    ];

    contactCards: ContactCard[] = [];

    constructor() {
        this.contactCards = this.buildContactCards();
        this.fetchUpcoming();
    }

    trackContactCard(_index: number, card: ContactCard): string {
        return card.title;
    }

    private buildContactCards(): ContactCard[] {
        const cards: ContactCard[] = [
            {
                icon: 'heroicons_mini:chat-bubble-left-right',
                iconClass: 'text-white',
                title: 'Instagram',
                subtitle: 'DM & actualités',
                cta: 'Ouvrir',
                href: this.instagramDirectUrl,
                external: true,
            },
        ];

        if (this.contactEmail) {
            cards.push({
                icon: 'heroicons_mini:envelope',
                iconClass: 'text-slate-900',
                title: 'Email',
                subtitle: this.contactEmail,
                subtitleClass: 'break-all',
                cta: 'Écrire',
                href: `mailto:${this.contactEmail}`,
                external: false,
            });
        }

        if (this.contactPhone) {
            cards.push({
                icon: 'heroicons_mini:phone',
                iconClass: 'text-slate-900',
                title: 'Téléphone',
                subtitle: this.contactPhone,
                cta: 'Appeler',
                href: `tel:${this.contactPhone}`,
                external: false,
            });
        }

        cards.push({
            icon: 'heroicons_mini:briefcase',
            iconClass: 'text-slate-900',
            title: 'Collabs & partenariats',
            subtitle: 'Marque, lieu, DJ, artistes, sponsors',
            cta: 'Écrivez-nous en DM',
            href: this.instagramDirectUrl,
            external: true,
        });

        return cards;
    }

    ngAfterViewInit(): void {
        const root = this.pageRoot?.nativeElement;
        if (!root) return;

        this.revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add(LANDING_REVEAL_VISIBLE_CLASS);
                    this.revealObserver?.unobserve(entry.target);
                });
            },
            { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
        );

        root.querySelectorAll<HTMLElement>('.landing-reveal').forEach((el) => {
            if (el.dataset['revealOnLoad'] !== undefined) {
                window.setTimeout(() => {
                    el.classList.add(LANDING_REVEAL_VISIBLE_CLASS);
                }, 120);
                return;
            }

            this.revealObserver?.observe(el);
        });
    }

    ngOnDestroy(): void {
        this.revealObserver?.disconnect();
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
