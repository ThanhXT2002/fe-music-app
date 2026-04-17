import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { YTPlayerTrack } from '@core/interfaces/ytmusic.interface';
import { Song } from '@core/interfaces/song.interface';
import { YtMusicService } from '@core/api/ytmusic.service';
import { LocalStorageService } from '../data/local-storage.service';
import { ytPlayerTrackToSong } from '@core/utils/yt-player-track.converter';
import { formatTime } from '@core/utils/format-time.util';

/**
 * Quản lý Trạng thái Trình phát nhạc Youtube (Youtube IFrame API) qua Signal Store.
 * 
 * Nhiệm vụ:
 * - Đồng bộ hóa danh sách phát, trạng thái playing độc lập với PlayerStore cục bộ.
 * - Cho phép nghe thử bài hát trước khi tiến hành Tải (Download).
 * - Lưu tiến trình và Navigation qua lại mượt mà.
 * 
 * Lưu ý: Tương tác với DOM Youtube IFrame vẫn nằm ở Component Page. Store chỉ quản lý Data State.
 */
@Injectable({ providedIn: 'root' })
export class YtPlayerStore {
  private ytMusicService = inject(YtMusicService);
  private storage = inject(LocalStorageService);
  private router = inject(Router);
  private location = inject(Location);

  // ─────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────

  /** Danh sách các bài hát trong danh sách phát (Queue) hiện tại */
  readonly playlist = signal<YTPlayerTrack[]>(
    this.storage.get<YTPlayerTrack[]>('YT_TRACKS') ?? []
  );

  /** ID của playlist hiện tại (để tự động load trang/next track) */
  readonly playlistId = signal<string | null>(
    this.storage.get<string>('YT_PLAYLIST_ID')
  );

  /** Tham chiếu ID của bài hát liên quan giúp YouTube thuật toán gợi ý tiếp tục chạy */
  readonly related = signal<string | null>(
    this.storage.get<string>('YT_RELATED')
  );

  /** Thứ tự bài hát đang chạy hiện tại trong danh sách (`playlist`) */
  readonly currentIndex = signal(0);

  /** Bài hát hiện tại đang được load trong iframe */
  readonly currentTrack = signal<YTPlayerTrack | null>(null);

  /** Cờ cho biết iframe có đang phát nhạc hay không */
  readonly isPlaying = signal(true);

  /** Chế độ tự động xáo trộn ngẫu nhiên playlist (Shuffle stream) */
  readonly isShuffling = signal(false);

  /** Repeat mode */
  readonly repeatMode = signal<'none' | 'one' | 'all'>('none');

  /** Video duration in seconds */
  readonly videoDuration = signal(0);

  /** Current playback position in seconds */
  readonly videoCurrentTime = signal(0);

  /** Song title derived from current track */
  readonly songTitle = signal('');

  /** Song artist derived from current track */
  readonly songArtist = signal('');

  /** Song thumbnail URL */
  readonly songThumbnail = signal('');

  /** Song duration string */
  readonly songDuration = signal('');

  // ─────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────

  /** Progress percentage (0-100) */
  readonly progress = computed(() => {
    const duration = this.videoDuration();
    if (!duration) return 0;
    return (this.videoCurrentTime() / duration) * 100;
  });

  /** Current track as local Song model */
  readonly currentSongAsLocal = computed(() => {
    const track = this.currentTrack();
    return track ? ytPlayerTrackToSong(track) : null;
  });

  /** Countdown time string */
  readonly countdownTime = computed(() =>
    formatTime(this.videoDuration() - this.videoCurrentTime())
  );

  /** Shuffle button color class */
  readonly shuffleColor = computed(() =>
    this.isShuffling() ? 'text-purple-500' : 'text-white'
  );

  /** Repeat button color class */
  readonly repeatColor = computed(() =>
    this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-white'
  );

