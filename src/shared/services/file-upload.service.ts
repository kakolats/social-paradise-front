// shared/services/file-upload/file-upload.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FileUploadResponse {
    url: string;       // result.secure_url from backend
    publicId: string;  // result.public_id from backend
}

@Injectable({
    providedIn: 'root'
})
export class FileUploadService {
    private http = inject(HttpClient);
    private base = environment.apiUrl+'/file-upload'; // <-- adjust if needed

    /**
     * Uploads a file using multipart/form-data to the backend.
     * The backend responds with { url, publicId }.
     */
    uploadEventCover(file: File): Observable<FileUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<FileUploadResponse>(this.base, formData);
    }
}
