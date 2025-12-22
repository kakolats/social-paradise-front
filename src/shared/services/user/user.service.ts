import { Injectable, inject } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { User, CreateUserDto } from 'shared/models/user';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

const API_BASE_URL = environment.apiUrl;

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private apiUrl = `${API_BASE_URL}/user`;
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);

    constructor() { }

    set user(value: User) {
        this._user.next(value)
    }

    get user$(): Observable<User> {
        return this._user.asObservable()
    }

    clearUser(): void {
        this._user.next(null as any)
    }

    /**
     * Liste tous les utilisateurs
     */
    findAll(): Observable<User[]> {
        return this.http.get<ApiResponse<User[]>>(this.apiUrl).pipe(
            map(res => res.data ?? [])
        );
    }

    /**
     * Crée un nouvel utilisateur
     */
    create(createUserDto: CreateUserDto): Observable<User> {
        return this.http.post<ApiResponse<User>>(`${this.apiUrl}/create`, createUserDto).pipe(
            map(res => res.data)
        );
    }

    /**
     * Modifie le rôle d'un utilisateur
     */
    updateRole(id: number, role: string): Observable<User> {
        return this.http.put<ApiResponse<User>>(`${this.apiUrl}/modify-role/${id}`, { role, id }).pipe(
            map(res => res.data)
        );
    }

    /**
     * Supprime un utilisateur
     */
    delete(id: number): Observable<void> {
        return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`, {
            body: { id }
        }).pipe(
            map(() => void 0)
        );
    }
}
