import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventService } from '../../../../../shared/services/event/event.service';
import { Event } from '../../../../../shared/models/event';
import { Price } from '../../../../../shared/models/price';
import { ActivatedRoute } from '@angular/router';

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
export class CreateEventComponent implements OnInit, OnChanges {
    private fb = new FormBuilder();
    private eventService = inject(EventService);
    private route = inject(ActivatedRoute);

    /** Si renseigné, le composant passe en mode "édition" et met à jour cet event */
    eventToEdit?: Event;

    @Output() eventCreated = new EventEmitter<number>();
    @Output() eventUpdated = new EventEmitter<number>();

    submitting = false;

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

    ngOnInit(): void {
        const idParam = this.route.snapshot.paramMap.get('slug');
        if (idParam) {
            const id = String(idParam);
            this.eventService.getBySlug(id).subscribe(evt => {
                this.eventToEdit = evt;
                this.fillFormFromEvent(evt); // ta méthode existante
            });
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['eventToEdit'] && changes['eventToEdit'].currentValue) {
            this.fillFormFromEvent(changes['eventToEdit'].currentValue as Event);
        }
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
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
        const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    }

    // ---------- Form utils
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

    // ---------- Validations
    /** Règle 1: start <= end */
    rangeValid(p: PriceFG): boolean {
        const s = this.parseLocalDateStr(p.controls.startDate.value);
        const e = this.parseLocalDateStr(p.controls.endDate.value);
        if (!s || !e) return true;
        return this.compareDates(s, e) <= 0;
    }
    allRangesValid(): boolean {
        return this.prices().controls.every(p => this.rangeValid(p));
    }

    /** Règle 2 (tous): endDate ≤ date de l’évènement */
    endAfterEvent(i: number): boolean {
        const eventDate = this.parseLocalDateStr(this.form.controls.date.value);
        if (!eventDate) return false;
        const price = this.prices().at(i);
        const end = this.parseLocalDateStr(price.controls.endDate.value);
        if (!end) return false;
        return this.compareDates(end, eventDate) === 1;
    }

    /** Règle 3 (i>=1): startDate(i) > endDate(i-1) */
    startNotAfterPrevEnd(i: number): boolean {
        if (i === 0) return false;
        const prev = this.prices().at(i - 1);
        const cur = this.prices().at(i);
        const prevEnd = this.parseLocalDateStr(prev.controls.endDate.value);
        const curStart = this.parseLocalDateStr(cur.controls.startDate.value);
        if (!prevEnd || !curStart) return false;
        return this.compareDates(curStart, prevEnd) <= 0; // invalide si <=
    }

    allBusinessValid(): boolean {
        const len = this.prices().length;
        if (len === 0) return true;
        for (let i = 0; i < len; i++) {
            if (this.endAfterEvent(i)) return false;
        }
        for (let i = 1; i < len; i++) {
            if (this.startNotAfterPrevEnd(i)) return false;
        }
        return true;
    }

    // ---------- Fill form in edit mode
    private toDateInputValue(d: string | Date | null | undefined): string | null {
        if (!d) return null;
        const dt = typeof d === 'string' ? new Date(d) : d;
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const da = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
    }

    private fillFormFromEvent(evt: Event) {
        // reset d'abord
        this.form.reset();
        this.prices().clear();

        this.form.patchValue({
            name: evt.name ?? null,
            date: this.toDateInputValue(evt.date as any) ?? null,
            location: (evt as any).location ?? null
        });

        (evt.prices ?? []).forEach((p: Price) => {
            const fg = this.makePrice();
            fg.patchValue({
                name: p.name ?? null,
                amount: p.amount ?? null,
                startDate: this.toDateInputValue(p.startDate as any),
                endDate: this.toDateInputValue(p.endDate as any),
            });
            this.prices().push(fg);
        });
    }

    // ---------- Submit
    reset() {
        if (this.eventToEdit) {
            // En mode édition, reset = recharger les valeurs de l’event
            this.fillFormFromEvent(this.eventToEdit);
        } else {
            // Mode création
            this.form.reset();
            this.prices().clear();
        }
        this._createdMessage = '';
        this._errorMessage = '';
        this.submitting = false;
    }

    private buildPayloadFromForm() {
        const f = this.form.value;
        return {
            name: f.name!,
            date: new Date(f.date!), // laisser EventService.serializeEvent gérer le format
            location: f.location!,
            prices: (f.prices ?? []).map(p => ({
                name: p!.name!,
                amount: Number(p!.amount),
                startDate: new Date(p!.startDate!),
                endDate: new Date(p!.endDate!),
            })),
        };
    }

    onSubmit() {
        this._createdMessage = '';
        this._errorMessage = '';
        this.submitting = true;

        this.form.markAllAsTouched();

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

        const payload = this.buildPayloadFromForm();

        // ---- MODE EDITION ----
        if (this.eventToEdit?.id) {
            this.eventService.update(this.eventToEdit.slug, payload as Partial<Event>).subscribe({
                next: (evt) => {
                    this._createdMessage = `Événement mis à jour avec succès${evt?.id ? ` (id: ${evt.id})` : ''}.`;
                    this.eventUpdated.emit(evt?.id ?? this.eventToEdit!.id);
                    this.submitting = false;
                },
                error: (err) => {
                    this._errorMessage = err?.error?.message ?? 'Erreur lors de la mise à jour.';
                    this.submitting = false;
                }
            });
            return;
        }

        // ---- MODE CREATION ----
        this.eventService.create(payload as any).subscribe({
            next: (evt) => {
                this._createdMessage = `Événement créé avec succès${evt?.id ? ` (id: ${evt.id})` : ''}.`;
                this.eventCreated.emit(evt?.id ?? 0);
                this.submitting = false;
            },
            error: (err) => {
                this._errorMessage = err?.error?.message ?? 'Erreur lors de la création.';
                this.submitting = false;
            }
        });
    }
}
