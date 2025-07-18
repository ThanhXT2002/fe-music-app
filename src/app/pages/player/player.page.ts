import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DatabaseService } from '../../services/database.service';
import {
  ModalController,
  IonicModule,
  Gesture,
  GestureController,
} from '@ionic/angular';
import { ThemeService } from 'src/app/services/theme.service';
import { GlobalPlaylistModalService } from 'src/app/services/global-playlist-modal.service';
import { DownloadService } from 'src/app/services/download.service';
import { DataSong } from '../../interfaces/song.interface';
import { BtnDownAndHeartComponent } from "src/app/components/btn-down-and-heart/btn-down-and-heart.component";
import { BtnAddPlaylistComponent } from "src/app/components/btn-add-playlist/btn-add-playlist.component";

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, IonicModule, BtnDownAndHeartComponent, BtnAddPlaylistComponent],
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
})
export class PlayerPage implements OnInit, AfterViewInit, OnDestroy {
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private location = inject(Location);
  private modalCtrl = inject(ModalController);
  private themeService = inject(ThemeService);
  private gestureCtrl = inject(GestureController);
  private playlistModalService = inject(GlobalPlaylistModalService);
  private downloadService = inject(DownloadService);

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
  public downloads$ = this.downloadService.downloads$;

  @ViewChild('modalContent', { read: ElementRef }) modalContent!: ElementRef;

