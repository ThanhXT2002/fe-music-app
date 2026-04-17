import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Album } from '@core/interfaces/song.interface';
import { formatDuration } from '@core/utils/format-time.util';

/**
 * Interface cấu trúc thông tin tham chiếu dùng cho hiển thị MediaCard (Album, Playlist, Truyền thông).
 */
export interface MediaItem {
  /** ID duy nhất định danh của tác phẩm */
  id?: string;
  /** Tiêu đề chính hiển thị cho khối Media (Tên tác giả, Tên list, vv...) */
  name: string;
  /** Tên ca sĩ hoặc nhóm xuất bản nhạc (Nếu có) */
  artist?: string;
  /** Hình ảnh Thumbnail ngắn gọn hiển thị bìa của Album */
  thumbnail?: string;
  /** Variant URL cung cấp ảnh khác phụ thuộc DB trả về cũ */
  thumbnail_url?: string;
  /** Sĩ số bài hát bên trong thư mục */
  songCount?: number;
  /** Tổng diện mạo thời gian dạng text ví dụ "14:02" */
  totalDurationFormatted?: string;
  /** Danh sách dữ liệu song đính kèm item */
  songs?: any[];
  /** Tổng thời lượng bằng số nguyên (giây) phục vụ tính toán */
  totalDuration?: number;
  /** Đánh dấu trạng thái riêng người dùng Custom */
  isUserCreated?: boolean;
  /** Cung cấp chuỗi mô tả thêm nếu tồn tại */
  description?: string;
}

/**
 * Component Hiển thị dạng Card vuông dùng phổ biến để biểu diễn các Playlist, Album hoặc Nghệ sĩ.
 * 
 * Chức năng:
 * - Có thể dùng chung (reusable component) tái sử dụng cho nhiều khu vực list trên ứng dụng.
 * - Có cơ chế Fallback thiết lập ảnh mặc định khi bị vỡ kết nối truy cập ảnh.
 */
@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-card.component.html',
  styleUrls: ['./media-card.component.scss']
})
export class MediaCardComponent {
  // ─────────────────────────────────────────────────────────
  // Input & Output Parameters
  // ─────────────────────────────────────────────────────────
  /** Dữ liệu truyền vào (Bắt buộc) quy chuẩn theo dạng Album hoặc custom MediaItem */
  @Input() item!: MediaItem | Album;
  
  /** Làm sáng thẻ hoặc bật layout viền khác thường nếu Card đang ở trạng thái kích hoạt (Active) */
  @Input() isActive: boolean = false;
  
  /** Cấu trúc layout hiển thị tùy loại Media: 'artist' thì bo tròn tròn (Circular), 'album' thì vuông */
  @Input() type: 'artist' | 'album' = 'artist';
  
  /** Cho phép xuất hiện nút menu chức năng phụ mở rộng ngay bên góc phải của thẻ */
  @Input() showMenu: boolean = false;

  /** Sự kiện Trigger thông báo ra lớp vỏ Component Cha hành động Click thẻ */
  @Output() itemClick = new EventEmitter<MediaItem | Album>();
  
  /** Sự kiện Bắn kèm object nếu người dùng nhắm trúng chỉ nút Menu Icon */
  @Output() menuClick = new EventEmitter<{item: MediaItem | Album, event: Event}>();

  // ─────────────────────────────────────────────────────────
  // Event Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Thực thi đẩy thông báo ra ngoài khi người dùng click vào thẻ này.
   */
  onItemClick() {
    this.itemClick.emit(this.item);
  }

  /**
   * Chặn Event Bubbling khi click vào Menu Options và thông báo cho Parent component.
   * Ngăn tình trạng vừa bấm Option vừa lỡ tay chuyển trang.
   */
  onMenuClick(event: Event) {
    event.stopPropagation();
    this.menuClick.emit({ item: this.item, event });
  }

  /**
   * Cài đặt cơ cấu Fallback nếu Ảnh truyền vào bằng cách nào đó không load được URL.
   */
  onImageError(event: any) {
    event.target.src = 'assets/images/background.webp';
  }

  // ─────────────────────────────────────────────────────────
  // Computed Properties (Getters)
  // ─────────────────────────────────────────────────────────
  /**
   * Trích xuất liên kết Ảnh Thumbnail.
   * Giúp tự động tương thích ngược giữa các field trả về khác nhau (`thumbnail` hoặc `thumbnail_url`).
   */
  getImageSrc(): string {
    return this.item.thumbnail || (this.item as any).thumbnail_url || 'assets/images/background.webp';
  }

  /**
   * Rút trích tự động tên định danh đối tượng MediaCard đang sở hữu.
   */
  get displayName(): string {
    return this.item.name;
  }

  /**
   * Định hình dòng thông tin hỗ trợ ngắn thứ hai đối với thẻ có nhiều số liệu con (Số lượng bài, Tổng giờ).
   */
  get displayInfo(): string {
    if (this.type === 'album') {
      const songCount = this.item.songs?.length || (this.item as any).songCount || 0;
      const duration = (this.item as any).totalDurationFormatted || formatDuration(this.item.totalDuration || 0);
      return `${songCount} bài • ${duration}`;
    } else {
      const songCount = (this.item as any).songCount || 0;
      const duration = (this.item as any).totalDurationFormatted || '';
      return `${songCount} bài - ${duration}`;
    }
  }
}
