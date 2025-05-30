import { Component, effect, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from '@angular/router';
import { Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  standalone: true,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private router = inject(Router);

  currentSong: Song | null = null;
  isPlaying = false;
  progressPercentage = 0;

  // Move effect to field initializer để tránh lỗi injection context
  private playerStateEffect = effect(() => {
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;

    if (state.duration > 0) {
      this.progressPercentage = (state.currentTime / state.duration) * 100;
    }
  });

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async togglePlayPause() {
    await this.audioPlayerService.togglePlayPause();
  }

  async previousSong() {
    await this.audioPlayerService.playPrevious();
  }

  async nextSong() {
    await this.audioPlayerService.playNext();
  }

  openFullPlayer() {
    this.router.navigate(['/player']);
  }
}
