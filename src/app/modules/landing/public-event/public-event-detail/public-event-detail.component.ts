import { CommonModule, DatePipe } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    OnDestroy,
    computed,
    inject,
    OnInit,
    signal,
    ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DemandService } from 'shared/services/demand/demand.service';
import { PaymentService } from 'shared/services/payment/payment.service'; // service minimal ci-dessous
import { Demand, DemandStatus, DemandType } from 'shared/models/demand';
import { Event as FrontEvent, EventPaymentMethod, EventCashPlace } from 'shared/models/event';
import { Price as FrontPrice } from 'shared/models/price';
import { EventService } from '../../../../../shared/services/event/event.service';
import { PaymentCanal, PaymentPlace } from '../../../../../shared/models/payment';
import { environment } from '../../../../../environments/environment';
import { setupLandingReveal } from '../../shared/landing-reveal';
import { Guest } from '../../../../../shared/models/guest';
import { TableItem } from '../../../../../shared/models/table';

type PlaceInfo = {
    key?: PaymentPlace;
    name: string;
    address: string;
    mapUrl?: string;
};

@Component({
  selector: 'app-public-event-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './public-event-detail.component.html',
  styleUrl: './public-event-detail.component.scss'
})
export class PublicEventDetailComponent implements OnInit, AfterViewInit, OnDestroy {

    private readonly baseCashPlaces: PlaceInfo[] = [
        {
            key: PaymentPlace.FITLAB,
            name: 'Fitlab',
            address: '14 Rue Carnot, Dakar',
            mapUrl: 'https://maps.app.goo.gl/3ziu4WkKkCYUBmzG7',
        },
        {
            key: PaymentPlace.HEMISPHERE,
            name: 'Hémisphère Voyages',
            address: '36 Rue Jules Ferry angle Joseph Gomis',
            mapUrl: 'https://maps.app.goo.gl/EHn1Vk87E9Sm92ND6',
        },
        {
            key: PaymentPlace.GROOV,
            name: 'Groov',
            address: "Place de l'Indépendance, Rue des Essarts, Dakar",
            mapUrl: 'https://maps.app.goo.gl/BNmZyLtt6MBy9aMG7',
        },
        {
            key: PaymentPlace.IROKO_BEACH,
            name: 'Iroko Beach Saly',
            address: "Résidence des cristallines, Saly",
            mapUrl: 'https://maps.app.goo.gl/wK2EYaMrseAdFocQA',
        },
    ];

    visibleCashPlaces = computed<PlaceInfo[]>(() => {
        const ev = this.event() as FrontEvent | null;
        const cfg = ev?.cashPlacesConfig as EventCashPlace[] | undefined;
        if (cfg && cfg.length) {
            return cfg.map(c => ({
                name: c.name,
                address: c.address,
                mapUrl: c.mapUrl,
            }));
        }
        // fallback: ancienne logique avec la liste en dur
        return this.baseCashPlaces;
    });

    paymentMethods = computed<EventPaymentMethod[]>(() => {
        const ev = this.event() as FrontEvent | null;
        return (ev?.paymentMethods ?? []) as EventPaymentMethod[];
    });

    mainGuestLabel = computed(() => {
        const d = this.demand();
        const main = d?.guests?.find(g => g.isMainGuest) ?? d?.guests?.[0];
        if (!main) return '';
        const fullName = [main.firstName, main.lastName].filter(Boolean).join(' ');
        return `${fullName}${main.email ? ' — ' + main.phoneNumber : ''}`;
    });

    readonly orangeMoneyNumber = environment.orangeMoneyNumber ?? '';
    readonly orangeMoneyQrUrl= environment.orangeMoneyQrUrl; // peut être utilisé en plus des numéros par event

    // ✅ 2) Lien Wave (montant dynamique)
    wavePayUrl() {
        const baseAmount = this.totalAfterDiscount();
        const amt = Math.max(0, Math.round(baseAmount + baseAmount * 0.01 || 0));
        const base = 'https://pay.wave.com/m/M_sn_Sl2Ujzz-WzTu/c/sn/';
        return `${base}?amount=${amt}`;
    }

    showOrangeMoneyBlock() {
        const ev = this.event() as FrontEvent | null;
        const methods = (ev?.paymentMethods ?? []) as EventPaymentMethod[];
        const hasOmMethod = methods.some(m =>
            m.canal === PaymentCanal.ORANGE_MONEY ||
            m.canal === 'ORANGE_MONEY' ||
            m.canal === 'Orange Money'
        );
        return hasOmMethod && (this.totalAmount() || 0) > 0;
    }

    canUseWave() {
        const ev = this.event() as FrontEvent | null;
        const methods = (ev?.paymentMethods ?? []) as EventPaymentMethod[];
        return methods.some(m => m.canal === PaymentCanal.WAVE || m.canal === 'WAVE');
    }

    canUseCash() {
        const ev = this.event() as FrontEvent | null;
        const allowCashFlag = (ev as any)?.allowCash;
        return allowCashFlag !== false;
    }

