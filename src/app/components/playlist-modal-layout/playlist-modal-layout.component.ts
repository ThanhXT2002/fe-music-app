import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonReorderGroup } from "@ionic/angular/standalone";
import { IonicModule } from "@ionic/angular";
import { SongItemComponent } from "../song-item/song-item.component";
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';

/**
 * Component Layout chứa danh sách phát cho Modal.
 *
 * Chức năng:
 * - Render giao diện layout chung dùng cho các dạng danh sách phát Popup (ví dụ Modal Current Playlist).
 * - Cung cấp cơ chế Input Data thông số Player để tương thích với SongItem.
 * - Phát Output các thao tác Player (Next, Prev, Shuffle).
 */
@Component({
  selector: 'app-playlist-modal-layout',
  templateUrl: './playlist-modal-layout.component.html',
  styleUrls: ['./playlist-modal-layout.component.scss'],
  imports: [IonicModule, CommonModule, SongItemComponent],
})
export class PlaylistModalLayoutComponent {
  // ─────────────────────────────────────────────────────────
  // Input Data Params
  // ─────────────────────────────────────────────────────────
  /** Mảng Playlist nguồn truyền vào cần render */
  @Input() playlist: any[] = [];
  
  /** Thông tin bản track đang chạy hiện tại mốc */
  @Input() currentSong: any;
  
  /** Số vạch Index chỉ điểm tiến trình đang chơi đến đâu */
  @Input() currentIndex: number = 0;
  
  /** Trạng thái boolean máy nghe nhạc đang hát */
  @Input() isPlaying: boolean = false;
  
  /** Trạng thái boolean xào bài ngẫu nhiên (Shuffle) */
  @Input() isShuffling: boolean = false;
  
  /** Vạch phần trăm thời gian phát */
  @Input() progressPercentage: number = 0;
  
  /** Chuỗi thời gian đã định dạng chuẩn mm:ss */
  @Input() durationTime: string = '0:00';
  
  /** Hình thumbnail đại diện Layout header */
  @Input() songThumbnail: string = '';
  
  /** Tựa đề track hiển thị cho Layout */
  @Input() songTitle: string = '';
  
  /** Thông số Ca sĩ hiển thị cho Layout  */
  @Input() songArtist: string = '';
  
  /** Ngữ cảnh callback tham chiếu Index ForLoop UI */
  @Input() trackBySongId: any;

  // ─────────────────────────────────────────────────────────
  // Emit Action Events
  // ─────────────────────────────────────────────────────────
  @Output() playSong = new EventEmitter<{ song: any, index: number }>();
  @Output() previousTrack = new EventEmitter<void>();
  @Output() nextTrack = new EventEmitter<void>();
  @Output() togglePlayPause = new EventEmitter<void>();
  @Output() toggleShuffle = new EventEmitter<void>();
  @Output() onIonReorder = new EventEmitter<any>();

  /** Check nhận diện Ionic Native Mode */
  isNative = Capacitor.isNativePlatform();
}
