import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { EventService } from '../../../../shared/services/event/event.service';
import { DemandService, CreateDemandPayload } from '../../../../shared/services/demand/demand.service';

import { Event as FrontEvent } from '../../../../shared/models/event';
import { DemandStatus } from '../../../../shared/models/demand';
import { Guest as FrontGuest } from '../../../../shared/models/guest';
import { Table } from '../../../../shared/models/table';

import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';
import { QuillViewComponent, QuillViewHTMLComponent } from 'ngx-quill';

type ParticipantFG = FormGroup<{
    firstName: FormControl<string | null>;
    lastName: FormControl<string | null>;
    email: FormControl<string | null>;
    phoneNumber: FormControl<string | null>;
    age: FormControl<number | null>;
    isMainGuest: FormControl<boolean | null>;
}>;

type TableSelectionFG = FormGroup<{
    tableId: FormControl<number | null>;
    quantity: FormControl<number | null>;
}>;

type DemandFG = FormGroup<{
    mode: FormControl<'single' | 'group'>;
    // single
    s_firstName: FormControl<string | null>;
    s_lastName: FormControl<string | null>;
    s_email: FormControl<string | null>;
    s_phoneNumber: FormControl<string | null>;
    s_age: FormControl<number | null>;
    // group
    participants: FormArray<ParticipantFG>;
    tableSelections: FormArray<TableSelectionFG>;
}>;

