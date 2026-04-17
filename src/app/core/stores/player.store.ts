import { Injectable, signal, computed, inject } from '@angular/core';
import { Song, DataSong, PlaybackState } from '@core/interfaces/song.interface';
import { AudioPlayerService } from '@core/services/audio-player.service';
import { DatabaseService } from '@core/data/database.service';
import { DownloadService } from '@core/services/download.service';
import { formatTime } from '@core/utils/format-time.util';

/**
 * Store trung tâm quản lý toàn bộ trạng thái Trình phát nhạc (Playback State).
 *
 * Chức năng cốt lõi:
 * - Bao bọc `AudioPlayerService` để che giấu các thao tác low-level (HTMLAudioElement).
 * - Cung cấp tập hợp các Signals (Read-only) cho UI Component (như Progress, Time, Control States).
 * - Điều phối các hành động nghiệp vụ (Ví dụ: `toggleFavorite`, `downloadCurrent`) 
 *   mà không bắt Component phải inject trực tiếp `DatabaseService` hay `DownloadService`.
 */
@Injectable({ providedIn: 'root' })
export class PlayerStore {
  // ─────────────────────────────────────────────────────────
  // Dependencies (Sử dụng DI Inject ẩn, không lộ diện cho UI)
  // ─────────────────────────────────────────────────────────
  private audio = inject(AudioPlayerService);
  private db = inject(DatabaseService);
  private downloads = inject(DownloadService);

  // ─────────────────────────────────────────────────────────
  // STATE — Read-only signals đổ trực tiếp cho View
  // ─────────────────────────────────────────────────────────

  /** Bài hát hiện tại đang được nạp hoặc đang phát */
  readonly currentSong = this.audio.currentSong;

  /** Trạng thái chi tiết của bộ phát (dành cho logic chuyên sâu) */
  readonly playbackState = this.audio.playbackState;

  /** Thời gian phát hiện tại (giây) */
  readonly currentTime = this.audio.currentTime;

  /** Tổng thời lượng bài hát (giây) */
  readonly duration = this.audio.duration;

  /** Cờ cho biết nhạc có đang phát hay không */
  readonly isPlaying = this.audio.isPlayingSignal;

  /** Cờ chế độ phát ngẫu nhiên (Shuffle) */
  readonly isShuffling = this.audio.isShuffling;

  /** Chế độ lặp lại (0: Tắt, 1: Lặp 1 bài, 2: Lặp toàn bộ) */
  readonly repeatMode = this.audio.repeatModeSignal;

  /** Danh sách bài hát đang chờ phát (Queue) */
  readonly queue = this.audio.queue;

  /** Vị trí (Index) của bài hát hiện tại trong Queue */
  readonly currentIndex = this.audio.currentIndex;

  /** Buffer progress (0-100) */
  readonly bufferProgress = this.audio.bufferProgress;

  /** ID của Playlist hoặc gốc rễ danh sách được gán mới nhất */
  get lastPlaylistId(): string | null {
    return this.audio.lastPlaylistId;
  }

  // ─────────────────────────────────────────────────────────
  // COMPUTED — State Phái Sinh (Tự động cập nhật UI)
  // ─────────────────────────────────────────────────────────

  /** Playback progress percentage (0-100) */
  readonly progress = computed(() => {
    const total = this.duration();
    return total > 0 ? (this.currentTime() / total) * 100 : 0;
  });

  /** Formatted current time (mm:ss) */
  readonly formattedCurrentTime = computed(() =>
    formatTime(this.currentTime())
  );

  /** Formatted total duration (mm:ss) */
  readonly formattedDuration = computed(() =>
    formatTime(this.duration())
  );

  /** Whether there is a song loaded (even if paused) */
  readonly hasSong = computed(() => this.currentSong() !== null);

  /** CSS class for repeat button color */
  readonly repeatColor = computed(() =>
    this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-white'
  );

  /** CSS class for shuffle button color */
  readonly shuffleColor = computed(() =>
    this.isShuffling() ? 'text-purple-500' : 'text-white'
  );

  // ─────────────────────────────────────────────────────────
  // ACTIONS — Lệnh điều khiển gửi từ UI thao tác xuống Service
  // ─────────────────────────────────────────────────────────

  /** Set playlist and start playing from index */
  async setPlaylist(songs: Song[], index: number, playlistId?: string): Promise<void> {
    await this.audio.setPlaylist(songs, index, playlistId);
  }

  /** Toggle play/pause */
  async togglePlayPause(): Promise<void> {
    await this.audio.togglePlayPause();
  }

