import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EventService } from 'shared/services/event/event.service';
import {
    DemandService,
    DemandStatsEntry,
    DemandSummary,
} from 'shared/services/demand/demand.service';
import { Demand, DemandStatus, DemandType } from 'shared/models/demand';
import { Event as FrontEvent } from 'shared/models/event';
import { FormsModule } from '@angular/forms';
import { PaymentCanal, PaymentPlace } from 'shared/models/payment';
import { PaymentService } from 'shared/services/payment/payment.service';

type PendingStatusChange = {
    slug: string;
    prev: DemandStatus;
    next: DemandStatus;
} | null;

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
    private paymentService = inject(PaymentService);

    // data
    event = signal<FrontEvent | null>(null);
    demandsRaw = signal<DemandSummary[]>([]);

    // stats par statut
    stats = signal<Record<DemandStatus, DemandStatsEntry> | null>(null);
    statsError = signal<string | null>(null);

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
    pageSizeOptions = [6, 12, 24, 50, 100];

    // modal details
    isModalOpen = signal<boolean>(false);
    modalLoading = signal<boolean>(false);
    modalError = signal<string | null>(null);
    selectedDemand = signal<Demand | null>(null);

    // modal payment mini-form
    payAmount = signal<number>(0);
    payPhone = signal<string>('');
    payCanal = signal<PaymentCanal>(PaymentCanal.WAVE);
    payPlace = signal<PaymentPlace | null>(null);
    submittingPayment = signal<boolean>(false);
    paymentError = signal<string | null>(null);
    paymentSuccess = signal<string | null>(null);

    // confirm modal
    confirmOpen = signal<boolean>(false);
    pendingChange = signal<PendingStatusChange>(null);

    deleteOpen = signal<boolean>(false);
    deleteTarget = signal<{ slug: string; label?: string } | null>(null);
    deleting = signal<boolean>(false);
    deleteError = signal<string | null>(null);

    // stockage des sélections temporaires dans les selects (slug -> statut)
    selectedStatusInSelects = signal<Map<string, DemandStatus>>(new Map());

    // ➕ view switch
    viewMode = signal<'cards' | 'list'>('list');

    searchQuery = signal<string>('');

    DemandType = DemandType;
    PaymentCanal = PaymentCanal;
    PaymentPlace = PaymentPlace;
    DemandStatus = DemandStatus;

    updatableStatuses: DemandStatus[] = [
        DemandStatus.VALIDEE,
        DemandStatus.REFUSEE,
        DemandStatus.PAYEE
    ];
    allStatuses: DemandStatus[] = [
        DemandStatus.SOUMISE,
        DemandStatus.VALIDEE,
        DemandStatus.REFUSEE,
        DemandStatus.PAIEMENT_NOTIFIE,
        DemandStatus.PAYEE,
        DemandStatus.OFFERT
    ];
    allTypes: DemandType[] = [DemandType.UNIQUE, DemandType.GROUP];

    getAvailableStatuses(currentStatus: DemandStatus): DemandStatus[] {
        switch (currentStatus) {
            case DemandStatus.SOUMISE:
                return [DemandStatus.VALIDEE, DemandStatus.REFUSEE, DemandStatus.OFFERT];
            case DemandStatus.VALIDEE:
                return [DemandStatus.REFUSEE];
            case DemandStatus.PAIEMENT_NOTIFIE:
                return [DemandStatus.PAYEE, DemandStatus.REFUSEE];
            case DemandStatus.REFUSEE:
                return [DemandStatus.VALIDEE];
            case DemandStatus.PAYEE:
                return [DemandStatus.OFFERT]; // Aucun changement possible
            default:
                return [];
        }
    }

    private eventSlug: string | null = null;

    ngOnInit(): void {
        this.eventSlug = this.route.snapshot.paramMap.get('slug');
        if (!this.eventSlug) {
            this.error.set('Slug évènement manquant.');
            return;
        }

        // Charger l'event
        this.eventService.getBySlug(this.eventSlug).subscribe({
            next: evt => {
                this.event.set(evt);
            },
            error: err => {
                this.error.set(err?.error?.message ?? "Impossible de charger l'évènement.");
            },
        });

        // Charger la liste des demandes
        this.fetchDemands();

        // Charger les stats
        this.loadStats();
    }

    /** Stats par statut pour l'évènement */
    private loadStats(): void {
        if (!this.eventSlug) return;
        this.demandService.getStatsByEventSlug(this.eventSlug).subscribe({
            next: st => {
                this.stats.set(st);
                this.statsError.set(null);
            },
            error: err => {
                this.statsError.set(
                    err?.error?.message ?? 'Impossible de charger les statistiques.'
                );
            }
        });
    }

    /** Appelle l'API avec les filtres en cours puis réinitialise la page. */
    fetchDemands() {
        if (!this.eventSlug) return;
        this.loading.set(true);
        this.error.set(null);

        const status = this.filterStatus();
        const type = this.filterType();

        const obs = (status || type)
            ? this.demandService.listByEventSlugFiltered(this.eventSlug, {
                status: status ?? undefined,
                type: type ?? undefined
            })
            : this.demandService.listByEventSlug(this.eventSlug);

        obs.subscribe({
            next: list => {
                this.demandsRaw.set(list);
                this.page.set(1);
                this.loading.set(false);
            },
            error: err => {
                this.error.set(err?.error?.message ?? "Impossible de charger les demandes.");
                this.loading.set(false);
            }
        });
    }
    private searchedDemands = computed(() =>
        this.demandsRaw().filter(d => this.matchesSearch(d, this.searchQuery()))
    );
    // --- computed pagination helpers
    filteredCount = computed(() => this.searchedDemands().length);

    totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredCount() / this.pageSize()))
    );
    pagedDemands = computed(() => {
        const p = this.page();
        const size = this.pageSize();
        const start = (p - 1) * size;
        return this.searchedDemands().slice(start, start + size);
    });
    pageNumbers = computed(() => {
        const total = this.totalPages();
        const current = this.page();
        const spread = 3;
        const from = Math.max(1, current - spread);
        const to = Math.min(total, current + spread);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });

    // --- pagination actions
    goToPage(p: number) {
        this.page.set(Math.min(Math.max(1, p), this.totalPages()));
    }
    prevPage() {
        this.goToPage(this.page() - 1);
    }
    nextPage() {
        this.goToPage(this.page() + 1);
    }
    changePageSize(size: number) {
        this.pageSize.set(size);
        this.page.set(1);
    }

    // --- filters actions
    setFilterStatus(s: DemandStatus | null) {
        this.filterStatus.set(s);
        this.fetchDemands();
    }
    setFilterType(t: DemandType | null) {
        this.filterType.set(t);
        this.fetchDemands();
    }
    resetFilters() {
        this.filterStatus.set(null);
        this.filterType.set(null);
        this.page.set(1);
        this.fetchDemands();
    }

    reload() {
        this.fetchDemands();
        this.loadStats();
    }

    // ➕ view switch
    toggleView() {
        this.viewMode.set(this.viewMode() === 'cards' ? 'list' : 'cards');
    }

    // --- status update -> confirmation (vérifie les transitions autorisées)
    onChangeStatus(d: DemandSummary, newStatus: DemandStatus) {
        if (d.status === newStatus) return;
        const availableStatuses = this.getAvailableStatuses(d.status);
        if (!availableStatuses.includes(newStatus)) return;
        // Stocker temporairement la sélection
        this.selectedStatusInSelects.update(map => {
            const newMap = new Map(map);
            newMap.set(d.slug, newStatus);
            return newMap;
        });
        this.pendingChange.set({ slug: d.slug, prev: d.status, next: newStatus });
        this.confirmOpen.set(true);
    }

    cancelStatusChange() {
        const pc = this.pendingChange();
        this.confirmOpen.set(false);
        this.pendingChange.set(null);
        // Réinitialiser la sélection si annulation
        if (pc) {
            this.selectedStatusInSelects.update(map => {
                const newMap = new Map(map);
                newMap.delete(pc.slug);
                return newMap;
            });
        }
    }

    getSelectValue(slug: string, currentStatus: DemandStatus): DemandStatus | null {
        const selected = this.selectedStatusInSelects().get(slug);
        // Si une sélection temporaire existe ET qu'elle est différente du statut actuel, l'utiliser
        // Sinon retourner null pour réinitialiser le select
        if (selected && selected !== currentStatus) {
            return selected;
        }
        return null;
    }

    confirmStatusChange() {
        const pc = this.pendingChange();
        if (!pc) return;

        this.confirmOpen.set(false);
        this.savingSlug.set(pc.slug);

        // UI optimiste
        this.demandsRaw.update(arr =>
            arr.map(x => (x.slug === pc.slug ? { ...x, status: pc.next } : x))
        );

        this.demandService.updateStatus(pc.slug, pc.next).subscribe({
            next: () => {
                this.savingSlug.set(null);
                this.pendingChange.set(null);
                // Réinitialiser la sélection dans le select pour cette demande
                this.selectedStatusInSelects.update(map => {
                    const newMap = new Map(map);
                    newMap.delete(pc.slug);
                    return newMap;
                });
                // recharger aussi les stats (changement de statut impacte les stats)
                this.loadStats();
            },
            error: err => {
                // revert si échec
                this.demandsRaw.update(arr =>
                    arr.map(x => (x.slug === pc.slug ? { ...x, status: pc.prev } : x))
                );
                // Réinitialiser la sélection dans le select
                this.selectedStatusInSelects.update(map => {
                    const newMap = new Map(map);
                    newMap.delete(pc.slug);
                    return newMap;
                });
                this.savingSlug.set(null);
                this.pendingChange.set(null);
                this.error.set(
                    err?.error?.message ??
                    'Erreur lors de la mise à jour du statut.'
                );
            }
        });
    }

    // -------- Modal logic
    openDemandModal(slug: string) {
        this.isModalOpen.set(true);
        this.modalLoading.set(true);
        this.modalError.set(null);
        this.selectedDemand.set(null);
        this.payPlace.set(null);
        this.paymentError.set(null);
        this.paymentSuccess.set(null);
        this.payCanal.set(PaymentCanal.WAVE);
        this.payPhone.set('');
        this.payAmount.set(0);

        this.demandService.getBySlug(slug).subscribe({
            next: d => {
                this.selectedDemand.set(d);
                // Pré-remplir le montant (tarif actif × nb participants)
                this.payAmount.set(this.modalAutoAmount());
                this.modalLoading.set(false);
            },
            error: err => {
                this.modalError.set(
                    err?.error?.message ??
                    'Erreur lors du chargement des détails.'
                );
                this.modalLoading.set(false);
            }
        });
    }

    closeModal() {
        this.isModalOpen.set(false);
        this.selectedDemand.set(null);
        this.modalError.set(null);
        this.modalLoading.set(false);
        // reset mini-form
        this.payPlace.set(null);
        this.paymentError.set(null);
        this.paymentSuccess.set(null);
        this.payCanal.set(PaymentCanal.WAVE);
        this.payPhone.set('');
        this.payAmount.set(0);
    }

    // --- mini-form paiement helpers
    onChangeCanal(c: PaymentCanal) {
        this.payCanal.set(c);
        // si on quitte CASH, on nettoie le lieu
        if (c !== PaymentCanal.CASH) {
            this.payPlace.set(null);
        }
    }

    submitPaymentFromModal() {
        const dd = this.selectedDemand();
        if (!dd?.slug) return;
        if (dd.demandStatus !== DemandStatus.VALIDEE) return;

        const amount = Number(this.payAmount());
        const canal = this.payCanal();
        const phone = (this.payPhone() || '').trim();

        if (!amount || amount <= 0) {
            this.paymentError.set('Montant invalide.');
            return;
        }

        // ✅ validations selon canal
        if (canal !== PaymentCanal.CASH && phone.length === 0) {
            this.paymentError.set('Le numéro de téléphone est requis pour ce canal.');
            return;
        }
        if (canal === PaymentCanal.CASH && !this.payPlace()) {
            this.paymentError.set('Veuillez indiquer le lieu d’encaissement.');
            return;
        }

        const payload: any = {
            demandSlug: dd.slug,
            amount,
            paymentCanal: canal
        };
        if (canal !== PaymentCanal.CASH) {
            payload.phoneNumber = phone;
        } else {
            payload.paymentPlace = this.payPlace();
        }

        this.submittingPayment.set(true);
        this.paymentError.set(null);
        this.paymentSuccess.set(null);

        this.paymentService.notify(payload).subscribe({
            next: () => {
                this.submittingPayment.set(false);
                this.paymentSuccess.set('Notification enregistrée. Elle sera vérifiée par un administrateur.');
                this.reload();
            },
            error: err => {
                this.submittingPayment.set(false);
                this.paymentError.set(err?.error?.message ?? 'Erreur lors de la notification de paiement.');
            }
        });
    }

    // --- date & pricing helpers
    private parseLocalDate(d: string | Date): Date {
        if (d instanceof Date)
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const m = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').map(Number) : null;
        if (m) {
            const [y, mo, da] = m as unknown as number[];
            return new Date(y, mo - 1, da);
        }
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    private dateOnlyLocal(d: string | Date): Date {
        const dt = d instanceof Date ? d : this.parseLocalDate(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    private modalPeopleCount(): number {
        return this.selectedDemand()?.guests?.length ?? 0;
    }

    private modalActivePrice(): { amount: number } | null {
        const ev = this.event() as FrontEvent | undefined;
        const prices = ev?.prices as
            | Array<{
            amount: number;
            startDate: string | Date;
            endDate: string | Date;
        }>
            | undefined;
        if (!prices?.length) return null;
        const today = this.dateOnlyLocal(new Date());
        return (
            prices.find(p => {
                const s = this.dateOnlyLocal(p.startDate);
                const e = this.dateOnlyLocal(p.endDate);
                return (
                    s.getTime() <= today.getTime() &&
                    today.getTime() <= e.getTime()
                );
            }) ?? null
        );
    }

    private modalTablesTotal(): number {
        const dd = this.selectedDemand();
        if (!dd?.tableItems?.length) return 0;
        return dd.tableItems.reduce((sum, item) => {
            return sum + (item.table.amount * item.quantity);
        }, 0);
    }

    getModalTablesTotal(): number {
        return this.modalTablesTotal();
    }

    getModalPassTotal(): number {
        const p = this.modalActivePrice();
        return p ? p.amount * this.modalPeopleCount() : 0;
    }

    getModalTotalPrice(): number {
        return this.getModalPassTotal() + this.getModalTablesTotal();
    }

    private modalAutoAmount(): number {
        const p = this.modalActivePrice();
        const participantsTotal = p ? p.amount * this.modalPeopleCount() : 0;
        return participantsTotal + this.modalTablesTotal();
    }

    // utils
    trackBySlug(_: number, d: DemandSummary) {
        return d.slug;
    }

    private normalize(v: unknown): string {
        return (v ?? '')
            .toString()
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // remove accents
    }

    /*private matchesSearch(d: DemandSummary, q: string): boolean {
        const n = this.normalize(q);
        if (!n) return true;

        const fullName = `${d.mainGuest?.firstName ?? ''} ${d.mainGuest?.lastName ?? ''}`;
        const haystacks = [
            fullName,
            d.mainGuest?.email ?? '',
        ];

        return haystacks.some(h => this.normalize(h).includes(n));
    }*/

    private matchesSearch(d: DemandSummary, q: string): boolean {
        const n = this.normalize(q);
        if (!n) return true;

        // Si pas de guests, impossible de matcher
        if (!d.guests || d.guests.length === 0) return false;

        // Pour chaque guest → construire les "haystacks"
        return d.guests.some(g => {
            const first = (g.firstName ?? '').trim();
            const last  = (g.lastName ?? '').trim();
            const fullName = `${first} ${last}`.trim();
            // const fullName = `${g.firstName ?? ''} ${g.lastName ?? ''}`;
            const haystacks = [
                fullName,
                g.email ?? '',
            ];

            return haystacks.some(h => this.normalize(h).includes(n));
        });
    }

    setSearch(q: string) {
        this.searchQuery.set(q ?? '');
        this.page.set(1); // reset pagination on search
    }
    clearSearch() {
        this.setSearch('');
    }

    deleteDemand(slug:string){
        this.demandService.deleteBySlug(slug).subscribe({
            next: () => {
                this.reload();
                this.closeModal();
            },
            error: err => {
                this.modalError.set(
                    err?.error?.message ??
                    'Erreur lors de la suppression de la demande.'
                );
            }
        });
    }

    openDeleteModal(d: DemandSummary) {
        this.deleteTarget.set({
            slug: d.slug,
            label: `${d.mainGuest?.firstName ?? ''} ${d.mainGuest?.lastName ?? ''}`.trim()
        });
        this.deleteError.set(null);
        this.deleting.set(false);
        this.deleteOpen.set(true);
    }

    cancelDelete() {
        this.deleteOpen.set(false);
        this.deleteTarget.set(null);
        this.deleteError.set(null);
        this.deleting.set(false);
    }

    confirmDelete() {
        const target = this.deleteTarget();
        if (!target) return;

        this.deleting.set(true);
        this.deleteError.set(null);

        this.demandService.deleteBySlug(target.slug).subscribe({
            next: () => {
                this.deleting.set(false);
                this.deleteOpen.set(false);
                this.deleteTarget.set(null);
                // recharger la liste (et fermer la modale détails si ouverte)
                this.reload();
                this.closeModal();
            },
            error: err => {
                this.deleting.set(false);
                this.deleteError.set(
                    err?.error?.message ?? "Erreur lors de la suppression de la demande."
                );
            }
        });
    }

}
