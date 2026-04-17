import { Component, Output, EventEmitter, Input } from '@angular/core';

/**
 * Component vùng Header phần trên cùng cố định tại màn hình Trình phát nhạc toàn màn hình (Player Fullscreen).
 *
 * Chức năng:
 * - Vùng chứa layout để phân vùng Tiêu đề lớn (Ví dụ như "ĐANG NGHE") chuyên biệt tách ly với các nút tiện ích nổi 2 bên cạnh.
 * - Xuất sự kiện mở Option cho bài hát hoặc yêu cầu Lệnh thu gọn Player xuống đáy dưới.
 */
@Component({
  selector: 'app-player-header',
  templateUrl: './player-header.component.html',
  styleUrls: ['./player-header.component.scss'],
})
export class PlayerHeaderComponent {
  // ─────────────────────────────────────────────────────────
  // Outputs & Inputs Setup
  // ─────────────────────────────────────────────────────────
  /** Tín hiệu yêu cầu thu nhỏ Media View (Hạ màn hình Music Box xuống Navigation Bottom) */
  @Output() back = new EventEmitter<void>();
  
  /** Tín hiệu gọi khởi phát màn hình Sheet Menu Options quản trị thêm bài hát đang trỏ */
  @Output() menu = new EventEmitter<void>();
  
  /** Khung nội dung Tiêu đề in hoa chỉ định góc trên giữa */
  @Input() title: string = 'ĐANG NGHE';
  
  /** Text mô tả bổ sung dạng chú thích cực nhỏ ngay bên dưới chữ tiêu đề */
  @Input() subtitle: string = '_ ___ _';
}
