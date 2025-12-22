import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../../../shared/services/user/user.service';
import { CreateUserDto } from '../../../../../shared/models/user';

type CreateUserFG = FormGroup<{
    email: FormControl<string | null>;
    password: FormControl<string | null>;
    role: FormControl<string | null>;
}>;

@Component({
    selector: 'app-create-user',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './create-user.component.html',
    styleUrl: './create-user.component.scss',
})
export class CreateUserComponent {
    private fb = new FormBuilder();
    private userService = inject(UserService);
    private router = inject(Router);

    submitting = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    form: CreateUserFG = this.fb.group({
        email: this.fb.control<string | null>(null, {
            validators: [Validators.required, Validators.email],
        }),
        password: this.fb.control<string | null>(null, {
            validators: [Validators.required, Validators.minLength(6)],
        }),
        role: this.fb.control<string | null>(null, {
            validators: [Validators.required],
        }),
    });

    invalid(controlName: keyof CreateUserFG['controls']): boolean {
        const control = this.form.controls[controlName];
        return control.touched && control.invalid;
    }

    onSubmit(): void {
        if (this.form.invalid || this.submitting()) {
            return;
        }

        this.submitting.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const payload: CreateUserDto = {
            email: this.form.controls.email.value!,
            password: this.form.controls.password.value!,
            role: this.form.controls.role.value!,
        };

        this.userService.create(payload).subscribe({
            next: () => {
                this.successMessage.set('Utilisateur créé avec succès !');
                this.form.reset();
                setTimeout(() => {
                    this.successMessage.set(null);
                }, 3000);
                this.submitting.set(false);
            },
            error: (err) => {
                this.errorMessage.set(
                    err?.error?.message ?? 'Erreur lors de la création de l\'utilisateur.'
                );
                this.submitting.set(false);
            },
        });
    }
}