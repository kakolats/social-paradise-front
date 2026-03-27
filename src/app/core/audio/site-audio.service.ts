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
    private resumeOnInteractionPending = false;
    private unlockHandler: (() => void) | null = null;

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

    async play(options?: { fromAutoResume?: boolean }): Promise<void> {
        const a = this.ensureAudio();
        if (!a) return;
        this.persist({ paused: false });
        try {
            await a.play();
            this.resumeOnInteractionPending = false;
            this.detachUnlockListeners();
        } catch {
            this.zone.run(() => {
                this.isPlaying.set(false);
            });

            // Cas typique au reload: autoplay bloqué. On garde l'intention "lecture"
            // (paused=false) et on reprendra au prochain geste utilisateur.
            if (options?.fromAutoResume) {
                this.persist({ paused: false });
                this.resumeOnInteractionPending = true;
                this.attachUnlockListeners();
            } else {
                // Erreur non liée à l'autoplay (fichier manquant, etc.)
                this.persist({ paused: true });
            }
        }
    }

    pause(): void {
        const a = this.ensureAudio();
        if (!a) return;
        a.pause();
        this.resumeOnInteractionPending = false;
        this.detachUnlockListeners();
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

            // 1) Première visite: tentative auto
            // 2) Visites suivantes: si l'utilisateur avait laissé en lecture, reprise auto
            if (!st || st.paused === false) {
                this.resumeOnInteractionPending = true;
                void this.tryAutoplayOrWaitForGesture();
            } else {
                this.resumeOnInteractionPending = false;
                this.detachUnlockListeners();
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
        this.detachUnlockListeners();
    }

    private async tryAutoplayOrWaitForGesture(): Promise<void> {
        const a = this.audio;
        if (!a || !this.resumeOnInteractionPending) return;

        await this.play({ fromAutoResume: true });
    }

    private attachUnlockListeners(): void {
        if (typeof window === 'undefined') return;
        if (this.unlockHandler) return;

        this.unlockHandler = () => {
            if (!this.resumeOnInteractionPending) {
                this.detachUnlockListeners();
                return;
            }

            void this.play({ fromAutoResume: true }).finally(() => {
                if (this.isPlaying()) {
                    this.resumeOnInteractionPending = false;
                    this.detachUnlockListeners();
                }
            });
        };

        const opts = { passive: true, capture: true } as AddEventListenerOptions;
        window.addEventListener('pointerdown', this.unlockHandler, opts);
        window.addEventListener('keydown', this.unlockHandler, opts);

        // Le "scroll" simple ne débloque pas toujours l'autoplay audio.
        // Ces events sont plus souvent considérés comme un geste utilisateur.
        window.addEventListener('wheel', this.unlockHandler, opts);
        window.addEventListener('touchstart', this.unlockHandler, opts);
        window.addEventListener('touchend', this.unlockHandler, opts);
    }

    private detachUnlockListeners(): void {
        if (typeof window === 'undefined' || !this.unlockHandler) return;
        window.removeEventListener('pointerdown', this.unlockHandler);
        window.removeEventListener('keydown', this.unlockHandler);
        window.removeEventListener('wheel', this.unlockHandler, true);
        window.removeEventListener('touchstart', this.unlockHandler, true);
        window.removeEventListener('touchend', this.unlockHandler, true);
        this.unlockHandler = null;
    }
}

