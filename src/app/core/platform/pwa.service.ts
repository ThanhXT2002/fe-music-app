import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastService } from '@core/ui/toast.service';
import { Platform } from '@ionic/angular';
import { filter } from 'rxjs/operators';

/**
 * PWAService — Điều khiển bộ Service Worker Engine chìm tải cache dưới nền.
 * Kiểm soát quy trình phát hiện bản đồ Release mới và Prompt yêu cầu F5 nạp Reload Web Source.
 * Bổ trợ chốt thông báo chặn bắt luồng trạng thái Kết Nối/Ngắt Mạng (Online/Offline State).
 */
@Injectable({
  providedIn: 'root'
})
export class PWAService {

  // ─────────────────────────────────────────────────────────
  // DEPENDENCIES
  // ─────────────────────────────────────────────────────────

  private swUpdate = inject(SwUpdate);
  private toastService = inject(ToastService);
  private platform = inject(Platform);

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor() {
    // Chỉ kích hoạt ngầm Service Worker kiểm tra phiên bản nếu đang ở môi trường Web PWA
    if (this.swUpdate.isEnabled && this.platform.is('pwa')) {
      this.checkForUpdates();
      this.promptUser();
    }
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /** Móc ping Server ngầm bắt tín hiệu manifest.json có thay đổi hash phiên bản mới không */
  checkForUpdates() {
    this.swUpdate.checkForUpdate().then().catch(err => {
      console.error('Crash gãy luồng rà soát SW Update:', err);
    });
  }

  /**
   * Cắm luồng chốt đợi tín hiệu VERSION_READY từ ServiceWorker và ép làm mới trình duyệt.
   */
  promptUser() {
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        // Tự động rớt thẳng vào Reload App Cache ngay khi nhận gói hàng Bundle
        this.updateApp();
      });
  }

  /**
   * Thi hành thủ thuật hiển thị Toast chặn báo nghỉ nửa chừng rồi cưỡng ép reload Refresh Location.
   */
  updateApp() {
    this.toastService.success('Ứng dụng đã kéo Source Data mới thành công. Đang tải lại thiết lập...', 2500);
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  }

  /**
   * Mốc cờ trả về True nếu kết nối mạng lưới Internet Data Node còn chạy tốt mượt mà.
   * Lấy giá trị trực tiếp từ object ảo Navigator tĩnh cắm rễ vào RAM máy.
   */
  get isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Đan rễ chốt lặp để chặn bắt chuỗi Event DOM Window liên tưởng tới việc rớt/có mạng Wifi/4G đột ngột.
   */
  onNetworkStatusChange() {
    window.addEventListener('online', () => {
      this.showNetworkStatus('Đã kết nối luồng Data mạng', 'success');
    });

    window.addEventListener('offline', () => {
      this.showNetworkStatus('Đứt cáp kết nối Internet. Ứng dụng lùi về Offline Mode tĩnh.', 'warning');
    });
  }

  /** Mapper phân loại màu sắc Toast mạng linh động tuỳ biến */
  private showNetworkStatus(message: string, color: string) {
    if (color === 'success') {
      this.toastService.success(message, 3000);
    } else if (color === 'warning') {
      this.toastService.warning(message, 3000);
    } else {
      this.toastService.info(message, 3000);
    }
  }
}