    private route = inject(ActivatedRoute);
    private demandService = inject(DemandService);
    private paymentService = inject(PaymentService);
    private fb = new FormBuilder();
    private eventService = inject(EventService); // Juste pour le type Event

    @ViewChild('pageRoot') private pageRoot?: ElementRef<HTMLElement>;
    private revealObserver?: IntersectionObserver;

    // state
    loading = signal(false);
    submitting = signal(false);
    globalError = signal<string | null>(null);
    successMsg = signal<string | null>(null);
    errorMsg = signal<string | null>(null);

    demand = signal<Demand | null>(null);
    event = signal<FrontEvent>(null);

    DemandStatus = DemandStatus;
    DemandType = DemandType;
    PaymentPlace = PaymentPlace;

    form = this.fb.group({
        amount: [{ value: 0, disabled: false }, [Validators.required, Validators.min(0)]],
        phoneNumber: ['', [Validators.required]],
        paymentCanal: ['WAVE', [Validators.required]],
        paymentPlace: [null as PaymentPlace | null]
    });

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug');
        if (!slug) {
            this.globalError.set('Slug de demande manquant.');
            return;
        }

        // 🔁 Rendez PaymentPlace obligatoire uniquement si CASH
        this.form.controls.paymentCanal.valueChanges.subscribe((val) => {
            if (val === 'CASH') {
                this.form.controls.paymentPlace.setValidators([Validators.required]);
                // Téléphone optionnel si CASH
                this.form.controls.phoneNumber.clearValidators();
            } else {
                this.form.controls.paymentPlace.clearValidators();
                this.form.controls.paymentPlace.setValue(null);
                // Téléphone requis pour WAVE / ORANGE_MONEY
                this.form.controls.phoneNumber.setValidators([Validators.required]);
            }
            this.form.controls.paymentPlace.updateValueAndValidity({ emitEvent: false });
            this.form.controls.phoneNumber.updateValueAndValidity({ emitEvent: false });
        });

