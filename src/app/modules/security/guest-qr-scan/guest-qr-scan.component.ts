import { Component, computed, inject, signal, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { GuestService, GuestValidationData } from '../../../../shared/services/guest/guest.service';
import { Guest } from '../../../../shared/models/guest';
import { NgIf } from '@angular/common';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface ApiResponse<T> {
    success: boolean;
    reason: string;
    data: T;
    message: string;
    error: string;
}
@Component({
    selector: 'app-guest-qr-scan',
    standalone: true,
    imports: [NgIf],
    templateUrl: './guest-qr-scan.component.html',
    styleUrl: './guest-qr-scan.component.scss',
})
export class GuestQrScanComponent implements OnInit, AfterViewInit, OnDestroy {
    private guestService = inject(GuestService);

    private html5QrCode: Html5Qrcode | null = null;
    private isScanning = false;
    private scannerElementId = 'html5qr-reader';

    scanning = signal<boolean>(true);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);
    guest = signal<GuestValidationData | null>(null);
    lastSlug = signal<string | null>(null);
    guestFullName = computed(() => {
        const g = this.guest();
        if (!g) return '';
        return `${g.firstName} ${g.lastName}`.trim();
    });

    ngOnInit(): void {
        // Le scanner sera initialisé dans ngAfterViewInit via startScanning
    }

    ngAfterViewInit(): void {
        // Attendre que la vue soit initialisée avant de démarrer le scanner
        if (this.scanning()) {
            // Attendre un peu pour que l'élément DOM soit disponible
            setTimeout(() => {
                const element = document.getElementById(this.scannerElementId);
                if (element) {
                    this.startScanning();
                }
            }, 300);
        }
    }

    ngOnDestroy(): void {
        this.stopScanning();
    }

    private async startScanning(): Promise<void> {
        // Si on est déjà en train de scanner, ne rien faire
        if (this.isScanning) {
            return;
        }

        // Si un scanner existe déjà, le nettoyer complètement d'abord
        if (this.html5QrCode) {
            await this.stopScanning(true);
        }

        const element = document.getElementById(this.scannerElementId);
        if (!element) {
            console.error('Élément scanner non trouvé dans le DOM');
            return;
        }

        // S'assurer que l'élément est vide
        element.innerHTML = '';

        try {
            this.isScanning = true;

            // Créer le scanner html5-qrcode
            this.html5QrCode = new Html5Qrcode(this.scannerElementId);

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 0.75,
            };

            // Démarrer le scanner
            await this.html5QrCode.start(
                { facingMode: 'environment' }, // Utiliser la caméra arrière
                config,
                (decodedText) => {
                    this.onCodeResult(decodedText);
                },
                (errorMessage) => {
                    // Erreur silencieuse, le scanner continue
                    // On peut logger en mode debug si nécessaire
                }
            );
        } catch (err: any) {
            this.isScanning = false;
            this.html5QrCode = null;
            const errorMsg = err?.message || 'Impossible de démarrer le scanner.';
            this.error.set(`Erreur du scanner : ${errorMsg}`);
            console.error('Erreur lors du démarrage du scanner QR:', err);

            // Nettoyer l'élément en cas d'erreur
            const element = document.getElementById(this.scannerElementId);
            if (element) {
                element.innerHTML = '';
            }
        }
    }

    private async stopScanning(clearCompletely: boolean = true): Promise<void> {
        if (!this.html5QrCode) {
            this.isScanning = false;
            if (clearCompletely) {
                // Nettoyer le contenu du conteneur même s'il n'y a pas de scanner actif
                const element = document.getElementById(this.scannerElementId);
                if (element) {
                    element.innerHTML = '';
                }
            }
            return;
        }

        try {
            const state = this.html5QrCode.getState();
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                await this.html5QrCode.stop().catch(err => {
                    console.warn('Erreur lors de l\'arrêt du scanner (peut être déjà arrêté):', err);
                });
            }
            if (clearCompletely) {
                await this.html5QrCode.clear();
            }
        } catch (err) {
            console.error('Erreur lors de l\'arrêt du scanner:', err);
        } finally {
            this.isScanning = false;
            if (clearCompletely) {
                this.html5QrCode = null;

                // Nettoyer le contenu du conteneur pour html5-qrcode
                const element = document.getElementById(this.scannerElementId);
                if (element) {
                    element.innerHTML = '';
                }
            }
        }
    }

    // appelé par le scanner quand un QR est lu
    private onCodeResult(result: string): void {
        if (!result) return;

        const slug = this.extractSlug(result);
        if (!slug) {
            this.error.set('QR code invalide : slug introuvable.');
            return;
        }

        // éviter les appels doublons si la caméra spam
        if (this.loading() || slug === this.lastSlug()) {
            return;
        }

        this.lastSlug.set(slug);
        // Arrêter temporairement le scanner pendant la validation
        this.pauseScanning();
        this.validateSlug(slug);
    }

    private async pauseScanning(): Promise<void> {
        if (this.html5QrCode) {
            try {
                const state = this.html5QrCode.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await this.html5QrCode.stop().catch(err => {
                        console.warn('Erreur lors de la pause du scanner:', err);
                    });
                }
                this.isScanning = false;
                // Note: on ne nettoie pas complètement ici pour permettre une reprise rapide si nécessaire
            } catch (err) {
                console.error('Erreur lors de la pause du scanner:', err);
                this.isScanning = false;
            }
        }
    }

    private extractSlug(raw: string): string | null {
        const trimmed = raw.trim();

        // Cas 1 : QR contient directement le slug
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return trimmed || null;
        }

        // Cas 2 : QR contient une URL → on prend le dernier segment
        try {
            const url = new URL(trimmed);
            const segments = url.pathname.split('/').filter(Boolean);
            return segments.pop() ?? null;
        } catch {
            return trimmed || null;
        }
    }

    private validateSlug(slug: string): void {
        this.loading.set(true);
        this.error.set(null);
        this.guest.set(null);

        this.guestService.validateGuestBySlug(slug).subscribe({
            next: (resp: ApiResponse<GuestValidationData>) => {
                this.loading.set(false);

                if (!resp.success || !resp.data) {
                    // 200 mais success=false (au cas où)
                    this.error.set(resp.message || 'Ticket invalide.');
                    this.guest.set(null);
                    return;
                }

                if(resp.reason === 'ALREADY_USED') {
                    this.error.set('Ce ticket a déjà été utilisé.');
                }

                this.guest.set(resp.data);
            },
            error: (err) => {
                this.loading.set(false);
                this.guest.set(null);

                // Le backend renvoie aussi { success:false, message, error } dans err.error
                const backend = err?.error as ApiResponse<any> | undefined;

                const msg =
                    backend?.message ||
                    err?.message ||
                    'Erreur lors de la validation du ticket.';
                this.error.set(msg);
            },
        });
    }

    async resetScan(): Promise<void> {
        // Arrêter complètement le scanner actuel (nettoyage complet)
        await this.stopScanning(true);

        // Forcer le nettoyage si nécessaire
        if (this.html5QrCode || this.isScanning) {
            this.html5QrCode = null;
            this.isScanning = false;
            const element = document.getElementById(this.scannerElementId);
            if (element) {
                element.innerHTML = '';
            }
        }

        // Réinitialiser tous les états
        this.loading.set(false);
        this.error.set(null);
        this.guest.set(null);
        this.lastSlug.set(null);
        this.scanning.set(true);

        // Attendre un peu pour que le nettoyage soit complètement terminé
        await new Promise(resolve => setTimeout(resolve, 500));

        // Redémarrer le scanner
        await this.startScanning();
    }
}
