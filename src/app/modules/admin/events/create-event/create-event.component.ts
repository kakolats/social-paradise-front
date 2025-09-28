import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventService } from '../../../../../shared/services/event/event.service';

type PriceFG = FormGroup<{
    name: FormControl<string | null>;
    amount: FormControl<number | null>;
    startDate: FormControl<string | null>;
    endDate: FormControl<string | null>;
}>;

type EventFG = FormGroup<{
    name: FormControl<string | null>;
    date: FormControl<string | null>;// yyyy-MM-dd
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

    submitting = false;

    @Output() eventCreated = new EventEmitter<number>();

    form: EventFG = this.fb.group({
        name: this.fb.control<string | null>(null, { validators: [Validators.required, Validators.minLength(3)] }),
        date: this.fb.control<string | null>(null, { validators: [Validators.required] }),
        location: this.fb.control<string | null>(null, { validators: [Validators.required] }),
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

    rangeValid(p: PriceFG): boolean {
        const s = p.controls.startDate.value;
        const e = p.controls.endDate.value;
        if (!s || !e) return true;
        return new Date(e) >= new Date(s);
    }

    allRangesValid(): boolean {
        return this.prices().controls.every(p => this.rangeValid(p));
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
        if (this.form.invalid || !this.allRangesValid()) {
            this.submitting = false;
            return;
        }

        const f = this.form.value;
        const payload = {
            name: f.name!,
            date: new Date(f.date!),
            location: f.location!,
            prices: (f.prices ?? []).map(p => ({
                name: p!.name!,
                amount: Number(p!.amount),
                startDate: new Date(p!.startDate!),
                endDate: new Date(p!.endDate!),
            })),
        };
        //console.log(payload);

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
