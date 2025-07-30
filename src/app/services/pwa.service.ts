import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Platform } from '@ionic/angular';
import { ToastService } from './toast.service';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PWAService {

  constructor(
    private swUpdate: SwUpdate,
    private toastService: ToastService,
    private platform: Platform
  ) {
    if (swUpdate.isEnabled && this.platform.is('pwa')) {
      this.checkForUpdates();
      this.promptUser();
    }
  }

  checkForUpdates() {
    this.swUpdate.checkForUpdate().then().catch(err => {
      console.error('Error checking for updates:', err);
    });
  }

  promptUser() {
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        // Auto reload app
        this.updateApp();
      });
  }

  updateApp() {
    // Hiển thị toast trước khi reload
    this.toastService.success('Ứng dụng đã được cập nhật thành công!', 2500);
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  }

  // Kiểm tra trạng thái offline/online
  get isOnline(): boolean {
    return navigator.onLine;
  }

  // Lắng nghe sự kiện online/offline
  onNetworkStatusChange() {
    window.addEventListener('online', () => {
      this.showNetworkStatus('Đã kết nối internet', 'success');
    });

    window.addEventListener('offline', () => {
      this.showNetworkStatus('Không có kết nối internet. Ứng dụng vẫn hoạt động offline.', 'warning');
    });
  }

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
