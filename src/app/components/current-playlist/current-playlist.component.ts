import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  inject,
  computed,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStore } from '../../core/stores/player.store';
import { Song } from '@core/interfaces/song.interface';
import { Subject } from 'rxjs';
import { DatabaseService } from '@core/data/database.service';
import { formatTime } from '@core/utils/format-time.util';

import {
  IonReorderGroup,
  IonContent,
  ItemReorderEventDetail,
  IonItem,
} from '@ionic/angular/standalone';

import { SongItemComponent } from '../song-item/song-item.component';
import { BtnDownAndHeartComponent } from '../btn-down-and-heart/btn-down-and-heart.component';
import { BtnAddPlaylistComponent } from '../btn-add-playlist/btn-add-playlist.component';
import { PlaylistModalLayoutComponent } from "../playlist-modal-layout/playlist-modal-layout.component";

/**
 * Component Hiển thị Playlist đang phát hiện tại.
 *
 * Chức năng:
 * - Trình bày danh sách bài hát thuộc luồng Queue của Player.
 * - Hỗ trợ kéo thả đổi thứ tự (Reorder) bài hát.
 * - Call các API tĩnh thông qua PlayerStore (Change Track, Remove from Queue, Clear).
 */
@Component({
  selector: 'app-current-playlist',
  templateUrl: './current-playlist.component.html',
  styleUrls: ['./current-playlist.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    BtnDownAndHeartComponent,
    BtnAddPlaylistComponent,
    PlaylistModalLayoutComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentPlaylistComponent implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────
  // Dependencies & Local Subjects
  // ─────────────────────────────────────────────────────────
  private destroy$ = new Subject<void>();
  readonly player = inject(PlayerStore);
  private readonly databaseService = inject(DatabaseService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ─────────────────────────────────────────────────────────
  // Computed Signals from Store
  // ─────────────────────────────────────────────────────────
  currentSong = this.player.currentSong;
  isPlaying = this.player.isPlaying;
  isShuffling = this.player.isShuffling;
  currentIndex = this.player.currentIndex;
  currentTime = this.player.currentTime;
  duration = this.player.duration;
  playbackState = this.player.playbackState;
  
  /** Trích xuất mảng Playlist gốc */
  currentPlaylist = computed(() => this.playbackState().currentPlaylist);

  /** Hàm tiện ích quy đổi Percentage */
  progressPercentage = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  /** Tính toán hiển thị format M:ss của thời lượng đang tiến tới */
  progressTime = computed(() => formatTime(this.currentTime()));

  /** Số mili-giây còn lại đến cuối track */
  remainingTime = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return Math.max(0, total > 0 ? total - current : 0);
  });

  /** Thông số âm đếm ngược */
  durationTime = computed(() => `-${formatTime(this.remainingTime())}`);

  // ─────────────────────────────────────────────────────────
  // Lifecycle & Watchers
  // ─────────────────────────────────────────────────────────
  constructor() {
    // Ép CDR detectChanges vì Signal state render bên component OnPush
    effect(() => {
      this.currentSong();
      this.isPlaying();
      this.isShuffling();
      this.currentIndex();
      this.currentTime();
      this.duration();
      this.playbackState();
      requestAnimationFrame(() => this.cdr.detectChanges());
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('player-action-triggered', this.handlePlayerAction);
    }

    // Effect rình rập nếu DB có sự vụ Xoá thì gạch luôn khỏi Playlist tạm
    effect(() => {
      const deletedId = this.databaseService.deletedSongId();
      if (deletedId) {
        this.removeSongByIdFromCurrentPlaylist(deletedId);
        this.databaseService.deletedSongId.set(null);
      }
    });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (typeof window !== 'undefined') {
      window.removeEventListener('player-action-triggered', this.handlePlayerAction);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Component Logic Tasks
  // ─────────────────────────────────────────────────────────
  /**
   * Cập nhật danh sách phát local khi phát hiện một file vật lý bị gỡ bỏ.
   */
  private removeSongByIdFromCurrentPlaylist(songId: string) {
    const playlist = this.currentPlaylist();
    if (!Array.isArray(playlist)) return;
    const index = playlist.findIndex((s) => s.id === songId);
    if (index !== -1) {
      if (playlist.length <= 1) {
        this.clearPlaylist();
      } else {
        this.player.removeFromQueue(index);
      }
      this.cdr.detectChanges();
    }
  }

  /**
   * Phương thức nhận Window Event Listener
   */
  private handlePlayerAction = () => {
    requestAnimationFrame(() => this.cdr.detectChanges());
  };

  /**
   * ForLoop Optimizer 
   */
  trackBySongId(index: number, song: Song): string {
    return song.id;
  }

  getCurrentSongIndex(): number {
    return this.currentIndex();
  }

  /**
   * Test xem con trỏ dòng UI Index có chĩa đúng vào Item này không.
   */
  isCurrentSong(song: Song): boolean {
    return this.currentSong()?.id === song.id;
  }

  getSongItemClass(song: Song, index: number): string {
    return this.isCurrentSong(song)
      ? 'bg-purple-900/20 border-purple-700'
      : 'border-gray-400';
  }

  // ─────────────────────────────────────────────────────────
  // Player Bound Interfaces
  // ─────────────────────────────────────────────────────────
  
  /**
   * Jump sang bài được chỉ ấn.
   */
  async playSong(song: Song, index: number) {
    try {
      await this.player.playSongAtIndex(song, this.currentPlaylist(), index);
      this.cdr.detectChanges();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Lỗi chạy nhạc playSong:', error);
    }
  }

  /**
   * Đuổi Item này khỏi hàng xếp Queue chờ (không xoá file).
   */
  async removeSong(event: Event, index: number) {
    event.stopPropagation();
    if (this.currentPlaylist().length <= 1) {
      await this.clearPlaylist();
      return;
    }
    try {
      this.player.removeFromQueue(index);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Lỗi loại bỏ bài hát removeSong:', error);
    }
  }

  async toggleShuffle() {
    try {
      this.player.toggleShuffle();
      this.cdr.detectChanges();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Lỗi kẹt Cấu hình Shuffle:', error);
    }
  }

  /**
   * Nút huỷ trắng toàn bộ list đang chơi.
   */
  async clearPlaylist() {
    try {
      this.player.pause();
      await this.player.setPlaylist([], 0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Clear playlist bị ngắt mạch:', error);
    }
  }

  previousTrack() {
    this.player.playPrevious();
    this.cdr.detectChanges();
  }

  togglePlayPause() {
    this.player.togglePlayPause();
    this.cdr.detectChanges();
  }

  nextTrack() {
    this.player.playNext();
    this.cdr.detectChanges();
  }

  async toggleFavorite() {
    await this.player.toggleFavorite();
    this.cdr.detectChanges();
  }

  onImageError(event: any): void {
    event.target.src = './assets/images/background.webp';
  }

  /**
   * Bắt Catcher Kéo thả Element HTML, hoán vị vị trí Item trong Mảng.
   */
  onIonReorder(event: CustomEvent<ItemReorderEventDetail>) {
    const from = event.detail.from;
    const to = event.detail.to;

    if (from !== to) {
      const playlist = [...this.currentPlaylist()];
      const [moved] = playlist.splice(from, 1);
      playlist.splice(to, 0, moved);

      const current = this.currentSong();
      const newCurrentIndex = playlist.findIndex((s) => s.id === current?.id);

      this.player.reorderPlaylist(playlist, newCurrentIndex);
    }

    event.detail.complete(true);
    this.cdr.detectChanges();
  }

  /** Trả về class móng hiển thị đĩa CD bo tròn cho Thumbnail tuỳ Play/Pause */
  getThumbnailClass(song: Song): any {
    const isCurrent = this.isCurrentSong(song);
    return {
      'spin-with-fill': isCurrent,
      'spin-paused': !this.isPlaying() && isCurrent,
      'border-purple-700': isCurrent,
    };
  }
}
