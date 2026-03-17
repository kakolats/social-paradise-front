import { CommonModule } from '@angular/common';
import { QuillModule } from 'ngx-quill';
import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
    computed,
    inject,
} from '@angular/core';
import {
    FormArray,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { EventService } from '../../../../../shared/services/event/event.service';
import { Event, EventCashPlace, EventPaymentMethod } from '../../../../../shared/models/event';
import { Price } from '../../../../../shared/models/price';
import { PaymentCanal, PaymentPlace } from '../../../../../shared/models/payment';
import { ActivatedRoute, Router } from '@angular/router';
import { FileUploadService } from 'shared/services/file-upload.service';

// ---------- Types de FormGroup
type PriceFG = FormGroup<{
    name: FormControl<string | null>;
    amount: FormControl<number | null>;
    startDate: FormControl<string | null>;
    endDate: FormControl<string | null>;
}>;

type TableFG = FormGroup<{
    name: FormControl<string | null>;
    amount: FormControl<number | null>;
    capacity: FormControl<number | null>;
}>;

type PaymentMethodFG = FormGroup<{
    name: FormControl<string | null>;
    phoneNumber: FormControl<string | null>;
    canal: FormControl<PaymentCanal | string | null>;
}>;

type CashPlaceFG = FormGroup<{
    name: FormControl<string | null>;
    address: FormControl<string | null>;
    mapUrl: FormControl<string | null>;
}>;

type EventFG = FormGroup<{
    name: FormControl<string | null>;
    date: FormControl<string | null>; // yyyy-MM-dd
    location: FormControl<string | null>;
    description: FormControl<string | null>;
    coverImage: FormControl<string | null>; // will hold URL, not File
    isActive: FormControl<boolean | null>;
    prices: FormArray<PriceFG>;
    tables: FormArray<TableFG>;
    paymentMethods: FormArray<PaymentMethodFG>;
    allowCash: FormControl<boolean | null>;
    cashPlacesConfig: FormArray<CashPlaceFG>;
}>;

@Component({
    selector: 'app-create-event',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, QuillModule],
    templateUrl: './create-event.component.html',
    styleUrl: './create-event.component.scss',
})
export class CreateEventComponent implements OnInit, OnChanges {
    private fb = new FormBuilder();
    private eventService = inject(EventService);
    private fileUploadService = inject(FileUploadService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    /** If set, component is in "edit" mode */
    eventToEdit?: Event;

    @Output() eventCreated = new EventEmitter<number>();
    @Output() eventUpdated = new EventEmitter<number>();

    submitting = false;

    // We'll store the user's chosen file before upload
    selectedFile: File | null = null;

    form: EventFG = this.fb.group({
        name: this.fb.control<string | null>(null, {
            validators: [Validators.required, Validators.minLength(3)],
        }),
        date: this.fb.control<string | null>(null, {
            validators: [Validators.required],
        }),
        location: this.fb.control<string | null>(null, {
            validators: [Validators.required, Validators.minLength(3)],
        }),
        description: this.fb.control<string | null>(null),
        coverImage: this.fb.control<string | null>(null), // we'll set URL here
        isActive: this.fb.control<boolean | null>(true),
        prices: this.fb.array<PriceFG>([]),
        tables: this.fb.array<TableFG>([]),
    paymentMethods: this.fb.array<PaymentMethodFG>([]),
    allowCash: this.fb.control<boolean | null>(true),
    cashPlacesConfig: this.fb.array<CashPlaceFG>([]),
    });

    createdMessage = computed(() => this._createdMessage);
    errorMessage = computed(() => this._errorMessage);
    private _createdMessage = '';
    private _errorMessage = '';

    ngOnInit(): void {
        const slugParam = this.route.snapshot.paramMap.get('slug');
        if (slugParam) {
            const slug = String(slugParam);
            this.eventService.getBySlug(slug).subscribe((evt) => {
                this.eventToEdit = evt;
                this.fillFormFromEvent(evt);
            });
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['eventToEdit'] && changes['eventToEdit'].currentValue) {
            this.fillFormFromEvent(changes['eventToEdit'].currentValue as Event);
        }
    }

    // ---------- Helpers dates
    private parseLocalDateStr(str: string | null | undefined): Date | null {
        if (!str) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
        if (!m) return null;
        const y = +m[1], mo = +m[2], d = +m[3];
        return new Date(y, mo - 1, d);
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
    tables(): FormArray<TableFG> {
        return this.form.controls.tables;
    }
  paymentMethods(): FormArray<PaymentMethodFG> {
    return this.form.controls.paymentMethods;
  }
  cashPlacesConfig(): FormArray<CashPlaceFG> {
    return this.form.controls.cashPlacesConfig;
  }

    trackByIndex = (i: number) => i;

    readonly allPaymentCanals: { key: PaymentCanal; label: string }[] = [
        { key: PaymentCanal.WAVE,          label: 'Wave' },
        { key: PaymentCanal.ORANGE_MONEY,  label: 'Orange Money' },
        { key: PaymentCanal.CASH,          label: 'Cash' },
    ];

    readonly allCashPlaces: { key: PaymentPlace; label: string }[] = [
        { key: PaymentPlace.FITLAB,       label: 'Fitlab' },
        { key: PaymentPlace.HEMISPHERE,   label: 'Hémisphère Voyages' },
        { key: PaymentPlace.GROOV,        label: 'Groov' },
        { key: PaymentPlace.IROKO_BEACH,  label: 'Iroko Beach Saly' },
    ];

  private makePaymentMethod(initial?: Partial<EventPaymentMethod>): PaymentMethodFG {
    return this.fb.group({
      name: this.fb.control<string | null>(initial?.name ?? null, {
        validators: [Validators.required],
      }),
      phoneNumber: this.fb.control<string | null>(initial?.phoneNumber ?? null, {
        validators: [Validators.required],
      }),
      canal: this.fb.control<PaymentCanal | string | null>(
        (initial?.canal as PaymentCanal | string) ?? null
      ),
    });
  }

  private makeCashPlace(initial?: Partial<EventCashPlace>): CashPlaceFG {
    return this.fb.group({
      name: this.fb.control<string | null>(initial?.name ?? null, {
        validators: [Validators.required],
      }),
      address: this.fb.control<string | null>(initial?.address ?? null, {
        validators: [Validators.required],
      }),
      mapUrl: this.fb.control<string | null>(initial?.mapUrl ?? null),
    });
  }

    private makePrice(): PriceFG {
        return this.fb.group({
            name: this.fb.control<string | null>(null, {
                validators: [Validators.required],
            }),
            amount: this.fb.control<number | null>(null, {
                validators: [Validators.required, Validators.min(0)],
            }),
            startDate: this.fb.control<string | null>(null, {
                validators: [Validators.required],
            }),
            endDate: this.fb.control<string | null>(null, {
                validators: [Validators.required],
            }),
        });
    }

    private makeTable(): TableFG {
        return this.fb.group({
            name: this.fb.control<string | null>(null, {
                validators: [Validators.required, Validators.minLength(1)],
            }),
            amount: this.fb.control<number | null>(null, {                 // 👈 NEW
                validators: [Validators.required, Validators.min(0)],
            }),
            capacity: this.fb.control<number | null>(null, {
                validators: [Validators.required, Validators.min(1)],
            }),
        });
    }

    addPrice() {
        this.prices().push(this.makePrice());
    }
    removePrice(i: number) {
        this.prices().removeAt(i);
    }

    addTable() {
        this.tables().push(this.makeTable());
    }
    removeTable(i: number) {
        this.tables().removeAt(i);
    }

  addPaymentMethod() {
    this.paymentMethods().push(this.makePaymentMethod());
  }
  removePaymentMethod(i: number) {
    this.paymentMethods().removeAt(i);
  }

  addCashPlace() {
    this.cashPlacesConfig().push(this.makeCashPlace());
  }
  removeCashPlace(i: number) {
    this.cashPlacesConfig().removeAt(i);
  }

    invalid(ctrl: keyof EventFG['controls']): boolean {
        const c = this.form.controls[ctrl] as FormControl | FormArray;
        return !!c && (c.touched || this.submitting) && c.invalid;
    }

    // ---------- Validations (business rules)
    rangeValid(p: PriceFG): boolean {
        const s = this.parseLocalDateStr(p.controls.startDate.value);
        const e = this.parseLocalDateStr(p.controls.endDate.value);
        if (!s || !e) return true;
        return this.compareDates(s, e) <= 0;
    }

    allRangesValid(): boolean {
        return this.prices().controls.every((p) => this.rangeValid(p));
    }

    endAfterEvent(i: number): boolean {
        const eventDate = this.parseLocalDateStr(this.form.controls.date.value);
        if (!eventDate) return false;
        const price = this.prices().at(i);
        const end = this.parseLocalDateStr(price.controls.endDate.value);
        if (!end) return false;
        return this.compareDates(end, eventDate) === 1;
    }

    startNotAfterPrevEnd(i: number): boolean {
        if (i === 0) return false;
        const prev = this.prices().at(i - 1);
        const cur = this.prices().at(i);
        const prevEnd = this.parseLocalDateStr(prev.controls.endDate.value);
        const curStart = this.parseLocalDateStr(cur.controls.startDate.value);
        if (!prevEnd || !curStart) return false;
        return this.compareDates(curStart, prevEnd) <= 0;
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

    // ---------- Fill form when editing
    private toDateInputValue(d: string | Date | null | undefined): string | null {
        if (!d) return null;
        const dt = typeof d === 'string' ? new Date(d) : d;
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const da = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
    }

    private fillFormFromEvent(evt: Event) {
        this.form.reset();
        this.prices().clear();
        this.tables().clear();
        this.paymentMethods().clear();
        this.cashPlacesConfig().clear();

        this.form.patchValue({
            name: evt.name ?? null,
            date: this.toDateInputValue(evt.date as any) ?? null,
            location: (evt as any).location ?? null,
            description: (evt as any).description ?? null,
            coverImage: (evt as any).coverImage ?? null,
            allowCash: (evt as any).allowCash ?? true,
            isActive: (evt as any).isActive ?? true,
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

        (evt.tables ?? []).forEach((t) => {
            const tg = this.makeTable();
            tg.patchValue({
                name: t.name ?? null,
                amount: t.amount ?? null,
                capacity: t.capacity ?? null,
            });
            this.tables().push(tg);
        });

        // Payment methods
        (evt.paymentMethods ?? []).forEach((pm) => {
            this.paymentMethods().push(this.makePaymentMethod(pm));
        });

        // Cash places config
        (evt.cashPlacesConfig ?? []).forEach((cp) => {
            this.cashPlacesConfig().push(this.makeCashPlace(cp));
        });

        // no selectedFile initially when editing existing
        this.selectedFile = null;
    }

    // ---------- Reset
    reset() {
        if (this.eventToEdit) {
            this.fillFormFromEvent(this.eventToEdit);
        } else {
            this.form.reset();
            this.prices().clear();
            this.tables().clear();
            this.paymentMethods().clear();
            this.cashPlacesConfig().clear();
            this.form.patchValue({
                allowCash: true,
            });
            this.selectedFile = null;
        }
        this._createdMessage = '';
        this._errorMessage = '';
        this.submitting = false;
    }

    // ---------- Payload build
    private buildPayloadFromForm(coverUrlOverride?: string) {
        const f = this.form.value;
        return {
            name: f.name!,
            date: new Date(f.date!), // EventService sérialisera en "YYYY-MM-DD"
            location: f.location!,
            description: f.description ?? '',
            coverImage: coverUrlOverride ?? f.coverImage ?? null,
            isActive: f.isActive ?? true,
            prices: (f.prices ?? []).map((p) => ({
                name: p!.name!,
                amount: Number(p!.amount),
                startDate: new Date(p!.startDate!),
                endDate: new Date(p!.endDate!),
            })),
            tables: (f.tables ?? []).map((t) => ({
                name: t!.name!,
                amount: Number(t!.amount),
                capacity: Number(t!.capacity),
            })),
            paymentMethods: (f.paymentMethods ?? []).map((pm) => ({
                name: pm!.name!,
                phoneNumber: pm!.phoneNumber!,
                canal: pm!.canal ?? undefined,
            })),
            allowCash: f.allowCash ?? true,
            cashPlacesConfig: (f.cashPlacesConfig ?? []).map((cp) => ({
                name: cp!.name!,
                address: cp!.address!,
                mapUrl: cp!.mapUrl ?? undefined,
            })),
        };
    }

    // ---------- File input handler
    onCoverFileChange(evt: any) {
        const input = evt.currentTarget as HTMLInputElement | null;
        if (!input || !input.files || input.files.length === 0) {
            this.selectedFile = null;
            return;
        }
        this.selectedFile = input.files[0];
    }

    // ---------- Submit flow
    onSubmit() {
        this._createdMessage = '';
        this._errorMessage = '';
        this.submitting = true;

        this.form.markAllAsTouched();

        // validations
        const tablesValid = this.tables().controls.every(
            (t) => t.valid && Number(t.controls.capacity.value) >= 1 &&
                Number(t.controls.amount.value) >= 0
        );

        if (
            this.form.invalid ||
            !this.allRangesValid() ||
            !this.allBusinessValid() ||
            !tablesValid
        ) {
            this.submitting = false;

            if (!this.form.controls.date.value) {
                this._errorMessage = 'Veuillez renseigner la date de l’événement.';
            } else if (!this.allRangesValid()) {
                this._errorMessage =
                    'Chaque prix doit avoir une date de fin supérieure ou égale à sa date de début.';
            } else if (!tablesValid) {
                this._errorMessage =
                    'Chaque table doit avoir un nom et une capacité d’au moins 1.';
            } else {
                this._errorMessage =
                    'Vérifiez les dates des prix : respect de la date de l’événement et ordre strict entre les plages.';
            }
            return;
        }

        const doCreateOrUpdate = (coverUrlFromUpload: string | null) => {
            const payload = this.buildPayloadFromForm(
                coverUrlFromUpload ?? undefined
            );

            // EDIT MODE
            if (this.eventToEdit?.slug) {
                this.eventService
                    .update(this.eventToEdit.slug, payload as Partial<Event>)
                    .subscribe({
                        next: (evt) => {
                            this._createdMessage = `Événement mis à jour avec succès${evt?.id ? ` (id: ${evt.id})` : ''}.`;
                            this.eventUpdated.emit(evt?.id ?? this.eventToEdit!.id!);
                            this.submitting = false;
                            this.router.navigate(['/events/event-list']);
                        },
                        error: (err) => {
                            this._errorMessage =
                                err?.error?.message ?? 'Erreur lors de la mise à jour.';
                            this.submitting = false;
                        },
                    });
                return;
            }

            // CREATE MODE
            this.eventService.create(payload as any).subscribe({
                next: (evt) => {
                    this._createdMessage = `Événement créé avec succès${evt?.id ? ` (id: ${evt.id})` : ''}.`;
                    this.eventCreated.emit(evt?.id ?? 0);
                    this.submitting = false;
                    this.router.navigate(['/events/event-list']);
                },
                error: (err) => {
                    this._errorMessage =
                        err?.error?.message ?? 'Erreur lors de la création.';
                    this.submitting = false;
                },
            });
        };

        if (this.selectedFile) {
            this.fileUploadService.uploadEventCover(this.selectedFile).subscribe({
                next: (res) => {
                    doCreateOrUpdate(res['data']['url']);
                },
                error: (err) => {
                    this._errorMessage =
                        err?.error?.message ?? 'Erreur lors de l’upload de l’image.';
                    this.submitting = false;
                },
            });
        } else {
            doCreateOrUpdate(null);
        }
    }
}
