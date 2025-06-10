import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PWAService {

  constructor(
    private swUpdate: SwUpdate,
    private alertController: AlertController,
    private toastController: ToastController,
    private platform: Platform
  ) {
    if (swUpdate.isEnabled && platform.is('pwa')) {
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
        const alert = await this.alertController.create({
          header: 'Cập nhật ứng dụng',
          message: 'Có phiên bản mới của ứng dụng. Bạn có muốn cập nhật ngay không?',
          backdropDismiss: false,
          buttons: [
            {
              text: 'Để sau',
              role: 'cancel',
              cssClass: 'secondary'
            },
            {
              text: 'Cập nhật ngay',
              handler: () => {
                this.updateApp();
              }
            }
          ]
        });
        await alert.present();
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
