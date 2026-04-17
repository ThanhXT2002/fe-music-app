import { UiStateService } from '@core/ui/ui-state.service';
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { YTPlayerTrack } from '@core/interfaces/ytmusic.interface';
import { YtPlayerStore } from '../../core/stores/yt-player.store';
import { PlayerStore } from '../../core/stores/player.store';
import { ProgressBarComponent } from 'src/app/components/progress-bar/progress-bar.component';
import { PlayerInfoComponent } from 'src/app/components/player-info/player-info.component';
import { PlayerHeaderComponent } from 'src/app/components/player-header/player-header.component';
import { ModalController } from '@ionic/angular/standalone';
import { BtnAddPlaylistComponent } from 'src/app/components/btn-add-playlist/btn-add-playlist.component';
import { BtnDownAndHeartComponent } from 'src/app/components/btn-down-and-heart/btn-down-and-heart.component';
import { Song } from '@core/interfaces/song.interface';
import { formatTime } from '@core/utils/format-time.util';



/**
 * Trang Tr�nh ph�t nh?c t? YouTube (Visual / IFrame Player).
 *
 * Ch?c nang:
 * - Nh�ng tr?c ti?p Youtube IFrame API d? ph�t v� hi?n th? video nh?c.
 * - Kh? nang nh?n link Playlist t? Web Share Target API ho?c router.
 * - Gi? l?p c�c t�nh nang gi?ng Tr�nh ph�t g?c (Ti?n tr�nh, �i?u khi?n).
 */