  private swipeGesture!: Gesture;

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
  }

  ngAfterViewInit() {
    // Delay để đảm bảo DOM đã render hoàn toàn
    setTimeout(() => {
      this.createSwipeGesture();
    }, 100);
  }

  ngOnDestroy() {
    this.themeService.setHeaderThemeColor('#000000');
    this.cleanupGlobalListeners();
    if (this.swipeGesture) {
      this.swipeGesture.destroy();
    }
  }

  private createSwipeGesture() {
    if (!this.modalContent?.nativeElement) {
      return;
    }

    try {
      this.swipeGesture = this.gestureCtrl.create({
        el: this.modalContent.nativeElement,
        threshold: 15,
        gestureName: 'swipe-down',
        direction: 'y',
        passive: false, // Explicitly set since we need preventDefault
        onMove: (ev) => this.onSwipeMove(ev),
        onEnd: (ev) => this.onSwipeEnd(ev),
      });
      this.swipeGesture.enable();
    } catch (error) {
      console.error('Error creating swipe gesture:', error);
    }
  }

  private onSwipeMove(ev: any) {
    // Chỉ theo dõi khoảng cách kéo, không có hiệu ứng visual
    if (ev.deltaY > 0 && ev.startY < 100) {
      // Không làm gì cả, chỉ cho phép gesture tiếp tục
      // Loại bỏ mọi hiệu ứng transform và opacity
    }
  }

  private onSwipeEnd(ev: any) {
    const threshold = 80; // Khoảng cách vuốt tối thiểu để đóng modal

    if (ev.deltaY > threshold && ev.startY < 100) {
      // Đóng modal ngay lập tức không có animation
      this.closeModal();
    }
    // Không cần else case vì không có animation để reset
  }

  openPlaylist() {
    // Kiểm tra xem có đang ở trong ngữ cảnh modal không (khi được mở dưới dạng modal từ trang khác)
    this.modalCtrl
      .getTop()
      .then((modal) => {
        if (modal) {
          // Đang ở trong ngữ cảnh modal, sử dụng global modal service
          this.playlistModalService.open();
        } else {
          // Đang ở trong điều hướng trực tiếp, tự tạo và hiển thị modal
          this.presentPlaylistModal();
        }
      })
      .catch(() => {
        // Trường hợp dự phòng: thử tạo modal trực tiếp
        this.presentPlaylistModal();
      });
  }

  private async presentPlaylistModal() {
    try {
      const { CurrentPlaylistComponent } = await import(
        '../../components/current-playlist/current-playlist.component'
      );
      const modal = await this.modalCtrl.create({
        component: CurrentPlaylistComponent,
        presentingElement: undefined, // Allow full-screen modal
        breakpoints: [0, 0.6, 1],
        initialBreakpoint: 0.6,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });

      await modal.present();
    } catch (error) {
      console.error('Error opening playlist modal:', error);
    }
  }

  closeModal() {
    // Check if we're in a modal context or navigated directly
    this.modalCtrl
      .getTop()
      .then((modal) => {
        if (modal) {
          // We're in a modal, dismiss it
          this.modalCtrl.dismiss();
        } else {
          // We're in a direct navigation, go back to previous page
          // Check if there's a history to go back to
          if (window.history.length > 1) {
            this.location.back();
          } else {
            // Fallback to home if no history (e.g., direct URL access)
            this.router.navigate(['/tabs/home'], { replaceUrl: true });
          }
        }
      })
      .catch(() => {
        // Fallback: try going back first, then to home if that fails
        try {
          if (window.history.length > 1) {
            this.location.back();
          } else {
            this.router.navigate(['/tabs/home'], { replaceUrl: true });
          }
        } catch (error) {
          console.error('Navigation error:', error);
          this.router.navigate(['/tabs/home'], { replaceUrl: true });
        }
      });
  }

  togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
    // Force a manual trigger for change detection
    setTimeout(() => {
      this.triggerGlobalChangeDetection();
    }, 0);
  }

  previousTrack() {
    this.audioPlayerService.playPrevious();
    // Force a manual trigger for change detection
    setTimeout(() => {
      this.triggerGlobalChangeDetection();
    }, 0);
  }

  nextTrack() {
    this.audioPlayerService.playNext();
    // Force a manual trigger for change detection
    setTimeout(() => {
      this.triggerGlobalChangeDetection();
    }, 0);
  }

  toggleShuffle() {
    this.audioPlayerService.toggleShuffle();
    // Force a manual trigger for change detection
    setTimeout(() => {
      this.triggerGlobalChangeDetection();
    }, 0);
  }

  toggleRepeat() {
    this.audioPlayerService.toggleRepeat();
    // Force a manual trigger for change detection
    setTimeout(() => {
      this.triggerGlobalChangeDetection();
    }, 0);
  }

  // Helper method to trigger change detection globally
  private triggerGlobalChangeDetection() {
    // Dispatch a custom event that CurrentPlaylistComponent can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('player-action-triggered', {
          detail: { timestamp: Date.now() },
        })
      );
    }
  } // Enhanced Progress bar interaction
  onProgressClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const progress = this.calculateProgress(event);
    const newTime = (progress / 100) * this.duration();

    // Immediate UI feedback
    this.tempProgress.set(progress);
    this.isDragging.set(true);

    // Perform seek with proper error handling
    this.audioPlayerService.seek(newTime).catch((error) => {
      console.error('❌ Click seek failed:', error);
      this.isDragging.set(false); // Reset to current position on error
      const currentProgress =
        this.duration() > 0 ? (this.currentTime() / this.duration()) * 100 : 0;
      this.tempProgress.set(currentProgress);
    });
  }

  onProgressStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging.set(true);
    this.isHoveringProgress.set(true);
    this.updateProgress(event); // Add global event listeners for better tracking
    document.addEventListener('mousemove', this.onGlobalMouseMove, {
      passive: false,
    });
    document.addEventListener('mouseup', this.onGlobalMouseUp, {
      passive: true,
    });
    document.addEventListener('touchmove', this.onGlobalTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', this.onGlobalTouchEnd, {
      passive: true,
    });
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
  }
  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.isDragging()) {
      // Only update progress if event has valid currentTarget
      if (
        event.currentTarget &&
        typeof (event.currentTarget as HTMLElement).getBoundingClientRect ===
          'function'
      ) {
        this.updateProgress(event);
      }
      // Otherwise use the current tempProgress value (already set by global events)

      const newTime = (this.tempProgress() / 100) * this.duration();

      // Perform seek with proper error handling
      this.audioPlayerService
        .seek(newTime)
        .catch((error) => {
          console.error('❌ Drag seek failed:', error);
          // Reset to current position on error
          const currentProgress =
            this.duration() > 0
              ? (this.currentTime() / this.duration()) * 100
              : 0;
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

    // Perform seek with proper error handling
    this.audioPlayerService
      .seek(newTime)
      .catch((error) => {
        console.error('❌ Drag seek failed:', error);
        // Reset to current position on error
        const currentProgress =
          this.duration() > 0
            ? (this.currentTime() / this.duration()) * 100
            : 0;
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

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  getRepeatColor(): string {
    return this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-white';
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'text-purple-500' : 'text-white';
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  isDownloaded(songId: string): boolean {
    return this.downloadService.isSongDownloaded(songId);
  }

  async toggleDownload(currentSong: any): Promise<void> {
    const song: DataSong = {
      id: currentSong.id,
      title: currentSong.title,
      artist: currentSong.artist,
      thumbnail_url: currentSong.thumbnail_url,
      duration: currentSong.duration,
      duration_formatted: currentSong.duration_formatted,
      keywords: currentSong.keywords,
      original_url: '',
      created_at: new Date().toISOString(),
    };

    console.table(song);
    if (!song) return;
    if (this.isDownloaded(song.id)) {
      // Có thể show thông báo đã tải rồi
      return;
    }
    try {
      await this.downloadService.downloadSong(song);
      // Có thể show thông báo "Đã thêm vào danh sách tải"
    } catch (error) {
      console.error('Download failed:', error);
      // Có thể show thông báo lỗi
    }
  }

  get currentDownloadTask() {
    const song = this.currentSong();
    if (!song) return null;
    const downloads = this.downloadService.currentDownloads;
    return downloads.find((d) => d.songData?.id === song.id);
  }
}
