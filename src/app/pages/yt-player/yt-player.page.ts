// Progress bar logic

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { YtMusicService } from '../../services/api/ytmusic.service';
import { YTPlayerTrack } from 'src/app/interfaces/ytmusic.interface';

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

  videoDuration: number = 0;
  videoCurrentTime: number = 0;
  dragging: boolean = false;
  hoverPercent: number = -1;
  tempProgress: number = 0; // progress tạm khi kéo

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private router: Router,
    private ytMusicService: YtMusicService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    // Lấy videoId từ route
    this.route.paramMap.subscribe((params) => {
      this.videoId = params.get('videoId') || '';
      this.updateSafeUrl();
      // Gọi API lấy thông tin chi tiết bài hát
      if (this.videoId) {
        // // this.setSongInfoFromApi(this.videoId, this.currentSong);
        // this.setPlaylistWithRelated(this.videoId);
      }
    });
  }

  // setPlaylistWithRelated(videoId: string) {
  //   this.ytMusicService.getPlaylistWithRelated(videoId).subscribe({
  //     next: (data) => {
  //       console.log(data);
  //       this.playlist = data.watch.tracks || [];
  //       this.currentIndex = this.playlist.findIndex(
  //         (s: any) => s.videoId === videoId
  //       );
  //       this.currentSong = this.playlist[this.currentIndex] || null;
  //       this.isPlaying = true;
  //       // this.updateSafeUrl();
  //       this.setSongInfoFromApi(videoId, this.currentSong);
  //     },
  //     error: () => {
  //       this.playlist = [];
  //       this.currentIndex = 0;
  //       this.currentSong = null;
  //     },
  //   });
  // }

  setSongInfoFromApi(videoId: string, fallbackSong: YTPlayerTrack | null) {
    this.ytMusicService.getSong(videoId).subscribe({
      next: (data: any) => {
        this.ytApiData = data;
        this.audioUrl = data.audio_url || '';
        this.songTitle = data.videoDetails?.title || fallbackSong?.title || '';
        this.songArtist =
          data.videoDetails?.author ||
          (fallbackSong?.artists && fallbackSong.artists.length > 0
            ? fallbackSong.artists[0].name || ''
            : '');
        this.songThumbnail =
          data.microformat?.microformatDataRenderer?.thumbnail?.thumbnails?.slice(
            -1
          )[0]?.url ||
          (fallbackSong?.thumbnail && fallbackSong.thumbnail.length > 0
            ? fallbackSong.thumbnail[fallbackSong.thumbnail.length - 1].url ||
              ''
            : '');
        this.songDuration = this.formatDuration(
          data.videoDetails?.lengthSeconds ||
            (fallbackSong?.length
              ? this.parseDurationToSeconds(fallbackSong.length)
              : '0')
        );
        this.songViews = data.videoDetails?.viewCount || '';
      },
      error: () => {
        this.audioUrl = '';
        this.songTitle = fallbackSong?.title || '';
        this.songArtist =
          fallbackSong?.artists && fallbackSong.artists.length > 0
            ? fallbackSong.artists[0].name || ''
            : '';
        this.songThumbnail =
          fallbackSong?.thumbnail && fallbackSong.thumbnail.length > 0
            ? fallbackSong.thumbnail[fallbackSong.thumbnail.length - 1].url ||
              ''
            : '';
        this.songDuration = fallbackSong?.length || '';
        this.songViews = '';
      },
    });
  }

  private parseDurationToSeconds(length: string): string {
    if (!length) return '0';
    const parts = length.split(':').map(Number);
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]).toString();
    }
    return '0';
  }

  formatDuration(seconds: string): string {
    const sec = parseInt(seconds, 10);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s < 10 ? '0' : ''}${s}`;
  }

  updateSafeUrl() {
    // Hủy player cũ nếu có
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      this.ytPlayer.destroy();
      this.ytPlayer = null;
    }
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${this.videoId}?autoplay=1&enablejsapi=1`
    );
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
      this.router.navigate(['/yt-player', this.videoId]);
      this.updateSafeUrl();
      this.setSongInfoFromApi(this.videoId, this.currentSong);
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentSong = this.playlist[this.currentIndex];
      this.videoId = this.currentSong.videoId;
      this.isPlaying = true;
      this.router.navigate(['/yt-player', this.videoId]);
      this.updateSafeUrl();
      this.setSongInfoFromApi(this.videoId, this.currentSong);
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
    // YouTube IFrame API
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
    (window as any).onYouTubeIframeAPIReady = () => {
      this.initPlayer();
    };
    if ((window as any).YT && (window as any).YT.Player) {
      this.initPlayer();
    }
  }

  ytPlayer: any = null;
  initPlayer() {
    if (!this.ytIframe) return;
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
      },
    });
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