        this.fetch(slug);
    }

    ngAfterViewInit(): void {
        this.setupRevealAnimations();
    }

    ngOnDestroy(): void {
        this.revealObserver?.disconnect();
    }

    trackGuest(_index: number, guest: Guest): string {
        return String(guest.email ?? guest.id ?? _index);
    }

    trackTableItem(_index: number, item: TableItem): string {
        return String(item.table?.id ?? item.table?.name ?? _index);
    }

    trackCashPlace(_index: number, place: PlaceInfo): string {
        return place.name;
    }

    private setupRevealAnimations(): void {
        const root = this.pageRoot?.nativeElement;
        if (!root) return;

        this.revealObserver = setupLandingReveal(root, this.revealObserver);
    }

    isCashSelected() {
        return this.form.controls.paymentCanal.value === 'CASH';
    }

    fetch(slug: string) {
        this.loading.set(true);
        this.globalError.set(null);
        this.demandService.getBySlug(slug).subscribe({
            next: (d) => {
                this.demand.set(d);
                // Set montant auto
                this.eventService.getBySlug(d.event.slug).subscribe({
                    next: (e) => {
                        this.event.set(e);
                        const amt = this.totalAfterDiscount();
                        this.form.controls.amount.setValue(amt);
                        this.loading.set(false);
                        window.setTimeout(() => this.setupRevealAnimations(), 0);
                    }
                })
            },
            error: (err) => {
                this.globalError.set(err?.error?.message ?? 'Impossible de charger la demande.');
                this.loading.set(false);
            }
        });
        this.eventService.getBySlug(slug).subscribe({

        })
    }

    // --- UI helpers
    statusClass(s?: DemandStatus | null) {
        switch (s) {
            case DemandStatus.SOUMISE: return 'bg-slate-900 text-white';
            case DemandStatus.VALIDEE: return 'bg-emerald-600 text-white';
            case DemandStatus.REFUSEE: return 'bg-rose-600 text-white';
            case DemandStatus.PAIEMENT_NOTIFIE: return 'bg-amber-500 text-white';
            case DemandStatus.PAYEE: return 'bg-indigo-600 text-white';
            default: return 'bg-slate-200 text-slate-700';
        }
    }

    isPaid() {
        return this.demand()?.demandStatus === DemandStatus.PAYEE;
    }

    isNotified() {
        return this.demand()?.demandStatus === DemandStatus.PAIEMENT_NOTIFIE;
    }

    isRejected(){
        return this.demand()?.demandStatus === DemandStatus.REFUSEE;
    }

    isOffered() {
        return this.demand()?.demandStatus === DemandStatus.OFFERT;
    }

    peopleCount = computed(() => this.demand()?.guests?.length ?? 0);

    private dateOnly(d: Date | string) {
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    private pickedPriceId = signal<number | null>(null);

    pricesToday = computed<FrontPrice[]>(() => {
        const ev = this.event() as FrontEvent | undefined;
        if (!ev?.prices?.length) return [];
        const today = this.dateOnly(new Date());
        return ev.prices.filter(p => this.coversDay(p, today));
    });

    needsPriceChoice = computed(() => {
        const todayPrices = this.pricesToday();
        if (todayPrices.length <= 1) return false;
        const chosen = this.demand()?.price;
        if (chosen && this.coversDay(chosen, this.dateOnly(new Date()))) return false;
        if (chosen && todayPrices.some(p => this.sameTariffName(p.name, chosen.name))) return false;
        return true;
    });

    activePrice = computed<FrontPrice | null>(() => this.resolvePriceForToday());

    tariffUpdated = computed(() => {
        const chosen = this.demand()?.price;
        const current = this.activePrice();
        return !!chosen && !!current && chosen.id !== current.id;
    });

    selectCurrentPrice(price: FrontPrice) {
        if (price.id == null) return;
        this.pickedPriceId.set(price.id);
    }

    private resolvePriceForToday(): FrontPrice | null {
        const todayPrices = this.pricesToday();
        const chosen = this.demand()?.price ?? null;
        const today = this.dateOnly(new Date());
        if (chosen && this.coversDay(chosen, today)) return chosen;

        const pickedId = this.pickedPriceId();
        if (pickedId != null) {
            const picked = todayPrices.find(p => p.id === pickedId);
            if (picked) return picked;
        }

        const byName = chosen
            ? todayPrices.find(p => this.sameTariffName(p.name, chosen.name))
            : undefined;
        if (byName) return byName;
        if (todayPrices.length === 1) return todayPrices[0];
        return null;
    }

    private coversDay(price: FrontPrice, day: Date): boolean {
        if (price.soldOut) return false;
        return this.dateOnly(price.startDate) <= day && day <= this.dateOnly(price.endDate);
    }

    private sameTariffName(a?: string | null, b?: string | null): boolean {
        return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase() && !!(a ?? '').trim();
    }

    tablesTotal = computed(() => {
        const d = this.demand();
        if (!d?.tableItems?.length) return 0;
        return d.tableItems.reduce((sum, item) => {
            return sum + (item.table.amount * item.quantity);
        }, 0);
    });

    discountAmount = computed(() => {
        const d: any = this.demand();
        const raw = Number(d?.discountAmount ?? 0);
        return Number.isFinite(raw) ? Math.max(0, raw) : 0;
    });

    totalAmount = computed(() => {
        const ap = this.activePrice();
        const n = this.peopleCount();
        const participantsTotal = ap ? Number(ap.amount) * n : 0;
        return participantsTotal + this.tablesTotal();
    });

    totalAfterDiscount = computed(() => {
        const total = Number(this.totalAmount() ?? 0);
        const discount = Number(this.discountAmount() ?? 0);
        return Math.max(0, total - discount);
    });

    canNotify() {
        // Si pas de prix actif, laisser l'utilisateur notifier avec 0 ? On préfère bloquer.
        return (this.activePrice() !== null) && this.peopleCount() > 0;
    }

    resetForm() {
        this.form.reset({ amount: this.totalAfterDiscount(), phoneNumber: '', paymentCanal: 'WAVE' });
        this.successMsg.set(null);
        this.errorMsg.set(null);
    }

    onSubmit() {
        if (!this.demand()?.slug || this.isOffered()) return;
        this.successMsg.set(null);
        this.errorMsg.set(null);

        const safeAmount = this.totalAfterDiscount();
        this.form.controls.amount.setValue(safeAmount);

        if (this.form.invalid || !this.canNotify()) {
            this.errorMsg.set('Formulaire invalide ou aucun tarif actif.');
            return;
        }

        let paymentC: PaymentCanal | undefined;
        switch (this.form.controls.paymentCanal.value) {
            case 'WAVE': paymentC = PaymentCanal.WAVE; break;
            case 'ORANGE_MONEY': paymentC = PaymentCanal.ORANGE_MONEY; break;
            case 'CASH': paymentC = PaymentCanal.CASH; break;
        }

        // Mapper PaymentPlace si CASH
        let paymentPlaceValue: PaymentPlace | undefined;
        if (paymentC === PaymentCanal.CASH) {
            switch (this.form.controls.paymentPlace.value) {
                case PaymentPlace.HEMISPHERE:
                case PaymentPlace.IROKO_BEACH:
                case PaymentPlace.GROOV:
                case PaymentPlace.FITLAB:
                    paymentPlaceValue = this.form.controls.paymentPlace.value as PaymentPlace;
                    break;
            }
        }

        // Le montant affiché est indicatif : l'API le recalcule elle-même
        const payload: any = {
            demandSlug: this.demand()!.slug,
            paymentCanal: paymentC,
            priceId: this.activePrice()?.id,
        };
        const phoneVal = this.form.controls.phoneNumber.value;
        if (phoneVal) {
            payload.phoneNumber = phoneVal;
        }
        if (paymentPlaceValue) payload.paymentPlace = paymentPlaceValue;

        this.submitting.set(true);
        this.paymentService.notify(payload).subscribe({
            next: () => {
                this.submitting.set(false);
                this.successMsg.set('Votre notification de paiement a été enregistrée. Elle sera vérifiée par un administrateur.');
            },
            error: (err) => {
                this.submitting.set(false);
                this.errorMsg.set(err?.error?.message ?? 'Erreur lors de la notification de paiement.');
            }
        });
    }
}
