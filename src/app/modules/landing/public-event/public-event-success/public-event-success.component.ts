import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-public-event-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-event-success.component.html',
  styleUrl: './public-event-success.component.scss'
})
export class PublicEventSuccessComponent {

  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private navigationState = this.router.getCurrentNavigation()?.extras?.state as { demandSlug?: string } | undefined;

  eventSlug = signal<string>(this.route.snapshot.paramMap.get('slug') ?? '');

  eventLink = computed(() => ['/public-event', this.eventSlug()].filter(Boolean));


  navigateToEvent(): void {
    const link = this.eventLink();
    if (!link.length || !this.eventSlug()) return;
    void this.router.navigate(link);
  }

}
