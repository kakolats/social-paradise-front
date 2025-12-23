import {
    Component,
    computed,
    inject,
    signal,
    OnInit,
    OnDestroy,
    AfterViewInit,
} from '@angular/core';
import { GuestService, GuestValidationData } from '../../../../shared/services/guest/guest.service';
import { NgIf, NgClass } from '@angular/common';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { MatIconModule } from '@angular/material/icon';

interface ApiResponse<T> {
    success: boolean;
    reason: string;
    data: T;
    message: string;
    error: string;
}

type ScanStatus = 'IDLE' | 'SCANNING' | 'LOADING' | 'INVALID' | 'VALID' | 'ALREADY_USED';

@Component({
    selector: 'app-guest-qr-scan',
    standalone: true,
    imports: [NgIf, NgClass, MatIconModule],
    templateUrl: './guest-qr-scan.component.html',
    styleUrl: './guest-qr-scan.component.scss',
})
export class GuestQrScanComponent implements OnInit, AfterViewInit, OnDestroy {
    private guestService = inject(GuestService);

    private html5QrCode: Html5Qrcode | null = null;
    private isScanning = false;
    private scannerElementId = 'html5qr-reader';

    scanning = signal<boolean>(true);
    status = signal<ScanStatus>('SCANNING');
    statusMessage = signal<string>('');

    guest = signal<GuestValidationData | null>(null);
    lastSlug = signal<string | null>(null);

    guestFullName = computed(() => {
        const g = this.guest();
        if (!g) return '';
        return `${g.firstName} ${g.lastName}`.trim();
    });

    isLoading = computed(() => this.status() === 'LOADING');

    ngOnInit(): void {
        // Le scanner sera initialisé dans ngAfterViewInit
    }

    ngAfterViewInit(): void {
        if (this.scanning()) {
            setTimeout(() => {
                const element = document.getElementById(this.scannerElementId);
                if (element) {
                    this.startScanning();
                }
            }, 300);
        }
    }

    ngOnDestroy(): void {
        this.stopScanning(true);
    }

    private async startScanning(): Promise<void> {
        if (this.isScanning) return;

        if (this.html5QrCode) {
            await this.stopScanning(true);
        }

        const element = document.getElementById(this.scannerElementId);
        if (!element) {
            console.error('Élément scanner non trouvé dans le DOM');
            return;
        }

        element.innerHTML = '';

        try {
            this.isScanning = true;
            this.status.set('SCANNING');
            this.statusMessage.set('');

            this.html5QrCode = new Html5Qrcode(this.scannerElementId);

            const config = {
                fps: 10,
                qrbox: { width: 600, height: 600 },
                aspectRatio: 2,
            };

            await this.html5QrCode.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => this.onCodeResult(decodedText),
                () => {
                    // erreur silencieuse, scanner continue
                }
            );
        } catch (err: any) {
            this.isScanning = false;
            this.html5QrCode = null;

            const errorMsg = err?.message || 'Impossible de démarrer le scanner.';
            this.status.set('INVALID');
            this.statusMessage.set(`Erreur du scanner : ${errorMsg}`);

            console.error('Erreur lors du démarrage du scanner QR:', err);

            const el = document.getElementById(this.scannerElementId);
            if (el) el.innerHTML = '';
        }
    }

    private async stopScanning(clearCompletely: boolean = true): Promise<void> {
        if (!this.html5QrCode) {
            this.isScanning = false;
            if (clearCompletely) {
                const element = document.getElementById(this.scannerElementId);
                if (element) element.innerHTML = '';
            }
            return;
        }

        try {
            const state = this.html5QrCode.getState();
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                await this.html5QrCode.stop().catch((e) => {
                    console.warn("Erreur lors de l'arrêt du scanner (peut être déjà arrêté):", e);
                });
            }
            if (clearCompletely) {
                await this.html5QrCode.clear();
            }
        } catch (err) {
            console.error("Erreur lors de l'arrêt du scanner:", err);
        } finally {
            this.isScanning = false;
            if (clearCompletely) {
                this.html5QrCode = null;

                const element = document.getElementById(this.scannerElementId);
                if (element) element.innerHTML = '';
            }
        }
    }

    private onCodeResult(result: string): void {
        if (!result) return;

        const slug = this.extractSlug(result);
        if (!slug) {
            this.status.set('INVALID');
            this.statusMessage.set('Ticket non valide');
            return;
        }

        // éviter appels doublons si la caméra spam
        if (this.isLoading() || slug === this.lastSlug()) return;

        this.lastSlug.set(slug);

        // pause scanner pendant validation
        this.pauseScanning();
        this.validateSlug(slug);
    }

    private async pauseScanning(): Promise<void> {
        if (!this.html5QrCode) return;

        try {
            const state = this.html5QrCode.getState();
            if (state === Html5QrcodeScannerState.SCANNING) {
                await this.html5QrCode.stop().catch((e) => {
                    console.warn('Erreur lors de la pause du scanner:', e);
                });
            }
            this.isScanning = false;
        } catch (err) {
            console.error('Erreur lors de la pause du scanner:', err);
            this.isScanning = false;
        }
    }

    private extractSlug(raw: string): string | null {
        const trimmed = raw.trim();

        // Cas 1 : QR contient directement le slug
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return trimmed || null;
        }

        // Cas 2 : QR contient une URL → dernier segment
        try {
            const url = new URL(trimmed);
            const segments = url.pathname.split('/').filter(Boolean);
            return segments.pop() ?? null;
        } catch {
            return trimmed || null;
        }
    }

    private validateSlug(slug: string): void {
        this.status.set('LOADING');
        this.statusMessage.set('Validation du ticket en cours…');
        this.guest.set(null);

        this.guestService.validateGuestBySlug(slug).subscribe({
            next: (resp: ApiResponse<GuestValidationData>) => {
                if (!resp.success || !resp.data) {
                    this.status.set('INVALID');
                    this.statusMessage.set('Ticket non valide');
                    this.guest.set(null);
                    return;
                }

                this.guest.set(resp.data);

                if ((resp as any).reason === 'ALREADY_USED') {
                    this.status.set('ALREADY_USED');
                    this.statusMessage.set('Ticket déjà utilisé');
                } else {
                    this.status.set('VALID');
                    this.statusMessage.set('Ticket valide');
                }
            },
            error: () => {
                this.guest.set(null);
                this.status.set('INVALID');
                this.statusMessage.set('Ticket non valide');
            },
        });
    }

    async resetScan(): Promise<void> {
        await this.stopScanning(true);

        // Reset UI states
        this.guest.set(null);
        this.lastSlug.set(null);

        this.status.set('SCANNING');
        this.statusMessage.set('');

        this.scanning.set(true);

        await new Promise((resolve) => setTimeout(resolve, 300));
        await this.startScanning();
    }
}
