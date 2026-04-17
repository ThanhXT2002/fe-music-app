import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { formatTime } from '@core/utils/format-time.util';

/**
 * Component thanh tiến trình nhạc (Playback Progress Bar) có khả năng tương tác đầy đủ.
 *
 * Chức năng:
 * - Cung cấp thanh slider xả/kéo mượt mà để tua một bản nhạc chuyên dụng.
 * - Tự động hiển thị thời gian hiện tại và thời lượng dạng tiêu chuẩn MM:ss.
 * - Bao gồm các cơ chế bổ sung như Fallback trượt ngoài viền TouchArea tránh lỗi Native Device.
 */
@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  imports: [CommonModule],
  styleUrls: ['./progress-bar.component.scss'],
})
export class ProgressBarComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────────────────
  /** Tỷ lệ phần trăm thời lượng đã phát (Dao động từ 0 - 100) */
  @Input() progress: number = 0;
  
  /** Tỷ lệ tải ngầm dữ liệu cache chuẩn bị stream (buffer). Mặc định là 100% đối với file offline tải trước */
  @Input() buffer: number = 100;
  
  /** Cấp phát một giá trị phần trăm tạm tính từ vị trí con trỏ chuột mô phỏng hành động tua qua */
  @Input() hover: number = -1;
  
  /** Cờ cho Service âm thanh biết người dùng có đang nắm giữ bóng thời gian gây cản trở Sync thời gian không */
  @Input() isDragging: boolean = false;
  
  /** Cờ theo dõi trạng thái Hover chuột để ẩn/hiện Thumb nút điều khiển cho Web Desktop */
  @Input() isHovering: boolean = false;
  
  /** Trị số tổng thời lượng thực tế của bài nhạc đang track (bằng giây) */
  @Input() duration: number = 0;
  
  /** Mốc giây hiện tại đang cất lên */
  @Input() currentTime: number = 0;

  // ─────────────────────────────────────────────────────────
  // Output
  // ─────────────────────────────────────────────────────────
  /** Phát sự kiện báo yêu cầu hệ thống nhảy tiếp/lùi đến mốc thời gian Seconds vừa thu được */
  @Output() seek = new EventEmitter<number>();
  
  /** Tín hiệu bắt đầu khi ngón tay/chuột chạn thao tác kéo thanh Bar */
  @Output() dragStart = new EventEmitter<void>();
  
  /** Tín hiệu kết thúc khi ngón tay lơi/chuột bốc khỏi mặt thanh Bar và lưu Seek final */
  @Output() dragEnd = new EventEmitter<void>();
  
  /** Emit báo hiệu vùng Hover khi chuột trượt qua bar, bắn ra phần trăm ảo tại điểm đó */
  @Output() hoverChange = new EventEmitter<number>();

  /** Khai báo tham chiếu element HTML vật lý dải thanh Progress để đo lường giới hạn Box Coordinate Toạ Độ */
  @ViewChild('progressContainer', { static: false })
  progressContainer?: ElementRef<HTMLElement>;

  // ─────────────────────────────────────────────────────────
  // State 
  // ─────────────────────────────────────────────────────────
  /** Trạng thái lưu lượng phần trăm ảo để render khi đang tương tác vật lý bằng chuột (chưa nhả neo) */
  tempProgress: number = 0;
  
  /** Check xem cờ trạng thái dragging nội suy component đã bắt đầu chưa */
  dragging: boolean = false;
  
  /** Giá trị neo mốc điểm đang Hover chuột để Preview thanh sáng xám */
  hoverPercent: number = -1;

  /** Hàm formatter nhúng ngoại vi truyền xuống template hỗ trợ binding dữ liệu ra string m:ss */
  public formatTime = formatTime;

  ngOnInit() {}

  // ─────────────────────────────────────────────────────────
  // Component Level Actions (Native Event Bound)
  // ─────────────────────────────────────────────────────────
  /**
   * Tính toán tỉ lệ chiều ngang màn hình và thực thi lệnh tua đến (Seek) bài hát khi Click dính.
   */
  onProgressClick(event: MouseEvent) {
    const percent = this.getProgressPercent(event);
    const seekTime = (percent / 100) * this.duration;
    this.seek.emit(seekTime);
  }

  /**
   * Chuẩn bị hành trang theo dõi vòng lập khi người dùng nhấn giữ neo để bắt đầu Drag Bar.
   * NOTE: Bắt buộc gắn listener sang "tầng global Document" để ngăn việc mất Handle chuyển động khi chuột lấn khỏi container bé tí.
   */
  onProgressStart(event: MouseEvent | TouchEvent) {
    if (event.cancelable) {
      event.preventDefault(); // Tránh scroll nhầm nội dung trên thiết bị Mobile Safari khi cố vuốt Progressbar
    }
    this.dragging = true;
    this.tempProgress = this.getProgressPercent(event);
    this.dragStart.emit();
    document.addEventListener('mousemove', this.onGlobalMouseMove, { passive: false });
    document.addEventListener('mouseup', this.onGlobalMouseUp, { passive: true });
    document.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', this.onGlobalTouchEnd, { passive: true });
  }

  /**
   * Quét và update số phần trăm Hover trong lúc đang di chuột hờ hững (không nhấn).
   */
  onProgressMove(event: MouseEvent | TouchEvent) {
    if (!this.dragging) {
      this.hoverPercent = this.getProgressPercent(event);
      this.hoverChange.emit(this.hoverPercent);
    } else {
      this.tempProgress = this.getProgressPercent(event);
    }
  }

  /**
   * Điểm chặn khi thao tác đã hoàn thành bên trong phạm vi Container box nếu may mắn.
   */
  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.dragging) {
      this.finishDrag();
    }
  }

  /**
   * Giải trừ tính toán hover ảo khi chuột thoát ly khỏi Progress container.
   */
  onProgressLeave() {
    if (!this.dragging) {
      this.hoverPercent = -1;
      this.hoverChange.emit(-1);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Global Event Edge Case Listeners
  // ─────────────────────────────────────────────────────────
  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.dragging) {
      event.preventDefault();
      this.tempProgress = this.getProgressPercent(event);
    }
  };

  private onGlobalMouseUp = (event: MouseEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };

  private onGlobalTouchMove = (event: TouchEvent) => {
    if (this.dragging) {
      if (event.cancelable) {
        event.preventDefault();
      }
      this.tempProgress = this.getProgressPercent(event);
    }
  };

  private onGlobalTouchEnd = (event: TouchEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };

  // ─────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────
  /**
   * Trích xuất kết thúc hành trình vuốt/kéo, gỡ bỏ tất cả EventListener rườm rà để chừa Memory Leak RAM.
   * Emit gửi yêu cầu ra cho Audio Context xử lý Seek Thời điểm âm thanh.
   */
  private finishDrag() {
    if (!this.dragging) return;
    const seekTime = (this.tempProgress / 100) * this.duration;
    this.seek.emit(seekTime);
    this.dragging = false;
    this.dragEnd.emit();
    this.cleanupGlobalListeners();
  }

  /**
   * Dọn dẹp DOM Document Listener (Dùng cặp với Register ở hàm onProgressStart).
   */
  private cleanupGlobalListeners() {
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  }

  /**
   * Bào chế công thức tỉ lệ toán phần trăm dựa vào ClientX chuột (hoặc Tọa độ Touch Finger) giao tiếp tương đối với chiều rộng khung thẻ HTML gốc.
   * 
   * @param event - Mouse hay Touch Event chứa hệ số gốc toạ độ từ màn hình thực phần cứng.
   * @returns Tỷ lệ bị khoá an toàn từ `0` tới `100` (%) dù người dùng cớ vuốt lố qua rìa thiết bị.
   */
  private getProgressPercent(event: MouseEvent | TouchEvent): number {
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    let progressElem: HTMLElement | null = null;
    if (this.progressContainer && this.progressContainer.nativeElement) {
      progressElem = this.progressContainer.nativeElement;
    } else {
      progressElem = document.querySelector(
        '[data-progress-container]'
      ) as HTMLElement;
    }
    if (!progressElem) return 0;
    const rect = progressElem.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }
}
