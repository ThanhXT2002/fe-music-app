import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaybackState, Song } from '@core/interfaces/song.interface';
import { LottieEqualizerComponent } from '../lottie-equalizer/lottie-equalizer.component';
import { SongItemActionsComponent } from '../song-item-actions/song-item-actions.component';

/**
 * Component Hiển thị Item Bài hát dạng ngang dùng riêng rẽ cho màn hình Home (Trang chủ).
 *
 * Chức năng:
 * - Trình bày lưới Grid hiển thị Image vuông to hơn so với dạng List truyền thống.
 * - Trực tiếp nạp Output khi bấm phát bài hát và tuỳ chọn Option 3 chấm thả menu xuống.
 */
@Component({
  selector: 'app-song-item-home',
  standalone: true,
  imports: [CommonModule, LottieEqualizerComponent, SongItemActionsComponent],
  templateUrl: './song-item-home.component.html',
  styleUrls: ['./song-item-home.component.scss'],
})
export class SongItemHomeComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Component Inputs
  // ─────────────────────────────────────────────────────────
  /** Data model lõi mang thông tin thẻ Bài Hát */
  @Input() song!: Song;
  
  /** Cờ ẩn/hiện chữ thời lượng bài hát (vd: 3:45) */
  @Input() showDuration: boolean = true;
  
  /** Cờ ẩn/hiện dòng tên Tác giả */
  @Input() showArtist: boolean = true;
  
  /** Khẳng định ngữ cảnh render ở trang chủ để tránh bug UI phát sinh do nhầm layout */
  @Input() isHomePage: boolean = true;

  // -- Input đặc biệt dùng kèm ngữ cảnh (Yêu cầu isHomePage = true)
  @Input() currentSong: Song | null = null;
  @Input() playerState!: PlaybackState;
  
  /** Băng tải chứa các bài hát gom nhóm quanh mục Section này để nạp vào Queue khi nhấn Play */
  @Input() sectionPlaylist: Song[] = [];

  // ─────────────────────────────────────────────────────────
  // Component Outputs
  // ─────────────────────────────────────────────────────────
  /** Bắn Output ra component mẹ khi click chính diện Thumbnail để chạy Player */
  @Output() songClick = new EventEmitter<Song>();
  
  /** Bắn Output để mở Action Sheet phụ */
  @Output() songOptions = new EventEmitter<Song>();

  // ─────────────────────────────────────────────────────────
  // UI State
  // ─────────────────────────────────────────────────────────
  /** Cờ quản lý việc kéo mở vùng Function Toolbar giấu bên trong */
  isShowBoxFunction = false;

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────
  ngOnInit() {
    // Reset rỗng các biến tham số nâng cao nếu layout ngoài luồng Home
    if (!this.isHomePage) {
      this.currentSong = null;
      this.playerState = undefined as any;
      this.sectionPlaylist = [];
    }
  }

  // ─────────────────────────────────────────────────────────
  // Dom Event Listeners
  // ─────────────────────────────────────────────────────────
  /**
   * Phát đi luồng khi tiếp nhận Click Area ngoài cùng của Item HTML.
   */
  onSongClick() {
    this.songClick.emit(this.song);
  }

  /**
   * Ngược cờ đóng/mở Box chức năng (Thêm Playlist / Xoá).
   */
  toogleShowBoxFunction() {
    this.isShowBoxFunction = !this.isShowBoxFunction;
  }
}
