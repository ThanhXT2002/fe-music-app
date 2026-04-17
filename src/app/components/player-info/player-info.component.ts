import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Component hiển thị thông tin metadata cơ sở của âm nhạc đang trình chiếu trên màn Player Box.
 *
 * Chức năng:
 * - Dựng khối Thumbnail khổ bao quát to kèm với Tên Ca sĩ/Bài hát.
 * - Triển khai luồng ngầm xoáy góc đồ hoạ Album Art nếu nhận Input `isPlaying` báo là đang Play.
 */
@Component({
  selector: 'app-player-info',
  templateUrl: './player-info.component.html',
  styleUrls: ['./player-info.component.scss'],
  imports: [CommonModule],
})
export class PlayerInfoComponent {
  // ─────────────────────────────────────────────────────────
  // Display Input State
  // ─────────────────────────────────────────────────────────
  /** String URL chứa đựng đường dẫn Ảnh bìa album (tỉ lệ khuyên dùng vuông 1:1) */
  @Input() thumbnail?: string | null;
  
  /** Thông số tiêu đề văn bản Tên bài */
  @Input() title?: string | null;
  
  /** Tên định danh Ca sĩ hoặc nguồn phối nhạc */
  @Input() artist?: string | null;
  
  /** Bật cờ kiểm duyệt chạy Animation dải sóng/đĩa than tự động (nếu có nhúng ở UI) */
  @Input() isPlaying: boolean = false;

  // ─────────────────────────────────────────────────────────
  // Interface Handles
  // ─────────────────────────────────────────────────────────
  /**
   * Chụp lại sự cố sập link hoặc chặn truy cập của URL `thumbnail` từ máy chủ ngoài.
   */
  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }
}
