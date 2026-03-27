import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SiteAudioService } from '../../../core/audio/site-audio.service';

@Component({
    selector: 'site-audio-player',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './site-audio-player.component.html',
})
export class SiteAudioPlayerComponent {
    audio = inject(SiteAudioService);

    statusLabel = computed(() => {
        if (this.audio.hasError()) return 'Audio indisponible';
        if (!this.audio.isReady()) return 'Audio prêt…';
        return this.audio.isPlaying() ? 'Lecture' : 'Pause';
    });
}

