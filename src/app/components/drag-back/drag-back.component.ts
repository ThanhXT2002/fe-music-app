import { Location, NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Component nút bấm thu gọn, hỗ trợ thao tác quay dòng về Router History trước (Back Arrow).
 *
 * Chức năng:
 * - Triệu gọi Service Location ẩn của hệ thống để điều khiển Stack Browser Native quay lại đúng ngữ cảnh cha kề cận.
 * - Tránh việc bắt buộc người thiết kế phải cài đặt Hard Coded Link route riêng cho từng Page.
 */
@Component({
  selector: 'app-drag-back',
  templateUrl: './drag-back.component.html',
  styleUrls: ['./drag-back.component.scss'],
  imports: [NgClass]
})
export class DragBackComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Dependencies & Local Properties
  // ─────────────────────────────────────────────────────────
  private location = inject(Location);
  
  /** Kiểm chứng môi trường App đang chạy dưới vỏ bọc App điện thoại thông minh để tuỳ biến Animation đặc thù (nếu có) */
  isNative = Capacitor.isNativePlatform();

  constructor() {}

  ngOnInit() {}

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Bắn lệnh kích hoạt tác vụ tương tự việc click `Back button` vật lý hoặc `Window.history.back()`.
   */
  handleBack() {
    this.location.back();
  }
}
