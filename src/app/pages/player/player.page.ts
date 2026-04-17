import { UiStateService } from '@core/ui/ui-state.service';
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
  effect,
  EffectRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStore } from '../../core/stores/player.store';
import { ModalService } from '../../core/ui/modal.service';
import { DownloadStore } from '../../core/stores/download.store';
import {
  IonicModule,
  Gesture,
  GestureController,
} from '@ionic/angular';
import { ThemeService } from '@core/platform/theme.service';
import { BtnDownAndHeartComponent } from "src/app/components/btn-down-and-heart/btn-down-and-heart.component";
import { BtnAddPlaylistComponent } from "src/app/components/btn-add-playlist/btn-add-playlist.component";
import { ProgressBarComponent } from "src/app/components/progress-bar/progress-bar.component";
import { PlayerInfoComponent } from "src/app/components/player-info/player-info.component";
import { PlayerHeaderComponent } from "src/app/components/player-header/player-header.component";


/**
 * Trang giao di?n Tr�nh Ph�t Nh?c ch�nh (Player Page).
 *
 * Ch?c nang:
 * - Hi?n th? ?nh b�a Album/Track d?ng dia than xoay tr�n.
 * - Map c�c Signals t? `PlayerStore` d? hi?n th? d?ng b? ti?n tr�nh nh?c.
 * - �i?u khi?n Play, Pause, Next, Prev, Sync Lyrics.
 * - H? tr? thao t�c k�o th? Gesture d? d�ng modal (vu?t xu?ng).
 */
@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, IonicModule, BtnDownAndHeartComponent, BtnAddPlaylistComponent, ProgressBarComponent, PlayerInfoComponent, PlayerHeaderComponent],
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
})
export class PlayerPage implements OnInit, AfterViewInit, OnDestroy {
  // ═══ STORES (2 main + 2 lightweight) ═══
  readonly player = inject(PlayerStore);
  private readonly modal = inject(ModalService);
  private readonly downloadStore = inject(DownloadStore);
  private readonly themeService = inject(ThemeService);
  private readonly gestureCtrl = inject(GestureController);
  private readonly titleService = inject(UiStateService);

  // ═══ SIGNALS — Delegate to PlayerStore ═══
  readonly currentSong = this.player.currentSong;
  readonly playbackState = this.player.playbackState;
  readonly currentTime = this.player.currentTime;
  readonly duration = this.player.duration;
  readonly isPlaying = this.player.isPlaying;
  readonly isShuffling = this.player.isShuffling;
  readonly repeatMode = this.player.repeatMode;
  readonly currentIndex = this.player.currentIndex;
  readonly bufferProgress = this.player.bufferProgress;

  // ═══ UI-only signals ═══
  readonly isDragging = signal(false);
  readonly tempProgress = signal(0);
  readonly hoverProgress = signal(-1);
  readonly isHoveringProgress = signal(false);
  readonly downloads$ = this.downloadStore.downloads$;

  @ViewChild('modalContent', { read: ElementRef }) modalContent!: ElementRef;
  private swipeGesture!: Gesture;
  private currentSongEffect!: EffectRef;

  // ═══ COMPUTED ═══
  progress = computed(() => {
    if (this.isDragging()) return this.tempProgress();
    return this.player.progress();
  });

  progressTime = this.player.formattedCurrentTime;
  durationTime = this.player.formattedDuration;

  constructor() {
    this.currentSongEffect = effect(() => {
      const song = this.currentSong();
      this.titleService.setTitle(
        song
          ? `${song.title} - ${song.artist} | Ứng dụng nghe nhạc hiện đại`
          : 'XTMusic - Ứng dụng nghe nhạc hiện đại'
      );
    });
  }

  ngOnInit() {}

  ngAfterViewInit() {
    setTimeout(() => this.createSwipeGesture(), 100);
  }

  ngOnDestroy() {
    this.themeService.setHeaderThemeColor('#000000');
    if (this.swipeGesture) this.swipeGesture.destroy();
    this.currentSongEffect?.destroy?.();
  }

  // ═══ GESTURE ═══
  private createSwipeGesture() {
    if (!this.modalContent?.nativeElement) return;
    try {
      this.swipeGesture = this.gestureCtrl.create({
        el: this.modalContent.nativeElement,
        threshold: 15,
        gestureName: 'swipe-down',
        direction: 'y',
        passive: false,
        onMove: (ev) => this.onSwipeMove(ev),
        onEnd: (ev) => this.onSwipeEnd(ev),
      });
      this.swipeGesture.enable();
    } catch (error) {
      console.error('Error creating swipe gesture:', error);
    }
  }

  private onSwipeMove(ev: any) {
    // Just track, no visual effects
  }

  private onSwipeEnd(ev: any) {
    if (ev.deltaY > 80 && ev.startY < 100) {
      this.closeModal();
    }
  }

  // ═══ ACTIONS — Delegate to stores ═══
  openPlaylist() {
    this.modal.openCurrentPlaylist();
  }

  closeModal() {
    this.modal.smartClose();
  }

  togglePlayPause() {
    this.player.togglePlayPause();
  }

  previousTrack() {
    this.player.playPrevious();
  }

  nextTrack() {
    this.player.playNext();
  }

  toggleShuffle() {
    this.player.toggleShuffle();
  }

  toggleRepeat() {
    this.player.toggleRepeat();
  }

  async toggleFavorite() {
    await this.player.toggleFavorite();
  }

  getRepeatColor(): string {
    return this.player.repeatColor();
  }

  getShuffleColor(): string {
    return this.player.shuffleColor();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

  isDownloaded(songId: string): boolean {
    return this.player.isSongDownloaded(songId);
  }

  async toggleDownload(): Promise<void> {
    await this.player.downloadCurrentSong();
  }

  get currentDownloadTask() {
    const song = this.currentSong();
    if (!song) return null;
    return this.downloadStore.getTask(song.id);
  }
}
