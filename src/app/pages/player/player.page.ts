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
import { ProgressBarComponent } from "src/app/components/progress-bar/progress-bar.component";
import { PlayerInfoComponent } from "src/app/components/player-info/player-info.component";
import { PlayerHeaderComponent } from "src/app/components/player-header/player-header.component";
import { formatTime } from 'src/app/utils/format-time.util';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, IonicModule, BtnDownAndHeartComponent, BtnAddPlaylistComponent, ProgressBarComponent, PlayerInfoComponent, PlayerHeaderComponent],
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
})
export class PlayerPage implements OnInit, AfterViewInit, OnDestroy {
  public  audioPlayerService = inject(AudioPlayerService);
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
    return formatTime(current);
  });

  durationTime = computed(() => formatTime(this.duration()));

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
