import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';

/**
 * Component Button linh hoạt thiết kế theo chuẩn chung (Design System).
 *
 * Chức năng:
 * - Kế thừa nút chuẩn Ionic thay vi phải khai báo lặp lại các thuộc tính HTML ở nhiều component chức năng khác.
 * - Cho phép cấu hình kích thước, border, màu nền một cách gọn nhẹ thông qua cơ chế Input.
 */
@Component({
  selector: 'app-btn-custom',
  imports: [CommonModule, IonicModule],
  templateUrl: './btn-custom.component.html',
  styleUrls: ['./btn-custom.component.scss'],
})
export class BtnCustomComponent {
  // ─────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────
  /** Ký danh tên Icon Ionic mong muốn xuất phát (Ví dụ: heart-outline) */
  @Input() icon!: string;
  
  /** Danh sách chuỗi Class ngoại vi tuỳ chọn kèm theo nếu muốn Override thẻ ngoài */
  @Input() cssClass: string = '';
  
  /** Cấu hình cao mặc định của box tương tác */
  @Input() height: string = '40px';
  
  /** Cấu hình chiều rộng ngang mặc định của box */
  @Input() width: string = '40px';
  
  /** Tên định dạng màu nền Ionic chính thức (primary, light, danger...) */
  @Input() color: string = '';
  
  /** Bổ sung lớp phủ Border viền ngoài cho Button nếu cần thiết theo phong cách Outline */
  @Input() borderClass: string = '';
  
  /** Thiết định độ cong góc (mặc định bo tròn hoàn toàn `rounded-full`) */
  @Input() rounded: string = 'rounded-full';
  
  /** Chặn/Mở trạng thái cho phép người dùng bấm Click hay không */
  @Input() disabled: boolean = false;
  
  /** Văn bản (Label) in lên mặt nút thay vì Icon duy nhất */
  @Input() text: string = '';

  // ─────────────────────────────────────────────────────────
  // Outputs & Events
  // ─────────────────────────────────────────────────────────
  /** Bắn sự kiện trần (Void) báo hiệu lớp cha là tương tác vật lý chuột Click / ngón Touch đã xảy ra */
  @Output() btnClick = new EventEmitter<void>();

  /**
   * Phát đi luồng khi tiếp nhận Native Event của button html.
   */
  onClick() {
    this.btnClick.emit();
  }
}
