import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../../../../shared/services/user/user.service';
import { User } from '../../../../../shared/models/user';

type RoleChangeFG = FormGroup<{
    role: FormControl<string | null>;
}>;

@Component({
    selector: 'app-list-user',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './list-user.component.html',
    styleUrl: './list-user.component.scss',
})
export class ListUserComponent implements OnInit {
    private userService = inject(UserService);
    private fb = new FormBuilder();

    users = signal<User[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    successMessage = signal<string | null>(null);
    
    // Track which user is being edited
    editingUserId = signal<number | null>(null);
    roleChangeForms = new Map<number, RoleChangeFG>();
    
    // Track which user is being deleted
    deletingUserId = signal<number | null>(null);

    ngOnInit() {
        this.fetchUsers();
    }

    fetchUsers() {
        this.loading.set(true);
        this.error.set(null);
        this.userService.findAll().subscribe({
            next: (users) => {
                this.users.set(users);
                // Initialize forms for each user
                users.forEach(user => {
                    if (user.id) {
                        this.roleChangeForms.set(user.id, this.fb.group({
                            role: this.fb.control<string | null>(user.role || null, {
                                validators: [Validators.required],
                            }),
                        }));
                    }
                });
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err?.error?.message ?? 'Erreur lors du chargement des utilisateurs.');
                this.loading.set(false);
            },
        });
    }

    trackById(_: number, user: User): number | undefined {
        return user.id;
    }

    getRoleForm(userId: number | undefined): RoleChangeFG | undefined {
        if (!userId) return undefined;
        return this.roleChangeForms.get(userId);
    }

    startEdit(userId: number | undefined): void {
        if (!userId) return;
        this.editingUserId.set(userId);
    }

    cancelEdit(): void {
        // Reset form to original value
        const userId = this.editingUserId();
        if (userId) {
            const user = this.users().find(u => u.id === userId);
            if (user && this.roleChangeForms.has(userId)) {
                this.roleChangeForms.get(userId)!.controls.role.setValue(user.role || null);
            }
        }
        this.editingUserId.set(null);
    }

    saveRole(userId: number | undefined): void {
        if (!userId) return;
        const form = this.roleChangeForms.get(userId);
        if (!form || form.invalid) return;

        const newRole = form.controls.role.value!;
        
        this.loading.set(true);
        this.userService.updateRole(userId, newRole).subscribe({
            next: (updatedUser) => {
                // Update the user in the list
                this.users.set(
                    this.users().map(u => (u.id === userId ? updatedUser : u))
                );
                // Update the form value to match
                if (this.roleChangeForms.has(userId)) {
                    this.roleChangeForms.get(userId)!.controls.role.setValue(updatedUser.role || null);
                }
                this.editingUserId.set(null);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err?.error?.message ?? 'Erreur lors de la modification du rôle.');
                this.loading.set(false);
            },
        });
    }

    isEditing(userId: number | undefined): boolean {
        if (!userId) return false;
        return this.editingUserId() === userId;
    }

    confirmDelete(userId: number | undefined): void {
        if (!userId) return;
        this.deletingUserId.set(userId);
    }

    cancelDelete(): void {
        this.deletingUserId.set(null);
    }

    deleteUser(userId: number | undefined): void {
        if (!userId) return;
        
        this.loading.set(true);
        this.error.set(null);
        this.deletingUserId.set(null);
        
        this.userService.delete(userId).subscribe({
            next: () => {
                // Remove user from list
                this.users.set(this.users().filter(u => u.id !== userId));
                // Remove form from map
                this.roleChangeForms.delete(userId);
                this.successMessage.set('Utilisateur supprimé avec succès.');
                setTimeout(() => {
                    this.successMessage.set(null);
                }, 3000);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err?.error?.message ?? 'Erreur lors de la suppression de l\'utilisateur.');
                this.loading.set(false);
            },
        });
    }

    isDeleting(userId: number | undefined): boolean {
        if (!userId) return false;
        return this.deletingUserId() === userId;
    }
}