import { CommonModule } from '@angular/common';
import { LoadingService } from '@core/ui/loading.service';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LottieComponent } from "ngx-lottie";

/**
 * Component Đồ hoạ Loading Screen mờ đục toàn màn hình (Overlay Lottie).
 *
 * Chức năng:
 * - Trình chiếu Animation File Lottie JSON mỗi khi ứng dụng có Background Task chạy nặng (Gắn vô Service).
 * - Sử dụng ChangeDetectionStrategy.OnPush để giới hạn hiệu năng không bị vướng Change Detection tốn CPU.
 */
@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  imports: [CommonModule, LottieComponent],
  standalone: true,
})
export class LoadingComponent {
  // ─────────────────────────────────────────────────────────
  // Core Dependencies
  // ─────────────────────────────────────────────────────────
  /** Cấu hình đường dẫn Lottie */
  animationPath = 'assets/animations/ripple-loading-animation.json';

  public loadingService = inject(LoadingService);

  // ─────────────────────────────────────────────────────────
  // Public Getters for Template
  // ─────────────────────────────────────────────────────────
  /** 
   * Thu thập trích xuất state boolean đang bật hay tắt spinner từ singleton Core Service Loading.
   */
  get loading() {
    return this.loadingService.loading();
  }
}
