import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DemandService } from 'shared/services/demand/demand.service';
import { PaymentService } from 'shared/services/payment/payment.service'; // service minimal ci-dessous
import { Demand, DemandStatus, DemandType } from 'shared/models/demand';
import { Event as FrontEvent } from 'shared/models/event';
import { Price as FrontPrice } from 'shared/models/price';
import { EventService } from '../../../../../shared/services/event/event.service';
import { PaymentCanal,PaymentPlace } from '../../../../../shared/models/payment';
import { environment } from '../../../../../environments/environment';

type PlaceInfo = {
    key?: PaymentPlace;
    name: string;
    address: string;
    mapUrl: string;
};

@Component({
  selector: 'app-public-event-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './public-event-detail.component.html',
  styleUrl: './public-event-detail.component.scss'
})
export class PublicEventDetailComponent implements OnInit {

    readonly cashPlaces: PlaceInfo[] = [
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
    ];

    mainGuestLabel = computed(() => {
        const d = this.demand();
        const main = d?.guests?.find(g => g.isMainGuest) ?? d?.guests?.[0];
        if (!main) return '';
        const fullName = [main.firstName, main.lastName].filter(Boolean).join(' ');
        return `${fullName}${main.email ? ' — ' + main.phoneNumber : ''}`;
    });

    readonly orangeMoneyNumber = environment.orangeMoneyNumber ?? '';
    readonly orangeMoneyQrUrl= environment.orangeMoneyQrUrl; // facultatif si tu préfères l’injecter depuis le parent

    // ✅ 2) Lien Wave (montant dynamique)
    wavePayUrl() {
        const amt = Math.max(0, Math.round(this.totalAmount()+(this.totalAmount()*0.1) || 0));
        const base = 'https://pay.wave.com/m/M_sn_Sl2Ujzz-WzTu/c/sn/';
        return `${base}?amount=${amt}`;
    }

    showOrangeMoneyBlock() {
        return !!this.orangeMoneyNumber && (this.totalAmount() || 0) > 0;
    }

    private route = inject(ActivatedRoute);
    private demandService = inject(DemandService);
    private paymentService = inject(PaymentService);
    private fb = new FormBuilder();
    private eventService = inject(EventService); // Juste pour le type Event

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
        paymentPlace: [null as PaymentPlace | null]  //
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
                        const amt = this.totalAmount();
                        this.form.controls.amount.setValue(amt);
                        this.loading.set(false);
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

    peopleCount = computed(() => this.demand()?.guests?.length ?? 0);

    private dateOnly(d: Date | string) {
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    activePrice = computed<FrontPrice | null>(() => {
        const ev = this.event() as FrontEvent | undefined;
        console.log("Calcul prix actif pour event", ev);
        if (!ev?.prices?.length) return null;
        const today = this.dateOnly(new Date());
        return ev.prices.find(p => this.dateOnly(p.startDate) <= today && today <= this.dateOnly(p.endDate)) ?? null;
    });

    tablesTotal = computed(() => {
        const d = this.demand();
        if (!d?.tableItems?.length) return 0;
        return d.tableItems.reduce((sum, item) => {
            return sum + (item.table.amount * item.quantity);
        }, 0);
    });

    totalAmount = computed(() => {
        const ap = this.activePrice();
        const n = this.peopleCount();
        const participantsTotal = ap ? ap.amount * n : 0;
        return participantsTotal + this.tablesTotal();
    });

    canNotify() {
        // Si pas de prix actif, laisser l'utilisateur notifier avec 0 ? On préfère bloquer.
        return (this.activePrice() !== null) && this.peopleCount() > 0;
    }

    resetForm() {
        this.form.reset({ amount: this.totalAmount(), phoneNumber: '', paymentCanal: 'WAVE' });
        this.successMsg.set(null);
        this.errorMsg.set(null);
    }

    onSubmit() {
        if (!this.demand()?.slug) return;
        this.successMsg.set(null);
        this.errorMsg.set(null);

        const safeAmount = this.totalAmount();
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
                case PaymentPlace.GROOV:
                case PaymentPlace.FITLAB:
                    paymentPlaceValue = this.form.controls.paymentPlace.value as PaymentPlace;
                    break;
            }
        }

        const payload: any = {
            demandSlug: this.demand()!.slug,
            amount: safeAmount,
            paymentCanal: paymentC
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
