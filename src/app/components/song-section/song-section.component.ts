import { Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Platform } from '@ionic/angular/standalone';
import { PlaybackState, Song } from '@core/interfaces/song.interface';
import { SongItemHomeComponent } from '../song-item-home/song-item-home.component';
import { SkeletonSongItemComponent } from "../skeleton-song-item/skeleton-song-item.component";

/**
 * Component Hiển thị Khối Chuyên đề danh sách bài hát (Ví dụ: "Nhạc Mới", "Thịnh Hành").
 *
 * Chức năng:
 * - Trình bày thanh trượt ngang (Swiper Slide/CSS Scroll) nhồi một mảng Array Song vào.
 * - Điều chuyển logic Click sang Store Player kèm theo danh sách phát Section để xếp Queue.
 * - Triển khai Load đồ hoạ Skeleton Loading khi call API mảng bị trễ.
 */
@Component({
  selector: 'app-song-section',
  standalone: true,
  imports: [CommonModule, SongItemHomeComponent, SkeletonSongItemComponent],
  templateUrl: './song-section.component.html',
  styleUrls: ['./song-section.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SongSectionComponent {
  // ─────────────────────────────────────────────────────────
  // Dependencies & Local Properties
  // ─────────────────────────────────────────────────────────
  private platform = inject(Platform);

  // ─────────────────────────────────────────────────────────
  // Inputs Data Model
  // ─────────────────────────────────────────────────────────
  /** Tiêu đề chữ in hoa to nhất ở Section Header (VD: GỢI Ý CHO BẠN) */
  @Input() title?: string;
  
  /** Chuỗi mảng bài hát nạp vào băng chuyền Carousel slide */
  @Input() songs: Song[] = [];
  
  /** Cờ khẳng định tiến trình kéo API mảng này vẫn đang xoay */
  @Input() loading: boolean = false;
  
  /** Dòng chữ thông báo tuỳ chỉnh chèn ở Loading Screen Area */
  @Input() loadingText: string = 'Đang tải...';
  
  /** Thông số Data chạy nền của AudioPlayer chuyển vào các Component cháu */
  @Input() playerState!: PlaybackState;

  // ─────────────────────────────────────────────────────────
  // Outputs Signals
  // ─────────────────────────────────────────────────────────
  /** Push dữ liệu ra hàm Router Home thực hiện Request phát bài Playlist mớ này */
  @Output() songClick = new EventEmitter<{ song: Song, playlist: Song[] }>();
  
  /** Cổ điển chỉ nhắm hát mỗi 1 bài này duy nhất */
  @Output() songPlay = new EventEmitter<Song>();
  
  /** Nhấn nút ba chấm options mở Panel Bottom/Action Sheet */
  @Output() songOptions = new EventEmitter<Song>();

  // ─────────────────────────────────────────────────────────
  // Array Manipulators
  // ─────────────────────────────────────────────────────────
  /**
   * Băm nhỏ mảng tổng ra từng cụm con. Phục vụ layout nhóm (grouping).
   * Ví dụ: Slide hiển thị Grid 2x2 = 4 phần tử trên 1 Viewport Slide swiper.
   */
  getGroupedSongs(songs: Song[]): Song[][] {
    if (!songs || songs.length === 0) {
      return [];
    }

    const groupedSongs: Song[][] = [];
    for (let i = 0; i < songs.length; i += 4) {
      groupedSongs.push(songs.slice(i, i + 4));
    }
    return groupedSongs;
  }

  /**
   * Tính toán đổ bóng Skeleton Element theo chuẩn màn hình đang chạy.
   * Mobile/tablet (hẹp): Render 8 cái chia cục 4. PC Desktop: 25 cái dàn dài trượt ngang.
   */
  getSkeletonItems(): number[][] {
    const isMobile = this.platform.is('mobile') || this.platform.is('tablet') || window.innerWidth < 768;
    const totalItems = isMobile ? 8 : 25;
    const itemsPerSlide = 4;

    const skeletonGroups: number[][] = [];
    for (let i = 0; i < totalItems; i += itemsPerSlide) {
      const remainingItems = Math.min(itemsPerSlide, totalItems - i);
      skeletonGroups.push(Array(remainingItems).fill(0).map((_, index) => i + index));
    }
    return skeletonGroups;
  }

  // ─────────────────────────────────────────────────────────
  // Handlers Dom Listeners
  // ─────────────────────────────────────────────────────────
  /**
   * Khi ấn vào một khung hình bài. Đóng gói cùng cha của nó thành Queue Playlist đi theo nó luôn.
   */
  onSongClick(song: Song) {
    this.songClick.emit({ song, playlist: this.songs });
  }

  onSongOptions(song: Song) {
    this.songOptions.emit(song);
  }
}