  /** Play next song */
  async playNext(): Promise<void> {
    await this.audio.playNext();
  }

  /** Play previous song */
  async playPrevious(): Promise<void> {
    await this.audio.playPrevious();
  }

  /** Toggle shuffle mode */
  toggleShuffle(): void {
    this.audio.toggleShuffle();
  }

  /** Toggle repeat mode (none → one → all) */
  toggleRepeat(): void {
    this.audio.toggleRepeat();
  }

  /** Seek to specific time */
  async seek(time: number): Promise<void> {
    await this.audio.seek(time);
  }

  /** Seek to specific time (instant, no pause/resume) */
  seekTo(time: number): void {
    this.audio.seekTo(time);
  }

  /** Pause playback */
  async pause(): Promise<void> {
    await this.audio.pause();
  }

  /** Resume playback */
  async resume(): Promise<void> {
    await this.audio.resume();
  }

  /** Set volume (0-1) */
  setVolume(volume: number): void {
    this.audio.setVolume(volume);
  }

  /** Toggle mute */
  toggleMute(): void {
    this.audio.toggleMute();
  }

  /** Play specific song from queue by index */
  async playFromQueue(index: number): Promise<void> {
    await this.audio.playFromQueue(index);
  }

  /** Remove song from queue by index */
  removeFromQueue(index: number): void {
    this.audio.removeFromQueue(index);
  }

  /** Reorder playlist without resetting playback */
  reorderPlaylistInPlace(playlist: Song[], newCurrentIndex: number): void {
    this.audio.reorderPlaylistInPlace(playlist, newCurrentIndex);
  }

  /** Update current song metadata (e.g., after toggling favorite) */
  updateCurrentSong(song: Song): void {
    this.audio.updateCurrentSong(song);
  }

  /** Get raw audio element (for equalizer, waveform viz) */
  getAudioElement(): HTMLAudioElement {
    return this.audio.getAudioElement();
  }

  // ─────────────────────────────────────────────────────────
  // COMPOSITE ACTIONS — Logic Nghiệp Vụ Liên Kết Các Modules (Thay cho Page)
  // ─────────────────────────────────────────────────────────

  /**
   * Toggle favorite for current song.
   * Previously, PlayerPage had to inject DatabaseService for this.
   */
  async toggleFavorite(): Promise<void> {
    const song = this.currentSong();
    if (!song) return;

    try {
      await this.db.toggleFavorite(song.id);
      const updatedSong = { ...song, isFavorite: !song.isFavorite };
      this.updateCurrentSong(updatedSong);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  /**
   * Toggle favorite for any song (not just current).
   * Used by ListPage, HomePage, etc.
   */
  async toggleFavoriteForSong(songId: string): Promise<boolean> {
    return this.db.toggleFavorite(songId);
  }

  /**
   * Check if a song is downloaded.
   * Previously, PlayerPage injected DownloadService for this.
   */
  isSongDownloaded(songId: string): boolean {
    return this.downloads.isSongDownloaded(songId);
  }

  /**
   * Download current song.
   * Previously, PlayerPage manually constructed DataSong object.
   */
  async downloadCurrentSong(): Promise<void> {
    const song = this.currentSong();
    if (!song) return;
    if (this.isSongDownloaded(song.id)) return;

    const dataSong: DataSong = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: song.thumbnail_url,
      duration: song.duration,
      duration_formatted: song.duration_formatted || '',
      keywords: song.keywords || [],
      original_url: '',
      created_at: new Date().toISOString(),
    };

    await this.downloads.downloadSong(dataSong);
  }

  /**
   * Play a song from a list (e.g., from HomePage song section click).
   * Finds the song index and sets the playlist.
   */
  async playSongFromList(song: Song, playlist: Song[]): Promise<void> {
    const index = playlist.findIndex(s => s.id === song.id);
    if (index !== -1) {
      await this.setPlaylist(playlist, index);
    }
  }

  /**
   * Play a specific song at a given index.
   * Used by CurrentPlaylistComponent.
   */
  async playSongAtIndex(song: Song, playlist: Song[], index: number): Promise<void> {
    await this.audio.playSong(song, playlist, index);
  }

  /**
   * Reorder playlist and update current index.
   * Used by CurrentPlaylistComponent drag-n-drop.
   */
  reorderPlaylist(playlist: Song[], newCurrentIndex: number): void {
    if (playlist[newCurrentIndex]?.id === this.currentSong()?.id) {
      this.audio.reorderPlaylistInPlace(playlist, newCurrentIndex);
    } else {
      this.audio.setPlaylist(playlist, newCurrentIndex);
    }
  }
}
