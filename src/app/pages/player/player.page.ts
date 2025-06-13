import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DatabaseService } from '../../services/database.service';
import { ModalController, IonicModule } from '@ionic/angular';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
})
export class PlayerPage implements OnInit, OnDestroy {
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private themeService = inject(ThemeService);

  // Audio service signals
  currentSong = this.audioPlayerService.currentSong;
  playbackState = this.audioPlayerService.playbackState;
  currentTime = this.audioPlayerService.currentTime;
  duration = this.audioPlayerService.duration;
  isPlaying = this.audioPlayerService.isPlayingSignal;
  isShuffling = this.audioPlayerService.isShuffling;
  repeatMode = this.audioPlayerService.repeatModeSignal;
  currentIndex = this.audioPlayerService.currentIndex;
  // UI state signals
  isDragging = signal(false);
  tempProgress = signal(0);
  hoverProgress = signal(-1); // -1 means not hovering
  isHoveringProgress = signal(false);
  bufferProgress = this.audioPlayerService.bufferProgress;

  // Computed values
  progress = computed(() => {
    if (this.isDragging()) {
      return this.tempProgress();
    }
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  progressTime = computed(() => {
    const current = this.isDragging()
      ? (this.tempProgress() / 100) * this.duration()
      : this.currentTime();
    return this.formatTime(current);
  });

  durationTime = computed(() => this.formatTime(this.duration()));
  ngOnInit() {
    this.setPlayerThemeColor();
    this.setupBufferTracking();
  }
  ngOnDestroy() {
    this.themeService.updateHeaderThemeColor(this.themeService.isDarkMode());
    this.cleanupGlobalListeners();
  }
  private setupBufferTracking() {
    // Theo dõi buffer progress thông qua audio service
    // Sẽ được cập nhật qua signals từ audio service
  }

  private setPlayerThemeColor() {
    this.themeService.setPageHeaderThemeColor('#312e81');
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
  }

  previousTrack() {
    this.audioPlayerService.playPrevious();
  }

  nextTrack() {
    this.audioPlayerService.playNext();
  }

  toggleShuffle() {
    this.audioPlayerService.toggleShuffle();
  }

  toggleRepeat() {
    this.audioPlayerService.toggleRepeat();
  }  // Enhanced Progress bar interaction
  onProgressClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const progress = this.calculateProgress(event);
    const newTime = (progress / 100) * this.duration();

    console.log(`🎯 Click seek to: ${newTime.toFixed(2)}s (${progress.toFixed(1)}%)`);

    // Immediate UI feedback
    this.tempProgress.set(progress);
    this.isDragging.set(true);

    // Perform seek with proper error handling
    this.audioPlayerService
      .seek(newTime)
      .then(() => {
        console.log('✅ Click seek completed');
        this.isDragging.set(false);
      })
      .catch((error) => {
        console.error('❌ Click seek failed:', error);
        this.isDragging.set(false);        // Reset to current position on error
        const currentProgress = this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0;
        this.tempProgress.set(currentProgress);
      });
  }

  onProgressStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging.set(true);
    this.isHoveringProgress.set(true);
    this.updateProgress(event);

    // Add global event listeners for better tracking
    document.addEventListener('mousemove', this.onGlobalMouseMove, {
      passive: false,
    });
    document.addEventListener('mouseup', this.onGlobalMouseUp);
    document.addEventListener('touchmove', this.onGlobalTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', this.onGlobalTouchEnd);
  }

  onProgressMove(event: MouseEvent | TouchEvent) {
    if (!this.isDragging()) {
      // Show hover preview
      this.isHoveringProgress.set(true);
      const progress = this.calculateProgress(event);
      this.hoverProgress.set(progress);
    } else {
      this.updateProgress(event);
    }
  }  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.isDragging()) {
      // Only update progress if event has valid currentTarget
      if (event.currentTarget && typeof (event.currentTarget as HTMLElement).getBoundingClientRect === 'function') {
        this.updateProgress(event);
      }
      // Otherwise use the current tempProgress value (already set by global events)

      const newTime = (this.tempProgress() / 100) * this.duration();

      console.log(`🎯 Drag seek to: ${newTime.toFixed(2)}s (${this.tempProgress().toFixed(1)}%)`);

      // Perform seek with proper error handling
      this.audioPlayerService
        .seek(newTime)
        .then(() => {
          console.log('✅ Drag seek completed');
        })
        .catch((error) => {
          console.error('❌ Drag seek failed:', error);
          // Reset to current position on error
          const currentProgress = this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0;
          this.tempProgress.set(currentProgress);
        })
        .finally(() => {
          this.isDragging.set(false);
          this.cleanupGlobalListeners();
        });
    }
  }

  onProgressLeave() {
    if (!this.isDragging()) {
      this.isHoveringProgress.set(false);
      this.hoverProgress.set(-1);
    }
  }

  private cleanupGlobalListeners() {
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  }
  // Global event handlers for better drag experience
  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.isDragging()) {
      event.preventDefault();
      this.updateProgressFromGlobalEvent(event);
    }
  };
  private onGlobalMouseUp = (event: MouseEvent) => {
    if (this.isDragging()) {
      this.finishDrag();
    }
  };

  private onGlobalTouchMove = (event: TouchEvent) => {
    if (this.isDragging()) {
      event.preventDefault();
      this.updateProgressFromGlobalEvent(event);
    }
  };

  private onGlobalTouchEnd = (event: TouchEvent) => {
    if (this.isDragging()) {
      this.finishDrag();
    }
  };

  private finishDrag() {
    if (!this.isDragging()) return;

    const newTime = (this.tempProgress() / 100) * this.duration();
    console.log(`🎯 Finish drag seek to: ${newTime.toFixed(2)}s (${this.tempProgress().toFixed(1)}%)`);

    // Perform seek with proper error handling
    this.audioPlayerService
      .seek(newTime)
      .then(() => {
        console.log('✅ Drag seek completed');
      })
      .catch((error) => {
        console.error('❌ Drag seek failed:', error);
        // Reset to current position on error
        const currentProgress = this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0;
        this.tempProgress.set(currentProgress);
      })
      .finally(() => {
        this.isDragging.set(false);
        this.cleanupGlobalListeners();
      });
  }
  private calculateProgress(event: MouseEvent | TouchEvent): number {
    const target = event.currentTarget as HTMLElement;
    if (!target || typeof target.getBoundingClientRect !== 'function') {
      console.warn('Invalid target for calculateProgress');
      return 0;
    }

    const rect = target.getBoundingClientRect();
    let clientX: number;

    if ('touches' in event) {
      // TouchEvent
      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
      } else if (event.changedTouches && event.changedTouches.length > 0) {
        // Use changedTouches for touchend event
        clientX = event.changedTouches[0].clientX;
      } else {
        console.warn('No touch coordinates available');
        return 0;
      }
    } else {
      // MouseEvent
      clientX = event.clientX;
    }

    const progress = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  private updateProgress(event: MouseEvent | TouchEvent) {
    const progress = this.calculateProgress(event);
    this.tempProgress.set(progress);
  }
  private updateProgressFromGlobalEvent(event: MouseEvent | TouchEvent) {
    // Find the progress container element
    const progressContainer = document.querySelector(
      '[data-progress-container]'
    ) as HTMLElement;
    if (!progressContainer) {
      console.warn('Progress container not found');
      return;
    }

    const rect = progressContainer.getBoundingClientRect();
    let clientX: number;

    if ('touches' in event) {
      // TouchEvent
      if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
      } else if (event.changedTouches && event.changedTouches.length > 0) {
        // Use changedTouches for touchend event
        clientX = event.changedTouches[0].clientX;
      } else {
        console.warn('No touch coordinates available in global event');
        return;
      }
    } else {
      // MouseEvent
      clientX = event.clientX;
    }

    const progress = ((clientX - rect.left) / rect.width) * 100;
    const clampedProgress = Math.max(0, Math.min(100, progress));
    this.tempProgress.set(clampedProgress);
  }
  async toggleFavorite() {
    const song = this.currentSong();
    if (song) {
      try {
        await this.databaseService.toggleFavorite(song.id);
        // Update the song object
        song.isFavorite = !song.isFavorite;
        this.audioPlayerService.updateCurrentSong(song);
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    }
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getRepeatColor(): string {
    return this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-gray-400';
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'text-purple-500' : 'text-gray-400';
  }
}
