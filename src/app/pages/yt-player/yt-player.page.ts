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
import { ProgressBarComponent } from 'src/app/components/progress-bar/progress-bar.component';
import { PlayerInfoComponent } from 'src/app/components/player-info/player-info.component';
import { PlayerHeaderComponent } from 'src/app/components/player-header/player-header.component';
import { ModalController } from '@ionic/angular';
import { BtnAddPlaylistComponent } from 'src/app/components/btn-add-playlist/btn-add-playlist.component';
import { BtnDownAndHeartComponent } from 'src/app/components/btn-down-and-heart/btn-down-and-heart.component';
import { ytPlayerTrackToSong } from 'src/app/utils/yt-player-track.converter';
import { Song } from 'src/app/interfaces/song.interface';
import { formatTime } from 'src/app/utils/format-time.util';

@Component({
  selector: 'app-yt-player',
  templateUrl: './yt-player.page.html',
  styleUrls: ['./yt-player.page.scss'],
  standalone: true,
  providers: [ModalController],
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
export class YtPlayerPage implements OnInit {
  @ViewChild('ytIframe', { static: false })
  ytIframe?: ElementRef<HTMLIFrameElement>;
  ytPlayer: any = null;
  iframeKey = 1;

  song: Song | null = null;
  videoId: string = '';
  playlist: YTPlayerTrack[] = [];
  currentIndex: number = 0;
  currentSong: YTPlayerTrack | null = null;
  isPlaying: boolean = true;
  isShuffling = this.ytPlayerService.isShuffling; // Add isShuffling property
  safeVideoUrl: SafeResourceUrl = '';
  audioUrl: string = '';
  songTitle: string = '';
  songArtist: string = '';
  songThumbnail: string = '';
  songDuration: string = '';
  repeatMode = this.ytPlayerService.repeatModeSignal;

  private destroy$ = new Subject<void>();

  videoDuration: number = 0;
  videoCurrentTime: number = 0;
  dragging: boolean = false;
  hoverPercent: number = -1;
  tempProgress: number = 0; // progress tạm khi kéo

  private iframeReady = false;
  private shouldInitPlayer = false;
  showIframe: boolean = false;
  private rafId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private router: Router,
    private ytMusicService: YtMusicService,
    private ytPlayerService: YtPlayerService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private location: Location,
    private modalCtrl: ModalController
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
        if (videoId) {
          this.videoId = videoId;
          this.checkExitPlaylist(playlist ?? [], videoId);
        } else {
          this.router.navigate(['/']);
        }
      });
  }

  ngOnDestroy() {
    // Hủy subscription
    this.destroy$.next();
    this.destroy$.complete();

    // Hủy player
    if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') {
      try {
        this.ytPlayer.destroy();
      } catch (e) {
        console.warn('Error destroying player in ngOnDestroy:', e);
      }
      this.ytPlayer = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Reset states
    this.iframeReady = false;
    this.shouldInitPlayer = false;
  }

  private setPlaylistAndCurrent(playlist: YTPlayerTrack[], videoId: string) {
    this.playlist = playlist;
    this.currentIndex = playlist.findIndex(
      (track) => track.videoId === videoId
    );
    this.currentSong = this.playlist[this.currentIndex] || null;
    this.updateSongInfo();
    this.syncPlayerStateToService();
    this.setCurrentSong(this.currentSong);
  }

  checkExitPlaylist(playlist: YTPlayerTrack[], videoId: string) {
    if (playlist && playlist.some((track) => track.videoId === videoId)) {
      this.setPlaylistAndCurrent(playlist, videoId);
    } else {
      this.getPlaylistFallBack(videoId);
    }
  }

  getPlaylistFallBack(videoId: string) {
    this.ytMusicService.getPlaylistWithSong(videoId).subscribe({
      next: (res) => {
        const tracks = res.tracks;
        const playlistId = res.playlistId ?? null;
        localStorage.setItem('yt-tracks', JSON.stringify(tracks));
        localStorage.setItem('yt-playlistId', JSON.stringify(playlistId));
        this.ytPlayerService.currentPlaylist.set(tracks);
        this.ytPlayerService.playlistId.set(playlistId);
        this.setPlaylistAndCurrent(tracks, videoId);
      },
      error: (err) => {
        console.error('Error fetching playlist with related:', err);
      },
    });
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
    const newUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
      window.location.origin
    )}&t=${timestamp}`;
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
      if (
        this.shouldInitPlayer &&
        !this.ytPlayer &&
        this.ytIframe?.nativeElement
      ) {
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
    this.syncPlayerStateToService();
  }

  pause() {
    this.isPlaying = false;
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      this.ytPlayer.pauseVideo();
    }
    this.syncPlayerStateToService();
  }

  next() {
    if (this.isShuffling()) {
      // Phát ngẫu nhiên, tránh lặp lại bài hiện tại nếu có nhiều hơn 1 bài
      let nextIndex = this.currentIndex;
      if (this.playlist.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * this.playlist.length);
        } while (nextIndex === this.currentIndex);
      }
      this.updatePlayerState(nextIndex, true);
    } else if (this.currentIndex < this.playlist.length - 1) {
      this.updatePlayerState(this.currentIndex + 1, true);
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.updatePlayerState(this.currentIndex - 1, true);
    }
  }

  private updatePlayerState(index: number, play: boolean = true) {
    this.currentIndex = index;
    this.currentSong = this.playlist[this.currentIndex];
    this.videoId = this.currentSong.videoId;
    this.isPlaying = play;
    this.updateSongInfo(false);
    this.updateSafeUrl(this.videoId);
    this.updateUrlWithLocation();
    this.syncPlayerStateToService();
    this.setCurrentSong(this.currentSong);
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
      this.ytPlayer = new (window as any).YT.Player(
        this.ytIframe.nativeElement,
        {
          events: {
            onReady: (event: any) => {
              this.ngZone.run(() => {
                this.videoDuration = event.target.getDuration();
                this.isPlaying = true;
                event.target.playVideo();
                setTimeout(() => {
                  const state = event.target.getPlayerState();
                  if (state !== 1) {
                    console.warn('Autoplay bị chặn hoặc video không phát!');
                    this.isPlaying = false;
                    // Có thể hiển thị overlay yêu cầu user click để phát
                  }
                }, 500);
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
            },
          },
        }
      );
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
      this.rafId = requestAnimationFrame(update);
    };
    update();
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
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(time, true);
      this.videoCurrentTime = time;
    }
  }

  private getProgressPercent(event: MouseEvent | TouchEvent): number {
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    const progressElem = document.querySelector(
      '[data-progress-container]'
    ) as HTMLElement;
    if (!progressElem) return 0;
    const rect = progressElem.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  // --- Progress bar binding ---
  progress(): number {
    if (this.dragging) return this.tempProgress;
    if (!this.videoDuration) return 0;
    return (this.videoCurrentTime / this.videoDuration) * 100;
  }

  async openPlaylist() {
    try {
      const { YtPlaylistComponent } = await import(
        '../../components/yt-playlist/yt-playlist.component'
      );
      const modal = await this.modalCtrl.create({
        component: YtPlaylistComponent,
        componentProps: {
          playlist: this.playlist,
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
        presentingElement: undefined, // Allow full-screen modal
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

  // Handle play song event from playlist modal
  handlePlaySong(event: { song: any; playlist: any[]; index: number }) {
    this.updatePlayerState(event.index, true);
  }

  private syncPlayerStateToService() {
    this.ytPlayerService.currentIndex.set(this.currentIndex);
    this.ytPlayerService.currentSong.set(this.currentSong);
    this.ytPlayerService.isPlaying.set(this.isPlaying);
    this.ytPlayerService.songTitle.set(this.songTitle);
    this.ytPlayerService.songArtist.set(this.songArtist);
    this.ytPlayerService.songThumbnail.set(this.songThumbnail);
    this.ytPlayerService.songDuration.set(this.songDuration);
  }

  // Toggle play/pause from playlist modal
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Toggle shuffle from playlist modal
  toggleShuffle() {
    this.ytPlayerService.isShuffling.set(!this.ytPlayerService.isShuffling());
    this.syncPlayerStateToService();
  }

  toggleRepeat() {
    const current = this.ytPlayerService.repeatModeSignal();
    let next: 'none' | 'all' | 'one';
    if (current === 'none') next = 'all';
    else if (current === 'all') next = 'one';
    else next = 'none';
    this.ytPlayerService.repeatModeSignal.set(next);
    this.syncPlayerStateToService();
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'text-purple-500' : 'text-white';
  }

  getRepeatColor(): string {
    return this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-white';
  }

  // Handle reorder event from playlist modal
  handleReorder(from: number, to: number) {
    if (from !== to && this.playlist.length > 0) {
      const movedItem = this.playlist.splice(from, 1)[0];
      this.playlist.splice(to, 0, movedItem);
      // Update currentIndex if needed
      if (this.currentSong) {
        this.currentIndex = this.playlist.findIndex(
          (s) => s.videoId === this.currentSong?.videoId
        );
      }
    }
    // Force update if needed
    this.cdr.detectChanges();
  }

  getCountdownTime(): string {
    return formatTime(this.videoDuration - this.videoCurrentTime);
  }

  setCurrentSong(track: YTPlayerTrack) {
    this.song = ytPlayerTrackToSong(track);
  }
}
