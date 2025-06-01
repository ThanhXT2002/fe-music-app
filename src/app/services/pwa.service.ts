import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PWAService {

  constructor(
    private swUpdate: SwUpdate,
    private toastController: ToastController
  ) {
    if (swUpdate.isEnabled) {
      this.checkForUpdates();
      this.promptUser();
    }
  }

  checkForUpdates() {
    this.swUpdate.checkForUpdate().then(() => {
      console.log('Checking for updates...');
    }).catch(err => {
      console.error('Error checking for updates:', err);
    });
  }

  promptUser() {
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(async (evt) => {
        const toast = await this.toastController.create({
          message: 'Có phiên bản mới của ứng dụng. Bạn có muốn cập nhật?',
          position: 'bottom',
          buttons: [
            {
              text: 'Cập nhật',
              handler: () => {
                this.updateApp();
              }
            },
            {
              text: 'Để sau',
              role: 'cancel'
            }
          ],
          duration: 10000
        });
        await toast.present();
      });
  }

  updateApp() {
    window.location.reload();
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

  private async showNetworkStatus(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 3000,
      position: 'top'
    });
    await toast.present();
  }
}
