import { Injectable, NgZone, OnDestroy, signal } from '@angular/core';

type PersistedAudioState = {
    paused: boolean;
    time: number;
    volume: number;
    muted: boolean;
};

const STORAGE_KEY = 'sp_site_audio_state_v1';

@Injectable({ providedIn: 'root' })
export class SiteAudioService implements OnDestroy {
    /**
     * Place ton fichier audio/vidéo (mp4 accepté) dans `social-p-front/public/audio/`
     * puis mets ici le chemin public.
     *
     * Exemple: `audio/site-theme.mp4`
     */
    readonly src = 'audio/site-theme.mp3';

    private audio: HTMLAudioElement | null = null;
    private saveTimer: number | null = null;
    private firstVisitAutoPlayPending = false;
    private firstVisitUnlockHandler: (() => void) | null = null;

    isReady = signal(false);
    hasError = signal(false);
    isPlaying = signal(false);
    isMuted = signal(false);
    volume = signal(0.8);
    currentTime = signal(0);

    constructor(private zone: NgZone) {
        this.zone.runOutsideAngular(() => {
            this.ensureAudio();
        });
    }

    ngOnDestroy(): void {
        this.teardown();
    }

    togglePlay(): void {
        const a = this.ensureAudio();
        if (!a) return;
        if (a.paused) void this.play();
        else this.pause();
    }

    async play(): Promise<void> {
        const a = this.ensureAudio();
        if (!a) return;
        this.persist({ paused: false });
        try {
            await a.play();
            this.detachFirstVisitUnlockListeners();
        } catch {
            // Autoplay bloqué : on laisse l'état en "paused" visuellement
            this.persist({ paused: true });
            this.zone.run(() => {
                this.isPlaying.set(false);
            });
        }
    }

    pause(): void {
        const a = this.ensureAudio();
        if (!a) return;
        a.pause();
        this.persist({ paused: true });
        this.zone.run(() => {
            this.isPlaying.set(false);
        });
    }

    toggleMute(): void {
        const a = this.ensureAudio();
        if (!a) return;
        a.muted = !a.muted;
        this.persist({ muted: a.muted });
        this.zone.run(() => this.isMuted.set(a.muted));
    }

    setVolume(v: number): void {
        const a = this.ensureAudio();
        if (!a) return;
        const clamped = Math.min(1, Math.max(0, Number(v)));
        a.volume = clamped;
        this.persist({ volume: clamped });
        this.zone.run(() => this.volume.set(clamped));
    }

    private ensureAudio(): HTMLAudioElement | null {
        if (typeof window === 'undefined') return null;
        if (this.audio) return this.audio;

        const persisted = this.readPersisted();
        const a = new Audio(this.src);
        a.preload = 'auto';
        a.loop = true;
        a.crossOrigin = 'anonymous';

        if (persisted) {
            a.muted = !!persisted.muted;
            a.volume = Number.isFinite(persisted.volume) ? persisted.volume : 0.8;
        } else {
            a.volume = 0.8;
        }

        this.audio = a;

        // Events
        a.addEventListener('canplay', () => {
            this.zone.run(() => {
                this.isReady.set(true);
                this.hasError.set(false);
                this.isMuted.set(a.muted);
                this.volume.set(a.volume);
            });
        });

        a.addEventListener('error', () => {
            this.zone.run(() => {
                this.hasError.set(true);
                this.isPlaying.set(false);
            });
        });

        a.addEventListener('play', () => {
            this.zone.run(() => this.isPlaying.set(true));
        });

        a.addEventListener('pause', () => {
            this.zone.run(() => this.isPlaying.set(false));
        });

        a.addEventListener('timeupdate', () => {
            const t = a.currentTime || 0;
            this.zone.run(() => this.currentTime.set(t));
            this.schedulePersist();
        });

        // Restore time when metadata is ready
        a.addEventListener('loadedmetadata', () => {
            const st = this.readPersisted();
            const t = st?.time ?? 0;
            if (Number.isFinite(t) && t > 0) {
                try {
                    a.currentTime = t;
                } catch {
                    // ignore
                }
            }

            // 1) Première visite: tentative de lecture auto
            if (!st) {
                this.firstVisitAutoPlayPending = true;
                void this.tryFirstVisitAutoplay();
                return;
            }

            // 2) Visites suivantes: respecter le choix utilisateur
            if (st.paused === false) {
                void this.play();
            } else {
                this.zone.run(() => this.isPlaying.set(false));
            }
        });

        // Initialize signals immediately
        this.zone.run(() => {
            this.isMuted.set(a.muted);
            this.volume.set(a.volume);
            this.currentTime.set(a.currentTime || 0);
        });

        return a;
    }

    private schedulePersist(): void {
        if (this.saveTimer !== null) return;
        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            this.persist();
        }, 1000);
    }

    private persist(partial?: Partial<PersistedAudioState>): void {
        const a = this.audio;
        if (typeof window === 'undefined') return;

        const prev = this.readPersisted() ?? {
            paused: true,
            time: 0,
            volume: 0.8,
            muted: false,
        };

        const next: PersistedAudioState = {
            paused: partial?.paused ?? (a ? a.paused : prev.paused),
            time: partial?.time ?? (a ? a.currentTime || 0 : prev.time),
            volume: partial?.volume ?? (a ? a.volume : prev.volume),
            muted: partial?.muted ?? (a ? a.muted : prev.muted),
        };

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    }

    private readPersisted(): PersistedAudioState | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as PersistedAudioState;
            if (typeof parsed !== 'object' || parsed === null) return null;
            return {
                paused: !!parsed.paused,
                time: Number(parsed.time || 0),
                volume: Number.isFinite(Number(parsed.volume))
                    ? Math.min(1, Math.max(0, Number(parsed.volume)))
                    : 0.8,
                muted: !!parsed.muted,
            };
        } catch {
            return null;
        }
    }

    private teardown(): void {
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (this.audio) {
            try {
                this.audio.pause();
            } catch {
                // ignore
            }
            this.audio = null;
        }
        this.detachFirstVisitUnlockListeners();
    }

    private async tryFirstVisitAutoplay(): Promise<void> {
        const a = this.audio;
        if (!a || !this.firstVisitAutoPlayPending) return;

        await this.play();

        if (this.isPlaying()) {
            this.firstVisitAutoPlayPending = false;
            return;
        }

        // Si le navigateur bloque l'autoplay sonore, reprendre au 1er geste utilisateur.
        this.attachFirstVisitUnlockListeners();
    }

    private attachFirstVisitUnlockListeners(): void {
        if (typeof window === 'undefined') return;
        if (this.firstVisitUnlockHandler) return;

        this.firstVisitUnlockHandler = () => {
            if (!this.firstVisitAutoPlayPending) {
                this.detachFirstVisitUnlockListeners();
                return;
            }

            void this.play().finally(() => {
                if (this.isPlaying()) {
                    this.firstVisitAutoPlayPending = false;
                    this.detachFirstVisitUnlockListeners();
                }
            });
        };

        window.addEventListener('pointerdown', this.firstVisitUnlockHandler, {
            passive: true,
        });
        window.addEventListener('keydown', this.firstVisitUnlockHandler, {
            passive: true,
        });
    }

    private detachFirstVisitUnlockListeners(): void {
        if (typeof window === 'undefined' || !this.firstVisitUnlockHandler) return;
        window.removeEventListener('pointerdown', this.firstVisitUnlockHandler);
        window.removeEventListener('keydown', this.firstVisitUnlockHandler);
        this.firstVisitUnlockHandler = null;
    }
}

