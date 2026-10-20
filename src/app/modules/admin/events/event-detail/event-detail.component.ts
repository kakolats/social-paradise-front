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
import { EventAccounting } from 'shared/models/event-accounting';

type PendingStatusChange = {
    slug: string;
    prev: DemandStatus;
    next: DemandStatus;
} | null;

type EventGuestRow = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  age: number | null;
  isMainGuest: boolean;
  demandSlug: string;
  demandStatus: DemandStatus;
  demandType: DemandType;
  createdAt: Date | string;
};

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
    accounting = signal<EventAccounting | null>(null);

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
    filterAgeOp = signal<'>' | '<' | '='>('>');
    filterAgeValue = signal<number | null>(null);

    // pagination
    page = signal<number>(1);
    pageSize = signal<number>(12);
    pageSizeOptions = [12, 24, 50, 100];

    // pagination invités
    guestsPage = signal<number>(1);
    guestsPageSize = signal<number>(25);
    guestsPageSizeOptions = [10, 25, 50, 100, 200];

    // modal details
    isModalOpen = signal<boolean>(false);
    modalLoading = signal<boolean>(false);
    modalError = signal<string | null>(null);
    selectedDemand = signal<Demand | null>(null);

    // suppression guest (demande group)
    guestDeletingId = signal<string | null>(null);
    guestDeleteError = signal<string | null>(null);
    guestDeleteOpen = signal<boolean>(false);
    guestDeleteTarget = signal<{ id: string; label?: string } | null>(null);

    // modal payment mini-form
    payAmount = signal<number>(0);
    payPhone = signal<string>('');
    payCanal = signal<PaymentCanal>(PaymentCanal.WAVE);
    payPlace = signal<PaymentPlace | null>(null);
    submittingPayment = signal<boolean>(false);
    paymentError = signal<string | null>(null);
    paymentSuccess = signal<string | null>(null);

    // discount
    discountEditing = signal<number>(0);
    discountSaving = signal<boolean>(false);
    discountError = signal<string | null>(null);

    // modales comptables
    expenseModalOpen = signal<boolean>(false);
    expenseLabel = signal<string>('');
    expenseAmount = signal<number>(0);
    expenseNote = signal<string>('');
    incomeModalOpen = signal<boolean>(false);
    incomeLabel = signal<string>('');
    incomeAmount = signal<number>(0);
    incomeNote = signal<string>('');
    accountingSaving = signal<boolean>(false);

    // suppression dépense / entrée
    moneyDeleteOpen = signal<boolean>(false);
    moneyDeleteTarget = signal<{ type: 'expense' | 'income'; id: number; label?: string } | null>(null);
    moneyDeleting = signal<boolean>(false);
    moneyDeleteError = signal<string | null>(null);

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

  // Onglets: demandes, invités, dépenses, entrées
  activeTab = signal<'demands' | 'guests' | 'expenses' | 'incomes'>('demands');

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

        // Charger la comptabilité
        this.loadAccounting();
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

    private loadAccounting(): void {
        if (!this.eventSlug) return;
        this.eventService.getAccounting(this.eventSlug).subscribe({
            next: acc => {
                this.accounting.set(acc);
            },
            error: () => {
                this.accounting.set(null);
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

    private ageFilteredDemands = computed(() => {
        const age = this.filterAgeValue();
        const op = this.filterAgeOp();
        if (age === null || age === undefined || Number.isNaN(Number(age))) {
            return this.searchedDemands();
        }
        const target = Number(age);
        return this.searchedDemands().filter(d => {
            const guests = (d as any)?.guests as any[] | undefined;
            if (!Array.isArray(guests) || guests.length === 0) return false;
            return guests.some(g => {
                const a = g?.age;
                if (typeof a !== 'number' || Number.isNaN(a)) return false;
                if (op === '>') return a > target;
                if (op === '<') return a < target;
                return a === target;
            });
        });
    });
    // --- computed pagination helpers
    filteredCount = computed(() => this.ageFilteredDemands().length);

    /**
     * Prix moyen du ticket basé sur:
     * total tickets encaissés / nombre total de tickets (guests) sur les demandes payées.
     */
    averageTicketPrice = computed<number | null>(() => {
        const totalTicketsAmount = Number(this.accounting()?.totalPaidFromDemands ?? 0);
        const totalPaidTickets = Number(
            (this.accounting()?.ticketsByPrice ?? []).reduce(
                (acc, t) => acc + Number(t?.ticketsSold ?? 0),
                0
            )
        );
        if (!totalPaidTickets || totalPaidTickets <= 0) {
            return null;
        }

        return totalTicketsAmount / totalPaidTickets;
    });

    totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredCount() / this.pageSize()))
    );
    pagedDemands = computed(() => {
        const p = this.page();
        const size = this.pageSize();
        const start = (p - 1) * size;
        return this.ageFilteredDemands().slice(start, start + size);
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

    // --- guests agrégés (toutes demandes confondues)
    allGuests = computed<EventGuestRow[]>(() => {
        const rows: EventGuestRow[] = [];
        for (const d of this.demandsRaw()) {
            if (!d.guests || d.guests.length === 0) continue;
            for (const g of d.guests) {
                rows.push({
                    firstName: g.firstName ?? '',
                    lastName: g.lastName ?? '',
                    email: g.email ?? '',
                    phoneNumber: g.phoneNumber ?? '',
                    age: typeof g.age === 'number' ? g.age : null,
                    isMainGuest: !!g.isMainGuest,
                    demandSlug: d.slug,
                    demandStatus: d.status,
                    demandType: d.type,
                    createdAt: d.createdAt,
                });
            }
        }
        return rows;
    });

    guestsTotal = computed(() => this.allGuests().length);

    guestsAvgAge = computed<number | null>(() => {
        const ages = this.allGuests()
            .map(g => g.age)
            .filter((a): a is number => typeof a === 'number' && !Number.isNaN(a));
        if (ages.length === 0) return null;
        const sum = ages.reduce((acc, a) => acc + a, 0);
        return sum / ages.length;
    });

    guestsTotalPages = computed(() =>
        Math.max(1, Math.ceil(this.guestsTotal() / this.guestsPageSize()))
    );

    pagedGuests = computed(() => {
        const p = this.guestsPage();
        const size = this.guestsPageSize();
        const start = (p - 1) * size;
        return this.allGuests().slice(start, start + size);
    });

    // pagination actions pour invités
    goToGuestsPage(p: number) {
        this.guestsPage.set(Math.min(Math.max(1, p), this.guestsTotalPages()));
    }
    prevGuestsPage() {
        this.goToGuestsPage(this.guestsPage() - 1);
    }
    nextGuestsPage() {
        this.goToGuestsPage(this.guestsPage() + 1);
    }

    changeGuestsPageSize(size: number) {
        this.guestsPageSize.set(size);
        this.guestsPage.set(1);
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

    setFilterAgeOp(op: '>' | '<' | '=') {
        this.filterAgeOp.set(op);
        this.page.set(1);
    }

    setFilterAgeValue(v: number | null) {
        const n = v === null || v === undefined ? null : Number(v);
        this.filterAgeValue.set(Number.isFinite(n as any) ? n : null);
        this.page.set(1);
    }
    resetFilters() {
        this.filterStatus.set(null);
        this.filterType.set(null);
        this.filterAgeOp.set('>');
        this.filterAgeValue.set(null);
        this.page.set(1);
        this.fetchDemands();
    }

    reload() {
        this.fetchDemands();
        this.loadStats();
        this.loadAccounting();
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
                // recharger stats + compta (si passage en PAYEE, le solde change)
                this.loadStats();
                this.loadAccounting();
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
                this.discountEditing.set(d.discountAmount ?? 0);
                this.guestDeletingId.set(null);
                this.guestDeleteError.set(null);
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
        this.discountEditing.set(0);
        this.discountError.set(null);
        this.discountSaving.set(false);
        this.guestDeletingId.set(null);
        this.guestDeleteError.set(null);
        this.guestDeleteOpen.set(false);
        this.guestDeleteTarget.set(null);
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
                // Mettre à jour la liste en local pour éviter de casser la pagination
                this.demandsRaw.update(arr =>
                    arr.map(x =>
                        x.slug === dd.slug
                            ? { ...x, status: DemandStatus.PAIEMENT_NOTIFIE }
                            : x
                    )
                );
                this.selectedDemand.update(prev =>
                    prev ? { ...prev, demandStatus: DemandStatus.PAIEMENT_NOTIFIE } : prev
                );

                // Ne pas recharger la liste (sinon pagination réinitialisée)
                // On rafraîchit uniquement les infos nécessaires (stats + compta header/onglets).
                this.loadStats();
                this.loadAccounting();
            },
            error: err => {
                this.submittingPayment.set(false);
                this.paymentError.set(err?.error?.message ?? 'Erreur lors de la notification de paiement.');
            }
        });
    }

    submitDiscount() {
        const dd = this.selectedDemand();
        if (!dd?.slug) return;
        if (dd.demandStatus === DemandStatus.PAYEE) {
            this.discountError.set('Impossible de modifier la remise : la demande est déjà PAYÉE.');
            return;
        }
        const value = Number(this.discountEditing() || 0);
        if (value < 0) {
            this.discountError.set('La remise ne peut pas être négative.');
            return;
        }
        this.discountSaving.set(true);
        this.discountError.set(null);
        this.demandService.updateDiscount(dd.slug, value).subscribe({
            next: () => {
                this.discountSaving.set(false);
                this.selectedDemand.update(prev => prev ? ({ ...prev, discountAmount: value }) : prev);
                // mettre à jour aussi le montant auto du paiement
                this.payAmount.set(this.modalAutoAmount());
            },
            error: err => {
                this.discountSaving.set(false);
                this.discountError.set(
                    err?.error?.message ?? 'Erreur lors de l’enregistrement de la remise.'
                );
            }
        });
    }

    openGuestDeleteConfirm(guestId: string, label?: string) {
        const dd = this.selectedDemand();
        if (!dd?.slug) return;
        if (dd.type !== DemandType.GROUP) return;
        if (dd.demandStatus === DemandStatus.PAYEE || dd.demandStatus === DemandStatus.OFFERT) {
            this.guestDeleteError.set("Impossible de supprimer un invité : la demande est déjà payée/offerte.");
            return;
        }
        const gid = String(guestId);
        const target = dd.guests?.find(g => String(g.id) === gid);
        if (target?.isMainGuest) {
            this.guestDeleteError.set("Impossible de supprimer l'invité principal.");
            return;
        }
        this.guestDeleteError.set(null);
        this.guestDeleteTarget.set({ id: gid, label });
        this.guestDeleteOpen.set(true);
    }

    cancelGuestDelete() {
        this.guestDeleteOpen.set(false);
        this.guestDeleteTarget.set(null);
    }

    confirmGuestDelete() {
        const t = this.guestDeleteTarget();
        if (!t) return;
        this.deleteGuestFromSelectedDemand(t.id, t.label);
    }

    private deleteGuestFromSelectedDemand(guestId: string, label?: string) {
        const dd = this.selectedDemand();
        if (!dd?.slug) return;
        if (dd.type !== DemandType.GROUP) return;
        if (dd.demandStatus === DemandStatus.PAYEE || dd.demandStatus === DemandStatus.OFFERT) {
            this.guestDeleteError.set("Impossible de supprimer un invité : la demande est déjà payée/offerte.");
            return;
        }
        const gid = String(guestId);
        const target = dd.guests?.find(g => String(g.id) === gid);
        if (target?.isMainGuest) {
            this.guestDeleteError.set("Impossible de supprimer l'invité principal.");
            return;
        }

        this.guestDeletingId.set(gid);
        this.guestDeleteError.set(null);

        this.demandService.deleteGuestFromGroupDemand(dd.slug, gid).subscribe({
            next: () => {
                this.guestDeletingId.set(null);
                this.guestDeleteOpen.set(false);
                this.guestDeleteTarget.set(null);
                // update modal demand
                this.selectedDemand.update(prev => {
                    if (!prev) return prev;
                    const nextGuests = (prev.guests ?? []).filter(g => String(g.id) !== gid);
                    const nextType = nextGuests.length <= 1 ? DemandType.UNIQUE : prev.type;
                    return { ...prev, guests: nextGuests, type: nextType };
                });
                // update list summary (guests + numberOfGuests)
                this.demandsRaw.update(arr =>
                    arr.map(x => {
                        if (x.slug !== dd.slug) return x;
                        const nextGuests = (x.guests ?? []).filter(g => String(g.id) !== gid);
                        return {
                            ...x,
                            guests: nextGuests,
                            numberOfGuests: nextGuests.length,
                            type: nextGuests.length <= 1 ? DemandType.UNIQUE : x.type,
                        };
                    })
                );
            },
            error: err => {
                this.guestDeletingId.set(null);
                this.guestDeleteError.set(
                    err?.error?.message ??
                    (label ? `Erreur lors de la suppression de ${label}.` : "Erreur lors de la suppression de l'invité.")
                );
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

    appliedModalPrice(): { amount: number; name?: string } | null {
        return this.modalActivePrice();
    }

    private modalActivePrice(): { amount: number; name?: string } | null {
        const ev = this.event() as FrontEvent | undefined;
        const prices = (ev?.prices ?? []) as Array<{
            id?: number;
            amount: number;
            name?: string;
            soldOut?: boolean;
            startDate: string | Date;
            endDate: string | Date;
        }>;
        const today = this.dateOnlyLocal(new Date());
        const active = prices.filter(p => {
            if (p.soldOut) return false;
            const s = this.dateOnlyLocal(p.startDate);
            const e = this.dateOnlyLocal(p.endDate);
            return s.getTime() <= today.getTime() && today.getTime() <= e.getTime();
        });
        const chosen = this.selectedDemand()?.price;
        if (chosen && !chosen.soldOut) {
            const chosenStart = this.dateOnlyLocal(chosen.startDate);
            const chosenEnd = this.dateOnlyLocal(chosen.endDate);
            const stillCurrent =
                chosenStart.getTime() <= today.getTime() &&
                today.getTime() <= chosenEnd.getTime();
            if (stillCurrent) {
                return { amount: Number(chosen.amount), name: chosen.name };
            }
            const byName = active.find(
                p => (p.name ?? '').trim().toLowerCase() === (chosen.name ?? '').trim().toLowerCase()
                    && !!(chosen.name ?? '').trim()
            );
            if (byName) return { amount: Number(byName.amount), name: byName.name };
        }
        if (active.length === 1) {
            return { amount: Number(active[0].amount), name: active[0].name };
        }
        return null;
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
        const dd = this.selectedDemand();
        const notified = dd?.payment?.amount;
        if (notified != null && Number(notified) > 0) {
            // Montant enregistré à la notification = pass + tables - remise
            const tables = this.modalTablesTotal();
            const discount =
                dd?.discountAmount ?? this.discountEditing() ?? 0;
            return Math.max(0, Number(notified) - tables + Number(discount));
        }
        const p = this.modalActivePrice();
        return p ? Number(p.amount) * this.modalPeopleCount() : 0;
    }

    getModalTotalPrice(): number {
        return this.getModalPassTotal() + this.getModalTablesTotal();
    }

    private modalAutoAmount(): number {
        const base = this.getModalTotalPrice();
        const discount = this.selectedDemand()?.discountAmount ?? this.discountEditing() ?? 0;
        const v = base - discount;
        return v > 0 ? v : 0;
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
                g.phoneNumber ?? ''
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

    // --- comptabilité: modales dépenses / entrées
    openExpenseModal() {
        this.expenseLabel.set('');
        this.expenseAmount.set(0);
        this.expenseNote.set('');
        this.accountingSaving.set(false);
        this.expenseModalOpen.set(true);
    }

    closeExpenseModal() {
        this.expenseModalOpen.set(false);
    }

    submitExpense() {
        const label = (this.expenseLabel() || '').trim();
        const amount = Number(this.expenseAmount());
        if (!label || !amount || amount <= 0 || !this.eventSlug) {
            return;
        }
        this.accountingSaving.set(true);
        this.eventService.addExpense(this.eventSlug, { label, amount, note: this.expenseNote() || undefined })
            .subscribe({
                next: () => {
                    this.accountingSaving.set(false);
                    this.expenseModalOpen.set(false);
                    this.loadAccounting();
                },
                error: () => {
                    this.accountingSaving.set(false);
                }
            });
    }

    openIncomeModal() {
        this.incomeLabel.set('');
        this.incomeAmount.set(0);
        this.incomeNote.set('');
        this.accountingSaving.set(false);
        this.incomeModalOpen.set(true);
    }

    closeIncomeModal() {
        this.incomeModalOpen.set(false);
    }

    submitIncome() {
        const label = (this.incomeLabel() || '').trim();
        const amount = Number(this.incomeAmount());
        if (!label || !amount || amount <= 0 || !this.eventSlug) {
            return;
        }
        this.accountingSaving.set(true);
        this.eventService.addIncome(this.eventSlug, { label, amount, note: this.incomeNote() || undefined })
            .subscribe({
                next: () => {
                    this.accountingSaving.set(false);
                    this.incomeModalOpen.set(false);
                    this.loadAccounting();
                },
                error: () => {
                    this.accountingSaving.set(false);
                }
            });
    }

    openMoneyDelete(type: 'expense' | 'income', id: number, label?: string) {
        this.moneyDeleteError.set(null);
        this.moneyDeleting.set(false);
        this.moneyDeleteTarget.set({ type, id, label });
        this.moneyDeleteOpen.set(true);
    }

    cancelMoneyDelete() {
        this.moneyDeleteOpen.set(false);
        this.moneyDeleteTarget.set(null);
        this.moneyDeleteError.set(null);
        this.moneyDeleting.set(false);
    }

    confirmMoneyDelete() {
        const target = this.moneyDeleteTarget();
        if (!target || !this.eventSlug) return;

        this.moneyDeleting.set(true);
        this.moneyDeleteError.set(null);

        const req =
            target.type === 'expense'
                ? this.eventService.deleteExpense(this.eventSlug, target.id)
                : this.eventService.deleteIncome(this.eventSlug, target.id);

        req.subscribe({
            next: () => {
                this.moneyDeleting.set(false);
                this.moneyDeleteOpen.set(false);
                this.moneyDeleteTarget.set(null);
                // recharger la compta (solde recalculé automatiquement)
                this.loadAccounting();
            },
            error: err => {
                this.moneyDeleting.set(false);
                this.moneyDeleteError.set(
                    err?.error?.message ?? 'Erreur lors de la suppression.'
                );
            }
        });
    }

}