  // ─────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Load playlist for a video. If the video exists in the current playlist,
   * use it. Otherwise, fetch from API.
   */
  async loadPlaylist(videoId: string): Promise<boolean> {
    const existing = this.playlist();

    if (existing.length > 0 && existing.some(t => t.videoId === videoId)) {
      this.setCurrentTrack(videoId);
      return true;
    }

    // Fetch from API
    return new Promise<boolean>((resolve) => {
      this.ytMusicService.getPlaylistWithSong(videoId).subscribe({
        next: res => {
          const tracks = res.tracks;
          const playlistId = res.playlistId ?? null;

          this.playlist.set(tracks);
          this.playlistId.set(playlistId);
          this.storage.set('YT_TRACKS', tracks);
          this.storage.set('YT_PLAYLIST_ID', playlistId);

          if (res.related) {
            this.related.set(res.related);
            this.storage.set('YT_RELATED', res.related);
          }

          this.setCurrentTrack(videoId);
          resolve(true);
        },
        error: err => {
          console.error('Error fetching playlist:', err);
          resolve(false);
        },
      });
    });
  }

  /** Set current track by videoId */
  setCurrentTrack(videoId: string): void {
    const playlist = this.playlist();
    const index = playlist.findIndex(t => t.videoId === videoId);

    if (index !== -1) {
      this.currentIndex.set(index);
      this.currentTrack.set(playlist[index]);
      this.updateSongInfo(playlist[index]);
    }
  }

  /** Go to next track */
  next(): string | null {
    const playlist = this.playlist();
    if (playlist.length === 0) return null;

    let nextIndex: number;
    if (this.isShuffling()) {
      nextIndex = this.currentIndex();
      if (playlist.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * playlist.length);
        } while (nextIndex === this.currentIndex());
      }
    } else if (this.currentIndex() < playlist.length - 1) {
      nextIndex = this.currentIndex() + 1;
    } else {
      return null; // End of playlist
    }

    return this.goToIndex(nextIndex);
  }

  /** Go to previous track */
  previous(): string | null {
    if (this.currentIndex() > 0) {
      return this.goToIndex(this.currentIndex() - 1);
    }
    return null;
  }

  /** Go to specific track index */
  goToIndex(index: number): string {
    const playlist = this.playlist();
    const track = playlist[index];

    this.currentIndex.set(index);
    this.currentTrack.set(track);
    this.isPlaying.set(true);
    this.updateSongInfo(track);
    this.updateUrlInBrowser(track.videoId);

    return track.videoId;
  }

  /** Toggle shuffle */
  toggleShuffle(): void {
    this.isShuffling.update(v => !v);
  }

  /** Toggle repeat mode (none → all → one → none) */
  toggleRepeat(): void {
    const current = this.repeatMode();
    const next = current === 'none' ? 'all'
      : current === 'all' ? 'one'
      : 'none';
    this.repeatMode.set(next);
  }

  /** Reorder playlist */
  reorder(from: number, to: number): void {
    if (from === to || this.playlist().length === 0) return;

    const list = [...this.playlist()];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this.playlist.set(list);

    // Update current index if affected
    const currentTrack = this.currentTrack();
    if (currentTrack) {
      const newIndex = list.findIndex(t => t.videoId === currentTrack.videoId);
      this.currentIndex.set(newIndex);
    }
  }

  /** Update time state (called from page during video playback) */
  updateTime(currentTime: number, duration: number): void {
    this.videoCurrentTime.set(currentTime);
    this.videoDuration.set(duration);
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────

  private updateSongInfo(track: YTPlayerTrack): void {
    this.songTitle.set(track.title || '');
    this.songArtist.set(
      track.artists && track.artists.length > 0 ? track.artists[0].name || '' : ''
    );
    this.songThumbnail.set(
      track.thumbnail && track.thumbnail.length > 0
        ? track.thumbnail[track.thumbnail.length - 1]?.url || ''
        : ''
    );
    this.songDuration.set(track.length || '');
  }

  private updateUrlInBrowser(videoId: string): void {
    const params = new URLSearchParams();
    params.set('v', videoId);
    const playlistId = this.playlistId();
    if (playlistId) params.set('list', playlistId);
    this.location.replaceState(`/yt-player?${params.toString()}`);
  }
}