@Component({
    selector: 'app-public-event',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        DatePipe,
        QuillViewHTMLComponent,
        QuillViewComponent,
    ],
    templateUrl: './public-event.component.html',
    styleUrl: './public-event.component.scss',
})
export class PublicEventComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private eventService = inject(EventService);
    private demandService = inject(DemandService);
    private fb = new FormBuilder();

    event = signal<FrontEvent | null>(null);
    loading = signal<boolean>(false);
    errorMsg = signal<string | null>(null);
    successMsg = signal<string | null>(null);

    placeholder =  '';

    form: DemandFG = this.fb.group({
        mode: this.fb.control<'single' | 'group'>('single', {
            nonNullable: true,
        }),
        s_firstName: this.fb.control<string | null>(null, [
            Validators.required,
        ]),
        s_lastName: this.fb.control<string | null>(null, [Validators.required]),
        s_email: this.fb.control<string | null>(null, [
            Validators.required,
            Validators.email,
        ]),
        s_phoneNumber: this.fb.control<string | null>(null, [
            Validators.required,
        ]),
        s_age: this.fb.control<number | null>(null, [
            Validators.required,
            Validators.min(0),
        ]),
        participants: this.fb.array<ParticipantFG>([]),
        tableSelections: this.fb.array<TableSelectionFG>([]),
    });

    ngOnInit() {
        const slug = this.route.snapshot.paramMap.get('slug');
        if (slug) this.fetchEvent(slug);

        this.form.controls.mode.valueChanges.subscribe((mode) => {
            if (mode === 'single') {
                this.participants().clear();
                this.form.controls.s_firstName.addValidators([
                    Validators.required,
                ]);
                this.form.controls.s_lastName.addValidators([
                    Validators.required,
                ]);
                this.form.controls.s_email.addValidators([
                    Validators.required,
                    Validators.email,
                ]);
                this.form.controls.s_phoneNumber.addValidators([
                    Validators.required,
                ]);
                this.form.controls.s_age.addValidators([
                    Validators.required,
                    Validators.min(0),
                ]);
            } else {
                this.form.controls.s_firstName.clearValidators();
                this.form.controls.s_firstName.reset();
                this.form.controls.s_lastName.clearValidators();
                this.form.controls.s_lastName.reset();
                this.form.controls.s_email.clearValidators();
                this.form.controls.s_email.reset();
                this.form.controls.s_phoneNumber.clearValidators();
                this.form.controls.s_phoneNumber.reset();
                this.form.controls.s_age.clearValidators();
                this.form.controls.s_age.reset();
                if (this.participants().length === 0) this.addParticipant(true);
            }
            this.form.updateValueAndValidity({ emitEvent: false });
        });
    }

    fetchEvent(slug: string) {
        this.loading.set(true);
        this.errorMsg.set(null);
        this.eventService.getBySlug(slug).subscribe({
            next: (evt) => {
                this.event.set(evt);
                this.loading.set(false);
                if (evt.coverImage) {
                    this.placeholder = evt.coverImage;
                }
            },
            error: (err) => {
                this.errorMsg.set(
                    err?.error?.message ?? "Impossible de charger l'évènement."
                );
                this.loading.set(false);
            },
        });
    }

    activePrice = computed(() => {
        const e = this.event();
        if (!e?.prices?.length) return null;
        const today = this.dateOnly(new Date());
        return (
            e.prices.find(
                (p) =>
                    this.dateOnly(p.startDate) <= today &&
                    today <= this.dateOnly(p.endDate)
            ) || null
        );
    });

    isActivePrice(p: any) {
        const ap = this.activePrice();
        if (!ap) return false;
        return (
            this.dateOnly(ap.startDate).getTime() ===
                this.dateOnly(p.startDate).getTime() &&
            this.dateOnly(ap.endDate).getTime() ===
                this.dateOnly(p.endDate).getTime() &&
            ap.amount === p.amount
        );
    }

    private dateOnly(d: Date | string): Date {
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

    participants(): FormArray<ParticipantFG> {
        return this.form.get('participants') as FormArray<ParticipantFG>;
    }
    private makeParticipant(isMain = false): ParticipantFG {
        return this.fb.group({
            firstName: this.fb.control<string | null>(null, [
                Validators.required,
            ]),
            lastName: this.fb.control<string | null>(null, [
                Validators.required,
            ]),
            email: this.fb.control<string | null>(null, [
                Validators.required,
                Validators.email,
            ]),
            phoneNumber: this.fb.control<string | null>(null, [
                Validators.required,
            ]),
            age: this.fb.control<number | null>(null, [
                Validators.required,
                Validators.min(0),
            ]),
            isMainGuest: this.fb.control<boolean | null>(isMain),
        });
    }
    addParticipant(isMain = false) {
        this.participants().push(this.makeParticipant(isMain));
    }
    addMany(n: number) {
        for (let i = 0; i < n; i++) this.addParticipant(false);
    }
    removeParticipant(i: number) {
        const wasMain =
            this.participants().at(i).controls.isMainGuest.value === true;
        this.participants().removeAt(i);
        if (wasMain && this.participants().length > 0)
            this.participants().at(0).controls.isMainGuest.setValue(true);
    }
    markAsMainGuest(index: number) {
        this.participants().controls.forEach((fg, i) =>
            fg.controls.isMainGuest.setValue(i === index)
        );
    }
    hasExactlyOneMainGuest(): boolean {
        return (
            this.participants().controls.filter(
                (fg) => fg.controls.isMainGuest.value === true
            ).length === 1
        );
    }

    peopleCount = toSignal(
        this.form.valueChanges.pipe(
            startWith(this.form.value),
            map((v) =>
                v.mode === 'single' ? 1 : this.participants().length || 0
            )
        ),
        { initialValue: 1 }
    );

    tableSelections(): FormArray<TableSelectionFG> {
        return this.form.get('tableSelections') as FormArray<TableSelectionFG>;
    }
    private makeTableSelection(
        tableId: number,
        initialQty = 1
    ): TableSelectionFG {
        return this.fb.group({
            tableId: this.fb.control<number | null>(tableId, {
                validators: [Validators.required],
            }),
            quantity: this.fb.control<number | null>(initialQty, {
                validators: [Validators.required, Validators.min(1)],
            }),
        });
    }
    private findSelectionIndex(tableId: number): number {
        return this.tableSelections().controls.findIndex(
            (s) => Number(s.controls.tableId.value) === Number(tableId)
        );
    }
    isTableSelected(tableId: number): boolean {
        return this.findSelectionIndex(tableId) !== -1;
    }
    toggleTable(tableId: number) {
        const idx = this.findSelectionIndex(tableId);
        if (idx === -1) {
            this.tableSelections().push(this.makeTableSelection(tableId, 1));
        } else {
            this.tableSelections().removeAt(idx);
        }
        this.form.updateValueAndValidity({ emitEvent: true });
    }
    setTableQty(tableId: number, qty: number, max?: number) {
        const idx = this.findSelectionIndex(tableId);
        if (idx === -1) return;
        let q = Math.max(1, Math.floor(Number(qty) || 1));
        if (typeof max === 'number' && max > 0) q = Math.min(q, max);
        this.tableSelections()
            .at(idx)
            .controls.quantity.setValue(q, { emitEvent: true });
    }
    getTableQty(tableId: number): number {
        const idx = this.findSelectionIndex(tableId);
        return idx === -1
            ? 1
            : Number(this.tableSelections().at(idx).controls.quantity.value) ||
                  1;
    }

    invalid(ctrl: keyof DemandFG['controls']): boolean {
        const c = this.form.controls[ctrl] as FormControl | FormArray;
        return !!c && c.invalid && (c.touched || c.dirty);
    }

    tablesTotal = toSignal(
        this.form.valueChanges.pipe(
            startWith(this.form.value),
            map(() => {
                const e = this.event();
                if (!e?.tables?.length) return 0;
                return this.tableSelections().controls.reduce((sum, s) => {
                    const tid = Number(s.controls.tableId.value);
                    const qty = Number(s.controls.quantity.value) || 0;
                    const t = e.tables!.find((tt) => Number(tt.id) === tid);
                    return sum + (t ? t.amount * qty : 0);
                }, 0);
            })
        ),
        { initialValue: 0 }
    );

    tablesCount = toSignal(
        this.form.valueChanges.pipe(
            startWith(this.form.value),
            map(() => this.tableSelections().length)
        ),
        { initialValue: 0 }
    );

    totalIndicatif = computed(() => {
        const ap = this.activePrice();
        const participantsTotal = ap
            ? ap.amount * (this.peopleCount() ?? 1)
            : 0;
        const tables = this.tablesTotal() ?? 0;
        return participantsTotal + tables;
    });

    submitDisabled(): boolean {
        if (!this.event()) return true;
        if (this.form.controls.mode.value === 'single') {
            return (
                this.form.controls.s_firstName.invalid ||
                this.form.controls.s_lastName.invalid ||
                this.form.controls.s_email.invalid ||
                this.form.controls.s_phoneNumber.invalid ||
                this.form.controls.s_age.invalid
            );
        } else {
            const baseInvalid =
                this.participants().length === 0 ||
                !this.hasExactlyOneMainGuest() ||
                this.participants().invalid;

            // 👇 NEW: valider aussi tableSelections (si présent)
            const tablesInvalid = this.tableSelections().controls.some(
                (s) => s.invalid || (Number(s.controls.quantity.value) || 0) < 1
            );

            return baseInvalid || tablesInvalid;
        }
    }
    resetForm() {
        this.form.reset();
        this.form.controls.mode.setValue('single');
        this.participants().clear();
        this.tableSelections().clear();
        this.successMsg.set(null);
        this.errorMsg.set(null);
    }

    onSubmit() {
        if (!this.event()?.slug) return;
        this.successMsg.set(null);
        this.errorMsg.set(null);

        let payload: CreateDemandPayload;
        if (this.form.controls.mode.value === 'single') {
            const g = {
                firstName: this.form.controls.s_firstName.value!,
                lastName: this.form.controls.s_lastName.value!,
                email: this.form.controls.s_email.value!,
                phoneNumber: this.form.controls.s_phoneNumber.value!,
                age: Number(this.form.controls.s_age.value!),
                isMainGuest: true,
            };
            payload = { eventSlug: this.event()!.slug!, guests: [g] };
        } else {
            if (!this.hasExactlyOneMainGuest()) {
                this.errorMsg.set(
                    'Veuillez sélectionner exactement un invité principal.'
                );
                return;
            }
            const guests = this.participants().controls.map((fg) => ({
                firstName: fg.controls.firstName.value!,
                lastName: fg.controls.lastName.value!,
                email: fg.controls.email.value!,
                phoneNumber: fg.controls.phoneNumber.value!,
                age: Number(fg.controls.age.value!),
                isMainGuest: !!fg.controls.isMainGuest.value,
            }));
            payload = { eventSlug: this.event()!.slug!, guests };
        }

        if (this.tableSelections().length > 0) {
            payload = {
                ...payload,
                tableSelections: this.tableSelections().controls.map((s) => ({
                    tableId: Number(s.controls.tableId.value),
                    quantity: Number(s.controls.quantity.value) || 1,
                })),
            };
        }

        this.demandService.create(payload).subscribe({
            next: () => {
                this.successMsg.set(
                    "Votre demande a été soumise avec succès. Un email sera envoyé à l'invité principal si la demande est validée."
                );
            },
            error: (err) => {
                this.errorMsg.set(
                    err?.error?.message ??
                        'Erreur lors de la création de la demande.'
                );
            },
        });
    }

    protected readonly HTMLInputElement = HTMLInputElement;
}
