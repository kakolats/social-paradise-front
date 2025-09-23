import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { DemandService } from 'shared/services/demand/demand.service';
import { PaymentService } from 'shared/services/payment/payment.service'; // service minimal ci-dessous
import { Demand, DemandStatus, DemandType } from 'shared/models/demand';
import { Event as FrontEvent } from 'shared/models/event';
import {  Price as FrontPrice } from 'shared/models/price';

@Component({
  selector: 'app-public-event-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './public-event-detail.component.html',
  styleUrl: './public-event-detail.component.scss'
})
export class PublicEventDetailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private demandService = inject(DemandService);
    private paymentService = inject(PaymentService);
    private fb = new FormBuilder();

    // state
    loading = signal(false);
    submitting = signal(false);
    globalError = signal<string | null>(null);
    successMsg = signal<string | null>(null);
    errorMsg = signal<string | null>(null);

    demand = signal<Demand | null>(null);

    DemandStatus = DemandStatus;
    DemandType = DemandType;

    form = this.fb.group({
        amount: [{ value: 0, disabled: false }, [Validators.required, Validators.min(0)]],
        phoneNumber: ['', [Validators.required]],
        paymentCanal: ['WAVE', [Validators.required]],
    });

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug');
        if (!slug) {
            this.globalError.set('Slug de demande manquant.');
            return;
        }
        this.fetch(slug);
    }

    fetch(slug: string) {
        this.loading.set(true);
        this.globalError.set(null);
        this.demandService.getBySlug(slug).subscribe({
            next: (d) => {
                this.demand.set(d);
                // Set montant auto
                const amt = this.totalAmount();
                this.form.controls.amount.setValue(amt);
                this.loading.set(false);
            },
            error: (err) => {
                this.globalError.set(err?.error?.message ?? 'Impossible de charger la demande.');
                this.loading.set(false);
            }
        });
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

    peopleCount = computed(() => this.demand()?.guests?.length ?? 0);

    private dateOnly(d: Date | string) {
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    activePrice = computed<FrontPrice | null>(() => {
        const ev = this.demand()?.event as FrontEvent | undefined;
        if (!ev?.prices?.length) return null;
        const today = this.dateOnly(new Date());
        return ev.prices.find(p => this.dateOnly(p.startDate) <= today && today <= this.dateOnly(p.endDate)) ?? null;
    });

    totalAmount = computed(() => {
        const ap = this.activePrice();
        const n = this.peopleCount();
        return ap ? ap.amount * n : 0;
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

        // Recalcule le montant avant envoi pour éviter toute manipulation
        const safeAmount = this.totalAmount();
        this.form.controls.amount.setValue(safeAmount);

        if (this.form.invalid || !this.canNotify()) {
            this.errorMsg.set("Formulaire invalide ou aucun tarif actif.");
            return;
        }

        const payload = {
            demandSlug: this.demand()!.slug,
            amount: safeAmount,
            phoneNumber: this.form.controls.phoneNumber.value!,
            paymentCanal: this.form.controls.paymentCanal.value!, // "WAVE" | "ORANGE_MONEY"
        };

        this.submitting.set(true);
        // @ts-ignore
        this.paymentService.notify(payload).subscribe({
            next: () => {
                this.submitting.set(false);
                this.successMsg.set("Votre notification de paiement a été enregistrée. Elle sera vérifiée par un administrateur.");
            },
            error: (err) => {
                this.submitting.set(false);
                this.errorMsg.set(err?.error?.message ?? "Erreur lors de la notification de paiement.");
            }
        });
    }
}
