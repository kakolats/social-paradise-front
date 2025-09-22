import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { User } from 'shared/models/user';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UserService {
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1)
    private apiUrl = environment.apiUrl + "/user"

  constructor(private _http: HttpClient) { }

    set user(value: User) {
        this._user.next(value)
    }

    get user$(): Observable<User> {
        return this._user.asObservable()
    }

    clearUser(): void {
        this._user.next(null as any)
    }

}