@Component({
  selector: 'app-yt-player',
  templateUrl: './yt-player.page.html',
  styleUrls: ['./yt-player.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProgressBarComponent,
    PlayerInfoComponent,
    PlayerHeaderComponent,
    BtnAddPlaylistComponent,
    BtnDownAndHeartComponent,
  ],
})
export class YtPlayerPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ytIframe', { static: false })
  ytIframe?: ElementRef<HTMLIFrameElement>;
  ytPlayer: any = null;
  iframeKey = 1;

  // ═══ STORES (2 main) ═══
  readonly yt = inject(YtPlayerStore);
  private readonly player = inject(PlayerStore);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly location = inject(Location);
  private readonly modalCtrl = inject(ModalController);
  private readonly titleService = inject(UiStateService);
  private readonly pageContext = inject(UiStateService);

  // ═══ STORE DELEGATES ═══
  readonly song = this.yt.currentSongAsLocal;
  readonly isPlaying = this.yt.isPlaying;
  readonly isShuffling = this.yt.isShuffling;
  readonly repeatMode = this.yt.repeatMode;
  readonly songTitle = this.yt.songTitle;
  readonly songArtist = this.yt.songArtist;
  readonly songThumbnail = this.yt.songThumbnail;
  readonly songDuration = this.yt.songDuration;
  readonly playlist = this.yt.playlist;
  readonly currentIndex = this.yt.currentIndex;
  readonly currentSong = this.yt.currentTrack;

  // ═══ UI-only state ═══
  safeVideoUrl: SafeResourceUrl = '';
  dragging = false;
  hoverPercent = -1;
  tempProgress = 0;
  showIframe = false;

  private destroy$ = new Subject<void>();
  private iframeReady = false;
  private shouldInitPlayer = false;
  private rafId: number | null = null;

  constructor() {
    // Pause local audio when entering YT player
    this.player.pause();
  }

  // ═══ LIFECYCLE ═══
  ngOnInit() {
    this.pageContext.setCurrentPage('yt-player');
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const videoId = params.get('v');
        if (videoId) {
          this.initializePlayback(videoId);
        } else {
          this.router.navigate(['/']);
        }
      });
  }

  ngAfterViewInit() {
    this.loadYouTubeAPI();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.yt.isPlaying.set(false);

    if (this.ytPlayer?.destroy) {
      try { this.ytPlayer.destroy(); } catch {}
      this.ytPlayer = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.iframeReady = false;
    this.shouldInitPlayer = false;
  }

  // ═══ INIT ═══
  private async initializePlayback(videoId: string) {
    const loaded = await this.yt.loadPlaylist(videoId);
    if (loaded) {
      this.updateSafeUrl(videoId);
      this.updateTitle();
    } else {
      this.router.navigate(['/oops-404']);
    }
  }

  private updateTitle() {
    const title = this.songTitle();
    const artist = this.songArtist();
    this.titleService.setTitle(
      title
        ? `${title} - ${artist} | Ứng dụng nghe nhạc hiện đại`
        : 'XTMusic - Ứng dụng nghe nhạc hiện đại'
    );
  }

  // ═══ YOUTUBE IFRAME ═══
  updateSafeUrl(videoId: string) {
    if (this.ytPlayer?.destroy) {
      try { this.ytPlayer.destroy(); } catch {}
      this.ytPlayer = null;
    }

    this.iframeReady = false;
    this.showIframe = false;
    this.cdr.detectChanges();

    const timestamp = Date.now();
    const newUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&t=${timestamp}`;
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(newUrl);
    this.iframeKey++;
    this.showIframe = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.iframeReady = true;
      if (this.shouldInitPlayer && this.ytIframe?.nativeElement) {
        this.initPlayer();
      }
    }, 200);
  }

  onIframeLoad() {
    this.iframeReady = true;
    setTimeout(() => {
      if (this.shouldInitPlayer && !this.ytPlayer && this.ytIframe?.nativeElement) {
        this.initPlayer();
      }
    }, 300);
  }

  private loadYouTubeAPI() {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = (error) => console.error('Failed to load YouTube API:', error);
      document.body.appendChild(tag);
    }

    const callbackName = `onYTReady_${Date.now()}`;
    (window as any)[callbackName] = () => {
      this.shouldInitPlayer = true;
      if (this.iframeReady && this.ytIframe?.nativeElement && !this.ytPlayer) {
        this.initPlayer();
      }
    };
    (window as any).onYouTubeIframeAPIReady = (window as any)[callbackName];

    if ((window as any).YT?.Player) {
      this.shouldInitPlayer = true;
      if (this.iframeReady && this.ytIframe?.nativeElement && !this.ytPlayer) {
        this.initPlayer();
      }
    }
  }

  initPlayer() {
    if (!this.ytIframe?.nativeElement) {
      setTimeout(() => { if (!this.ytPlayer) this.initPlayer(); }, 200);
      return;
    }
    if (!this.shouldInitPlayer || this.ytPlayer) return;

    try {
      this.ytPlayer = new (window as any).YT.Player(
        this.ytIframe.nativeElement,
        {
          events: {
            onReady: (event: any) => {
              this.ngZone.run(() => {
                this.yt.updateTime(0, event.target.getDuration());
                this.yt.isPlaying.set(true);
                event.target.playVideo();
                setTimeout(() => {
                  if (event.target.getPlayerState() !== 1) {
                    this.yt.isPlaying.set(false);
                  }
                }, 500);
                this.syncProgress();
              });
            },
            onStateChange: (event: any) => {
              this.ngZone.run(() => {
                if (event.data === 0) this.next();
                if (event.data === 2) this.yt.isPlaying.set(false);
                if (event.data === 1) this.yt.isPlaying.set(true);
              });
            },
            onError: (event: any) => {
              console.error('YouTube Player Error:', event.data);
            },
          },
        }
      );
    } catch (error) {
      console.error('Error creating YouTube Player:', error);
      setTimeout(() => { if (!this.ytPlayer) this.initPlayer(); }, 500);
    }
  }

  syncProgress() {
    if (!this.ytPlayer) return;
    const update = () => {
      if (this.ytPlayer?.getCurrentTime) {
        this.ngZone.run(() => {
          this.yt.updateTime(
            this.ytPlayer.getCurrentTime(),
            this.ytPlayer.getDuration()
          );
        });
      }
      this.rafId = requestAnimationFrame(update);
    };
    update();
  }

  // ═══ PLAYBACK CONTROLS ═══
  play() {
    this.yt.isPlaying.set(true);
    this.ytPlayer?.playVideo?.();
  }

  pause() {
    this.yt.isPlaying.set(false);
    this.ytPlayer?.pauseVideo?.();
  }

  togglePlayPause() {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    const videoId = this.yt.next();
    if (videoId) {
      this.updateSafeUrl(videoId);
      this.updateTitle();
    }
  }

  previous() {
    const videoId = this.yt.previous();
    if (videoId) {
      this.updateSafeUrl(videoId);
      this.updateTitle();
    }
  }

  toggleShuffle() {
    this.yt.toggleShuffle();
  }

  toggleRepeat() {
    this.yt.toggleRepeat();
  }

  getShuffleColor(): string {
    return this.yt.shuffleColor();
  }

  getRepeatColor(): string {
    return this.yt.repeatColor();
  }

  // ═══ PROGRESS BAR ═══
  progress(): number {
    if (this.dragging) return this.tempProgress;
    return this.yt.progress();
  }

  hoverProgress(): number {
    return this.hoverPercent;
  }

  setHoverPercent(event: MouseEvent | TouchEvent) {
    this.hoverPercent = this.getProgressPercent(event);
  }

  updateProgress(event: MouseEvent | TouchEvent) {
    this.tempProgress = this.getProgressPercent(event);
  }

  updateProgressFromGlobalEvent(event: MouseEvent | TouchEvent) {
    this.tempProgress = this.getProgressPercent(event);
  }

  calculateProgress(event: MouseEvent | TouchEvent): number {
    return this.getProgressPercent(event);
  }

  seekToEvent(time: number) {
    if (this.ytPlayer?.seekTo) {
      this.ytPlayer.seekTo(time, true);
      this.yt.updateTime(time, this.yt.videoDuration());
    }
  }

  private getProgressPercent(event: MouseEvent | TouchEvent): number {
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    const progressElem = document.querySelector('[data-progress-container]') as HTMLElement;
    if (!progressElem) return 0;
    const rect = progressElem.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }

  // ═══ PLAYLIST MODAL ═══
  async openPlaylist() {
    try {
      const { YtPlaylistComponent } = await import(
        '../../components/yt-playlist/yt-playlist.component'
      );
      const modal = await this.modalCtrl.create({
        component: YtPlaylistComponent,
        componentProps: {
          playlist: this.playlist(),
          progressPercentage: this.progress.bind(this),
          onPlaySong: (event: { song: any; playlist: any[]; index: number }) =>
            this.handlePlaySong(event),
          onPreviousTrack: () => this.previous(),
          onNextTrack: () => this.next(),
          onTogglePlayPause: () => this.togglePlayPause(),
          onToggleShuffle: () => this.toggleShuffle(),
          onReorder: (from: number, to: number) => this.handleReorder(from, to),
          countdownTime: this.getCountdownTime.bind(this),
        },
        breakpoints: [0, 1],
        initialBreakpoint: 1,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });
      await modal.present();
    } catch (error) {
      console.error('Error opening playlist modal:', error);
    }
  }

  handlePlaySong(event: { song: any; playlist: any[]; index: number }) {
    const videoId = this.yt.goToIndex(event.index);
    this.updateSafeUrl(videoId);
    this.updateTitle();
  }

  handleReorder(from: number, to: number) {
    this.yt.reorder(from, to);
    this.cdr.detectChanges();
  }

  getCountdownTime(): string {
    return this.yt.countdownTime();
  }

  // ═══ NAVIGATION ═══
  handleBack() {
    this.router.navigate(['/search']);
  }

  getCurrentSongInfo() {
    return this.currentSong();
  }

  getPlaylist() {
    return this.playlist();
  }

  getPlayerState() {
    return this.isPlaying() ? 'playing' : 'paused';
  }
}
