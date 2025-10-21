import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventService } from '../../../../../shared/services/event/event.service';
import { Router } from '@angular/router';

type PriceFG = FormGroup<{
    name: FormControl<string | null>;
    amount: FormControl<number | null>;
    startDate: FormControl<string | null>;
    endDate: FormControl<string | null>;
}>;

type EventFG = FormGroup<{
    name: FormControl<string | null>;
    date: FormControl<string | null>; // yyyy-MM-dd
    location: FormControl<string | null>;
    prices: FormArray<PriceFG>;
}>;

@Component({
    selector: 'app-create-event',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './create-event.component.html',
    styleUrl: './create-event.component.scss'
})
export class CreateEventComponent {
    private fb = new FormBuilder();
    private eventService = inject(EventService);
    private router = inject(Router);

    submitting = false;

    @Output() eventCreated = new EventEmitter<number>();

    form: EventFG = this.fb.group({
        name: this.fb.control<string | null>(null, { validators: [Validators.required, Validators.minLength(3)] }),
        date: this.fb.control<string | null>(null, { validators: [Validators.required] }),
        location: this.fb.control<string | null>(null, { validators: [Validators.required, Validators.minLength(3)] }),
        prices: this.fb.array<PriceFG>([])
    });

    createdMessage = computed(() => this._createdMessage);
    errorMessage = computed(() => this._errorMessage);
    private _createdMessage = '';
    private _errorMessage = '';

    prices(): FormArray<PriceFG> {
        return this.form.controls.prices;
    }

    trackByIndex = (i: number) => i;

    private makePrice(): PriceFG {
        return this.fb.group({
            name: this.fb.control<string | null>(null, { validators: [Validators.required] }),
            amount: this.fb.control<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
            startDate: this.fb.control<string | null>(null, { validators: [Validators.required] }),
            endDate: this.fb.control<string | null>(null, { validators: [Validators.required] }),
        });
    }

    addPrice() { this.prices().push(this.makePrice()); }
    removePrice(i: number) { this.prices().removeAt(i); }

    invalid(ctrl: keyof EventFG['controls']): boolean {
        const c = this.form.controls[ctrl] as FormControl | FormArray;
        return !!c && (c.touched || this.submitting) && c.invalid;
    }

    // ---------- Helpers dates (local, sans UTC shift)
    private parseLocalDateStr(str: string | null | undefined): Date | null {
        if (!str) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
        if (!m) return null;
        const y = +m[1], mo = +m[2], d = +m[3];
        return new Date(y, mo - 1, d); // local date
    }
    private compareDates(a?: Date | null, b?: Date | null): number {
        // retourne -1 / 0 / 1 comme compareTo ; null est traité comme +∞ pour éviter faux positifs
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
        const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    }

    // ---------- Règle 1 : start <= end (déjà là)
    rangeValid(p: PriceFG): boolean {
        const s = this.parseLocalDateStr(p.controls.startDate.value);
        const e = this.parseLocalDateStr(p.controls.endDate.value);
        if (!s || !e) return true;
        return this.compareDates(s, e) <= 0;
    }

    allRangesValid(): boolean {
        return this.prices().controls.every(p => this.rangeValid(p));
    }

    // ---------- Règles métier supplémentaires
    /** true si endDate du prix i est > date event (donc invalide) */
    endAfterEvent(i: number): boolean {
        const eventDate = this.parseLocalDateStr(this.form.controls.date.value);
        if (!eventDate) return false; // on laisse la validation "date event" gérer
        const price = this.prices().at(i);
        const end = this.parseLocalDateStr(price.controls.endDate.value);
        if (!end) return false;
        return this.compareDates(end, eventDate) === 1; // end > eventDate
    }

    /** true si startDate du prix i n'est pas strictement > endDate du prix i-1 (donc invalide) */
    startNotAfterPrevEnd(i: number): boolean {
        if (i === 0) return false;
        const prev = this.prices().at(i - 1);
        const cur = this.prices().at(i);
        const prevEnd = this.parseLocalDateStr(prev.controls.endDate.value);
        const curStart = this.parseLocalDateStr(cur.controls.startDate.value);
        if (!prevEnd || !curStart) return false;
        return this.compareDates(curStart, prevEnd) <= 0; // curStart <= prevEnd -> invalide (doit être strictement >)
    }

    /** Toutes les règles métier (R2/R3) sont-elles satisfaites ? */
    allBusinessValid(): boolean {
        const len = this.prices().length;
        if (len === 0) return true;
        // R2: tous endDate <= eventDate
        for (let i = 0; i < len; i++) {
            if (this.endAfterEvent(i)) return false;
        }
        // R3: pour i>=1, startDate > endDate du précédent
        for (let i = 1; i < len; i++) {
            if (this.startNotAfterPrevEnd(i)) return false;
        }
        return true;
    }

    reset() {
        this.form.reset();
        this.prices().clear();
        this._createdMessage = '';
        this._errorMessage = '';
    }

    onSubmit() {
        this._createdMessage = '';
        this._errorMessage = '';
        this.submitting = true;

        this.form.markAllAsTouched();

        // validations
        if (this.form.invalid || !this.allRangesValid() || !this.allBusinessValid()) {
            this.submitting = false;
            if (!this.form.controls.date.value) {
                this._errorMessage = 'Veuillez renseigner la date de l’événement.';
            } else if (!this.allRangesValid()) {
                this._errorMessage = 'Chaque prix doit avoir une date de fin supérieure ou égale à sa date de début.';
            } else {
                this._errorMessage = 'Vérifiez les dates des prix : respect de la date de l’événement et ordre strict entre les plages.';
            }
            return;
        }

        const f = this.form.value;
        const payload = {
            name: f.name!,
            date: new Date(f.date!), // backend acceptera "2025-12-31T00:00:00"
            location: f.location!,
            prices: (f.prices ?? []).map(p => ({
                name: p!.name!,
                amount: Number(p!.amount),
                startDate: new Date(p!.startDate!),
                endDate: new Date(p!.endDate!),
            })),
        };

        this.eventService.create(payload as any).subscribe({
            next: (evt) => {
                this._createdMessage = `Événement créé avec succès${evt?.id ? ` (id: ${evt.id})` : ''}.`;
                this.eventCreated.emit(evt?.id ?? 0);
                this.submitting = false;
                //redirection
                this.router.navigate(['/events/event-list']);

            },
            error: (err) => {
                this._errorMessage = err?.error?.message ?? 'Erreur lors de la création.';
                this.submitting = false;
            }
        });
    }
}
