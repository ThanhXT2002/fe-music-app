import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { InstallService } from '@core/platform/install.service';

/**
 * Component Hiển thị Khung hộp thoại (Prompt) mời gọi Cài đặt App.
 *
 * Chức năng:
 * - Trình chiều bố cục Kính Mờ (Liquid Glass) bắt mắt.
 * - Liên kết logic tới Service Check độ tương thích Native hay PWA của người dùng.
 * - Call InstallService Native Prompt API nếu điều kiện trình duyệt cho phép.
 */
@Component({
  selector: 'app-install-prompt',
  template: `
    <div class="liquid-glass-panel mb-4" *ngIf="shouldShowInstallPrompt()">
      <div class="liquid-glass-bg">
        <div class="liquid-glass-blur"></div>
        <div class="liquid-glass-highlight"></div>
      </div>
      <div class="liquid-glass-header">
        <h2 class="liquid-glass-title">Appearance</h2>
      </div>

      <div class="liquid-glass-content">
        <div class="liquid-glass-row-between ">
        <div>
          <h3 class="liquid-glass-subtitle">Cài đặt</h3>
          <p class="liquid-glass-description-strong">
            Cài đặt app để có trải nghiệm tốt nhất với XTMusic.
          </p>
        </div>
        <button
          class="text-white p-3 bg-purple-600 rounded-full hover:bg-indigo-400 flex justify-center items-center"
          (click)="installApp()"
        >
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
      </div>
    </div>
  `,
  imports: [CommonModule, IonicModule],
  standalone: true,
})
export class InstallPromptComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Dependencies & Local Properties
  // ─────────────────────────────────────────────────────────
  private platform = inject(Platform);
  public installService = inject(InstallService);
  
  /** Trạng thái nội bộ ẩn hiện của popup Banner cài đặt */
  private showPrompt = false;

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────
  ngOnInit() {
    this.checkInstallAvailability();
  }

  // ─────────────────────────────────────────────────────────
  // Core Logics
  // ─────────────────────────────────────────────────────────
  /**
   * Chạy Interval (vòng lặp) nửa giây một lần để chờ Browser trả kết quả Installable từ manifest PWA.
   * Dừng kiểm tra sau 30s nếu timeout không thấy Manifest hợp lệ.
   */
  private checkInstallAvailability() {
    const checkInterval = setInterval(() => {
      if (
        this.installService.canInstall() &&
        !this.installService.isRunningStandalone()
      ) {
        this.showPrompt = true;
        clearInterval(checkInterval);
      }
    }, 500);

    // Bắt đầu Hẹn giờ hủy vòng lặp phòng ngừa Memory Leak
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 30000);
  }

  /**
   * Trả về kết luận Boolean có nên hiện diện Box Install lên DOM UI HTML không.
   */
  shouldShowInstallPrompt(): boolean {
    // Chỉ hiển thị khi service xác nhận thiết bị hỗ trợ và chưa Cài
    return (
      this.showPrompt &&
      this.installService.canInstall() &&
      !this.installService.isRunningStandalone()
    );
  }

  /**
   * Gọi Service móc xuống nhân hệ điều hành Device cài cắm PWA App xuống màn hình chính (Homescreen).
   */
  async installApp() {
    const result = await this.installService.install();
    if (result === 'accepted') {
      this.showPrompt = false; // Tắt luôn panel khi đã bấm 
    } else if (result === 'dismissed') {
      // Giữ nguyên button khi user Cảnh giác huỷ ngang
    } else {
      this.showManualInstallInstructions();
    }
  }

  /**
   * Handler đóng thủ công tuỳ chọn PWA.
   */
  dismissPrompt() {
    this.showPrompt = false;
  }

  /**
   * Tooltip chỉ đường thay thế nếu API Install của iOS (Webkit) chập cheng từ chối tự động.
   */
  private showManualInstallInstructions() {
    let message = 'Để cài đặt ứng dụng XTMusic lên máy:\n';

    if (this.platform.is('ios')) {
      message +=
        '1. Nhấn vào nút Mũi Tên Trỏ Lên Share (chia sẻ) ở đáy Safari\n2. Chọn dòng "Add to Home Screen"';
    } else if (this.platform.is('android')) {
      message +=
        '1. Nhấn vào góc phải mũi tên menu trình duyệt chrome (3 chấm)\n2. Chọn "Thêm vào màn hình" hoặc "Install app"';
    } else {
      message +=
        '1. Nhấn vào menu dọc cuối thanh URL trình duyệt\n2. Chọn "Install" hoặc "Add to Home screen"';
    }

    alert(message);
  }
}
