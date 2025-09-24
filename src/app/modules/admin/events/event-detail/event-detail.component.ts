import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService } from 'shared/services/event/event.service';
import { DemandService, DemandSummary } from 'shared/services/demand/demand.service';
import { Demand, DemandStatus, DemandType } from 'shared/models/demand';
import { Event as FrontEvent } from 'shared/models/event';
import { FormsModule } from '@angular/forms';

type PendingStatusChange = { slug: string; prev: DemandStatus; next: DemandStatus } | null;

@Component({
    selector: 'app-event-detail',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule],
    templateUrl: './event-detail.component.html',
    styleUrl: './event-detail.component.scss',
})
export class EventDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private eventService = inject(EventService);
    private demandService = inject(DemandService);

    // data
    event = signal<FrontEvent | null>(null);
    /** Liste filtrée renvoyée par l'API (status/type). On pagine dessus côté front. */
    demandsRaw = signal<DemandSummary[]>([]);

    // ui state
    loading = signal<boolean>(false);
    error = signal<string | null>(null);
    savingSlug = signal<string | null>(null);

    // filters (null = tous)
    filterStatus = signal<DemandStatus | null>(null);
    filterType = signal<DemandType | null>(null);

    // pagination
    page = signal<number>(1);
    pageSize = signal<number>(6);
    pageSizeOptions = [6, 12, 24];

    // modal
    isModalOpen = signal<boolean>(false);
    modalLoading = signal<boolean>(false);
    modalError = signal<string | null>(null);
    selectedDemand = signal<Demand | null>(null);

    DemandType = DemandType;
    updatableStatuses: DemandStatus[] = [DemandStatus.VALIDEE, DemandStatus.REFUSEE, DemandStatus.PAYEE];
    allStatuses: DemandStatus[] = [
        DemandStatus.SOUMISE,
        DemandStatus.VALIDEE,
        DemandStatus.REFUSEE,
        DemandStatus.PAIEMENT_NOTIFIE,
        DemandStatus.PAYEE
    ];
    allTypes: DemandType[] = [DemandType.UNIQUE, DemandType.GROUP];

    private eventSlug: string | null = null;

    confirmOpen = signal<boolean>(false);
    pendingChange = signal<PendingStatusChange>(null);

    ngOnInit(): void {
        this.eventSlug = this.route.snapshot.paramMap.get('slug');
        if (!this.eventSlug) {
            this.error.set('Slug évènement manquant.');
            return;
        }
        // charger l'évènement
        this.eventService.getBySlug(this.eventSlug).subscribe({
            next: evt => this.event.set(evt),
            error: err => this.error.set(err?.error?.message ?? "Impossible de charger l'évènement."),
        });
        // charger la liste filtrée
        this.fetchDemands();
    }

    /** Appelle l'API avec les filtres en cours puis réinitialise la page. */
    fetchDemands() {
        if (!this.eventSlug) return;
        this.loading.set(true);
        this.error.set(null);

        const status = this.filterStatus();
        const type = this.filterType();

        const obs = (status || type)
            ? this.demandService.listByEventSlugFiltered(this.eventSlug, { status: status ?? undefined, type: type ?? undefined })
            : this.demandService.listByEventSlug(this.eventSlug);

        obs.subscribe({
            next: list => { this.demandsRaw.set(list); this.page.set(1); this.loading.set(false); },
            error: err => { this.error.set(err?.error?.message ?? "Impossible de charger les demandes."); this.loading.set(false); }
        });
    }

    // --- computed pagination helpers
    filteredCount = computed(() => this.demandsRaw().length);
    totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCount() / this.pageSize())));
    pagedDemands = computed(() => {
        const p = this.page();
        const size = this.pageSize();
        const start = (p - 1) * size;
        return this.demandsRaw().slice(start, start + size);
    });
    pageNumbers = computed(() => {
        const total = this.totalPages();
        const current = this.page();
        // petite pagination : 1 ... n (max 7 boutons)
        const spread = 3;
        const from = Math.max(1, current - spread);
        const to = Math.min(total, current + spread);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });

    // --- pagination actions
    goToPage(p: number) { this.page.set(Math.min(Math.max(1, p), this.totalPages())); }
    prevPage() { this.goToPage(this.page() - 1); }
    nextPage() { this.goToPage(this.page() + 1); }
    changePageSize(size: number) { this.pageSize.set(size); this.page.set(1); }

    // --- filters actions
    setFilterStatus(s: DemandStatus | null) { this.filterStatus.set(s); this.fetchDemands(); }
    setFilterType(t: DemandType | null) { this.filterType.set(t); this.fetchDemands(); }
    resetFilters() {
        this.filterStatus.set(null);
        this.filterType.set(null);
        this.page.set(1);
        this.fetchDemands();
    }

    reload() { this.fetchDemands(); }

    // --- status update (VALIDEE / REFUSEE / PAYEE uniquement)
    onChangeStatus(d: DemandSummary, newStatus: DemandStatus) {
        if (d.status === newStatus) return;
        const allowed = new Set([DemandStatus.VALIDEE, DemandStatus.REFUSEE, DemandStatus.PAYEE]);
        if (!allowed.has(newStatus)) return;
        this.pendingChange.set({ slug: d.slug, prev: d.status, next: newStatus });
        this.confirmOpen.set(true);
    }

    // ⬇️ Annuler = fermer la modale et vider l'intention
    cancelStatusChange() {
        this.confirmOpen.set(false);
        this.pendingChange.set(null);
    }

    // ⬇️ Confirmer = appliquer UI optimiste + appel API, sinon revert
    confirmStatusChange() {
        const pc = this.pendingChange();
        if (!pc) return;

        this.confirmOpen.set(false);
        this.savingSlug.set(pc.slug);

        // UI optimiste
        this.demandsRaw.update(arr => arr.map(x => x.slug === pc.slug ? { ...x, status: pc.next } : x));

        this.demandService.updateStatus(pc.slug, pc.next).subscribe({
            next: () => {
                this.savingSlug.set(null);
                this.pendingChange.set(null);
            },
            error: err => {
                // revert si échec
                this.demandsRaw.update(arr => arr.map(x => x.slug === pc.slug ? { ...x, status: pc.prev } : x));
                this.savingSlug.set(null);
                this.pendingChange.set(null);
                this.error.set(err?.error?.message ?? 'Erreur lors de la mise à jour du statut.');
            }
        });
    }


    openDemandModal(slug: string) {
        this.isModalOpen.set(true);
        this.modalLoading.set(true);
        this.modalError.set(null);
        this.selectedDemand.set(null);

        this.demandService.getBySlug(slug).subscribe({
            next: d => { this.selectedDemand.set(d); this.modalLoading.set(false); },
            error: err => { this.modalError.set(err?.error?.message ?? 'Erreur lors du chargement des détails.'); this.modalLoading.set(false); }
        });
    }

    closeModal() {
        this.isModalOpen.set(false);
        this.selectedDemand.set(null);
        this.modalError.set(null);
        this.modalLoading.set(false);
    }

    // utils
    trackBySlug(_: number, d: DemandSummary) { return d.slug; }
}
