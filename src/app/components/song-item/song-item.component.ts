import { UiStateService } from '@core/ui/ui-state.service';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Song } from '@core/interfaces/song.interface';
import { IonIcon, IonReorder, IonCheckbox } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { apps, reorderThreeOutline } from 'ionicons/icons';
import { AudioPlayerService } from '@core/services/audio-player.service';
import { LottieEqualizerComponent } from '../lottie-equalizer/lottie-equalizer.component';
import { SongItemActionsComponent } from "../song-item-actions/song-item-actions.component";

/**
 * Component Hiển thị bản nháp thẻ Bài Hát riêng lẻ tái sử dụng được ở nhiều Ngữ cảnh trang.
 *
 * Chức năng:
 * - Trình chiều bố cục Layout con, hiển thị Image, Title, Subtitle.
 * - Hỗ trợ các Mode Page: list-page, up/down-page, edit-playlist tuỳ chỉnh giao diện linh hoạt.
 */
@Component({
  selector: 'app-song-item',
  templateUrl: './song-item.component.html',
  styleUrls: ['./song-item.component.scss'],
  imports: [IonCheckbox, IonReorder, CommonModule, IonIcon, LottieEqualizerComponent, SongItemActionsComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongItemComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────
  /** String quyết định logic loại hình hiển thị nội dung đi kèm tương ứng Page */
  @Input() modePage: 'list-page' | 'current-play' | 'down-page' | 'edit-playlist' | 'favorite' = 'list-page';
  
  /** Khung Model đối tượng lưu trữ Bài Hát  */
  @Input() song!: any;
  
  /** Khung viền tắt/mở tuỳ mục đích List view  */
  @Input() showAlbum: boolean = true;
  @Input() showArtist: boolean = true;
  
  /** Trọn gói cha để truyền Event ngược cho Context  */
  @Input() playlist: Song[] = [];
  @Input() index: number = 0;
  @Input() showRemoveButton: boolean = false; 
  @Input() checked: boolean = false;
  @Input() currentSongId: string = '';

  // Properties phụ trách giao diện Download:
  @Input() isDownloaded: boolean = false;
  @Input() isDownloading: boolean = false;
  @Input() downloadProgress: number = 0;
  @Input() isPolling: boolean = false; 
  @Input() pollProgress: number = 0; 
  @Input() isReady: boolean = false; 

  // ─────────────────────────────────────────────────────────
  // Outputs
  // ─────────────────────────────────────────────────────────
  @Output() play = new EventEmitter<{
    song: Song;
    playlist: Song[];
    index: number;
  }>();
  @Output() showMenu = new EventEmitter<Song>();
  @Output() toggleFavorite = new EventEmitter<Song>();
  @Output() openPlayer = new EventEmitter<void>();
  @Output() removeSong = new EventEmitter<Song>();
  @Output() download = new EventEmitter<any>();
  @Output() pauseDownload = new EventEmitter<any>();
  @Output() resumeDownload = new EventEmitter<any>();
  @Output() cancelDownload = new EventEmitter<any>();
  @Output() checkedChange = new EventEmitter<boolean>();

  // ─────────────────────────────────────────────────────────
  // State variables
  // ─────────────────────────────────────────────────────────
  currentSong: Song | null = null;
  isPlaying = false;
  isShowBoxFunction: boolean = false;
  pageName: string | null = null;

  // ─────────────────────────────────────────────────────────
  // Mode Page Getters
  // ─────────────────────────────────────────────────────────
  get isCurrentPlayPage(): boolean { return this.modePage === 'current-play'; }
  get isDownPage(): boolean { return this.modePage === 'down-page'; }
  get isListPage(): boolean { return this.modePage === 'list-page'; }
  get isEditPlaylistPage(): boolean { return this.modePage === 'edit-playlist'; }
  get isFavoriteTab(): boolean { return this.modePage === 'favorite'; }

  constructor(
    private audioPlayerService: AudioPlayerService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private pageContext: UiStateService
  ) {
    addIcons({ apps, reorderThreeOutline });
    this.pageName = this.pageContext.getCurrentPage()();

    // Lắng nghe thụ động từ hệ thống lõi Service
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.currentSong = state.currentSong;
      this.isPlaying = state.isPlaying;
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;
  }

  // ─────────────────────────────────────────────────────────
  // Current Match Checks
  // ─────────────────────────────────────────────────────────
  /**
   * Tính kết quả boolean xem Node có phải Node Đang Play theo hệ chiếu khác nhau.
   */
  get isCurrentSong(): boolean {
    if(this.pageName === 'yt-player') {
      return this.currentSongId === this.song.id;
    }
    return this.currentSong?.id === this.song.id;
  }

  get isThisSongPlaying(): boolean {
    return this.isCurrentSong && this.audioPlayerService.isPlaying();
  }

  // ─────────────────────────────────────────────────────────
  // View Triggers
  // ─────────────────────────────────────────────────────────
  onPlay() {
    this.isCurrentSong ? this.handleCurrentSong() : this.playNewSong();
  }

  private handleCurrentSong() {
    if (this.isListPage) {
      this.router.navigate(['/player']);
    }
    this.openPlayer.emit();
  }

  private playNewSong() {
    this.play.emit({
      song: this.song,
      playlist: this.playlist,
      index: this.index,
    });
  }

  onShowMenu(event: Event) {
    event.stopPropagation();
    this.showMenu.emit(this.song);
  }

  onToggleFavorite(event: Event) {
    event.stopPropagation();
    this.toggleFavorite.emit(this.song);

    // Patch Fix: Lật ngược cờ Favorite của riêng AudioPlayerService nếu đang là bài Current.
    if (this.isCurrentSong) {
      this.audioPlayerService.updateCurrentSong({
        ...this.song,
        isFavorite: !this.song.isFavorite
      });
    }
  }

  onRemoveSong(event: Event) {
    event.stopPropagation();
    this.removeSong.emit(this.song);
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

  onSongCheckboxChange(event: any) {
    this.checkedChange.emit(event.detail.checked);
  }

  toogleShowBoxFunction(songId: string) {
    if(songId === this.song.id) {
      this.isShowBoxFunction = !this.isShowBoxFunction;
    }
  }
}
