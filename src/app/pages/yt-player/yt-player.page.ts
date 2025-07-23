// Progress bar logic

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { YtMusicService } from '../../services/api/ytmusic.service';
import { YTPlayerTrack } from 'src/app/interfaces/ytmusic.interface';
import { YtPlayerService } from 'src/app/services/yt-player.service';

@Component({
  selector: 'app-yt-player',
  templateUrl: './yt-player.page.html',
  styleUrls: ['./yt-player.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class YtPlayerPage implements OnInit {
  @ViewChild('ytIframe', { static: false })
  ytIframe?: ElementRef<HTMLIFrameElement>;
  ytPlayer: any = null;
  iframeKey = 1;

  videoId: string = '';
  playlist: YTPlayerTrack[] = [];
  currentIndex: number = 0;
  currentSong: YTPlayerTrack | null = null;
  isPlaying: boolean = true;
  safeVideoUrl: SafeResourceUrl = '';
  ytApiData: any = null;
  audioUrl: string = '';
  songTitle: string = '';
  songArtist: string = '';
  songThumbnail: string = '';
  songDuration: string = '';
  songViews: string = '';

  private destroy$ = new Subject<void>();

  videoDuration: number = 0;
  videoCurrentTime: number = 0;
  dragging: boolean = false;
  hoverPercent: number = -1;
  tempProgress: number = 0; // progress tạm khi kéo

  private iframeReady = false;
  private shouldInitPlayer = false;
  showIframe: boolean = false;



  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private router: Router,
    private ytMusicService: YtMusicService,
    private ytPlayerService: YtPlayerService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
     private location: Location
  ) {}

  ngOnInit() {
    this.updateCurrentTrackFromParams();
  }

  private updateCurrentTrackFromParams() {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const videoId = params.get('v');
        const playlist = this.ytPlayerService.currentPlaylist();
        this.playlist = playlist || [];
        this.currentIndex = this.playlist.findIndex(
          (s) => s.videoId === videoId
        );
        this.currentSong = this.playlist[this.currentIndex] || null;
        if (videoId) {
          this.videoId = videoId;
          this.updateSongInfo();
        }
      });
  }

  ngOnDestroy() {
    // Hủy subscription
    this.destroy$.next();
    this.destroy$.complete();

    // Cleanup global listeners
    this.cleanupGlobalListeners();

    // Hủy player
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy();
      } catch (e) {
        console.warn('Error destroying player in ngOnDestroy:', e);
      }
      this.ytPlayer = null;
    }

    // Reset states
    this.iframeReady = false;
    this.shouldInitPlayer = false;
  }

  formatDuration(seconds: string): string {
    const sec = parseInt(seconds, 10);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s < 10 ? '0' : ''}${s}`;
  }

  updateSafeUrl(videoId: string) {
    // Hủy player cũ nếu có
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy();
      } catch (e) {
        console.warn('Error destroying player:', e);
      }
      this.ytPlayer = null;
    }

    // Reset states
    this.iframeReady = false;
    this.showIframe = false;

    // Force change detection
    this.cdr.detectChanges();

    // Tạo URL mới với timestamp để tránh cache
    const timestamp = Date.now();
    const newUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&t=${timestamp}`;
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(newUrl);
    // Tăng iframe key
    this.iframeKey++;
    this.showIframe = true;
    // Force change detection ngay lập tức
    this.cdr.detectChanges();
    // Đợi iframe render xong
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

  // Điều khiển phát nhạc
  play() {
    this.isPlaying = true;
    if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      this.ytPlayer.playVideo();
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      this.ytPlayer.pauseVideo();
    }
  }

  next() {
    if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
      this.currentSong = this.playlist[this.currentIndex];
      this.videoId = this.currentSong.videoId;
      this.isPlaying = true;
      this.updateSongInfo(false);
      this.updateSafeUrl(this.videoId);
      this.updateUrlWithLocation();
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentSong = this.playlist[this.currentIndex];
      this.videoId = this.currentSong.videoId;
      this.isPlaying = true;
      this.updateSongInfo(false);
      this.updateSafeUrl(this.videoId);
      this.updateUrlWithLocation();
    }
  }

  private updateUrlWithLocation() {
    const queryParams = new URLSearchParams();
    queryParams.set('v', this.videoId);
    const playlistId = this.ytPlayerService.playlistId();
    if (playlistId) {
      queryParams.set('list', playlistId);
    }
    const newUrl = `/yt-player?${queryParams.toString()}`;
    this.location.replaceState(newUrl, '');
  }

  private updateSongInfo(callUpdateSafeUrl: boolean = true) {
    this.songTitle = this.currentSong?.title || '';
    this.songArtist =
      this.currentSong?.artists && this.currentSong.artists.length > 0
        ? this.currentSong.artists[0].name || ''
        : '';
    this.songThumbnail =
      this.currentSong?.thumbnail && this.currentSong.thumbnail.length > 0
        ? this.currentSong.thumbnail[this.currentSong.thumbnail.length - 1]
            .url || ''
        : '';
    this.songDuration = this.currentSong?.length || '';
    this.songViews = this.currentSong?.views || '';
    if (callUpdateSafeUrl) {
      this.updateSafeUrl(this.videoId);
    }
  }

  onIframeEnded() {
    this.next();
  }

  getCurrentSongInfo() {
    return this.currentSong;
  }

  getPlaylist() {
    return this.playlist;
  }

  getPlayerState() {
    return this.isPlaying ? 'playing' : 'paused';
  }

  handleBack() {
    this.router.navigate(['/search']);
  }

  ngAfterViewInit() {
    this.loadYouTubeAPI();
  }

  private loadYouTubeAPI() {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = (error) => {
        console.error('Failed to load YouTube API script:', error);
      };
      document.body.appendChild(tag);
    }

    // Set callback
    const callbackName = `onYTReady_${Date.now()}`;
    (window as any)[callbackName] = () => {
      this.shouldInitPlayer = true;
      if (this.iframeReady && this.ytIframe?.nativeElement && !this.ytPlayer) {
        this.initPlayer();
      }
    };
    (window as any).onYouTubeIframeAPIReady = (window as any)[callbackName];

    // Check if API is already available
    if ((window as any).YT && (window as any).YT.Player) {
      this.shouldInitPlayer = true;
      if (this.iframeReady && this.ytIframe?.nativeElement && !this.ytPlayer) {
        this.initPlayer();
      }
    }

  }

  initPlayer() {
    if (!this.ytIframe?.nativeElement) {
      setTimeout(() => {
        if (!this.ytPlayer) {
          this.initPlayer();
        }
      }, 200);
      return;
    }
    if (!this.shouldInitPlayer) {
      return;
    }
    if (this.ytPlayer) {
      return;
    }

    try {
      this.ytPlayer = new (window as any).YT.Player(this.ytIframe.nativeElement, {
        events: {
          onReady: (event: any) => {
            this.ngZone.run(() => {
              this.videoDuration = event.target.getDuration();
              this.isPlaying = true;
              event.target.playVideo();
              this.syncProgress();
            });
          },
          onStateChange: (event: any) => {
            this.ngZone.run(() => {
              if (event.data === 0) this.next(); // Ended
              if (event.data === 2) this.isPlaying = false; // Paused
              if (event.data === 1) this.isPlaying = true; // Playing
            });
          },
          onError: (event: any) => {
            console.error('YouTube Player Error:', event.data);
          }
        },
      });
    } catch (error) {
      console.error('Error creating YouTube Player:', error);
      setTimeout(() => {
        if (!this.ytPlayer) {
          this.initPlayer();
        }
      }, 500);
    }
  }

  syncProgress() {
    if (!this.ytPlayer) return;
    const update = () => {
      if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        this.ngZone.run(() => {
          this.videoCurrentTime = this.ytPlayer.getCurrentTime();
          this.videoDuration = this.ytPlayer.getDuration();
        });
      }
      requestAnimationFrame(update);
    };
    update();
  }

  // ...existing code...
  bufferProgress(): number {
    // YouTube không expose buffered, luôn 100%
    return 100;
  }
  hoverProgress(): number {
    return this.hoverPercent;
  }
  isDragging(): boolean {
    return this.dragging;
  }
  isHoveringProgress(): boolean {
    return this.hoverPercent >= 0;
  }
  formatTime(sec: number): string {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
  duration(): number {
    return this.videoDuration || 0;
  }
  progressTime(): string {
    return this.formatTime(this.videoCurrentTime);
  }
  durationTime(): string {
    return this.formatTime(this.videoDuration);
  }

  onProgressClick(event: MouseEvent) {
    this.seekToEvent(event);
  }

  onProgressStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.dragging = true;
    this.updateProgress(event);
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
    if (!this.dragging) {
      this.setHoverPercent(event);
    } else {
      this.updateProgress(event);
    }
  }

  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.dragging) {
      this.finishDrag();
    }
  }

  onProgressLeave() {
    if (!this.dragging) {
      this.hoverPercent = -1;
    }
  }

  // --- Global event handlers ---
  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.dragging) {
      event.preventDefault();
      this.updateProgressFromGlobalEvent(event);
    }
  };
  private onGlobalMouseUp = (event: MouseEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };
  private onGlobalTouchMove = (event: TouchEvent) => {
    if (this.dragging) {
      event.preventDefault();
      this.updateProgressFromGlobalEvent(event);
    }
  };
  private onGlobalTouchEnd = (event: TouchEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };

  private finishDrag() {
    if (!this.dragging) return;
    const seekTime = (this.tempProgress / 100) * this.videoDuration;
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seekTime, true);
      this.videoCurrentTime = seekTime;
    }
    this.dragging = false;
    this.hoverPercent = -1;
    this.cleanupGlobalListeners();
  }

  private cleanupGlobalListeners() {
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  }

  setHoverPercent(event: MouseEvent | TouchEvent) {
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    const progressElem = document.querySelector(
      '[data-progress-container]'
    ) as HTMLElement;
    if (progressElem) {
      const rect = progressElem.getBoundingClientRect();
      const percent = ((clientX - rect.left) / rect.width) * 100;
      this.hoverPercent = Math.max(0, Math.min(100, percent));
    }
  }

  updateProgress(event: MouseEvent | TouchEvent) {
    const percent = this.calculateProgress(event);
    this.tempProgress = percent;
  }

  updateProgressFromGlobalEvent(event: MouseEvent | TouchEvent) {
    const progressElem = document.querySelector(
      '[data-progress-container]'
    ) as HTMLElement;
    if (!progressElem) return;
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    const rect = progressElem.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    this.tempProgress = Math.max(0, Math.min(100, percent));
  }

  calculateProgress(event: MouseEvent | TouchEvent): number {
    const progressElem = document.querySelector(
      '[data-progress-container]'
    ) as HTMLElement;
    if (!progressElem) return 0;
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    const rect = progressElem.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  seekToEvent(event: MouseEvent | TouchEvent | undefined) {
    if (!event) return;
    const percent = this.calculateProgress(event);
    const seekTime = (percent / 100) * this.videoDuration;
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seekTime, true);
      this.videoCurrentTime = seekTime;
    }
  }

  // --- Progress bar binding ---
  progress(): number {
    if (this.dragging) return this.tempProgress;
    if (!this.videoDuration) return 0;
    return (this.videoCurrentTime / this.videoDuration) * 100;
  }
}
