import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { AlertController } from '@ionic/angular';
import { InstallPromptComponent } from '../../components/install-prompt/install-prompt.component';
import { routeAnimation } from 'src/app/shared/route-animation';
import { Capacitor } from '@capacitor/core';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DownloadService } from '../../services/download.service';
import { AccountPanelComponent } from 'src/app/components/account-panel/account-panel.component';
import { SaveFileZipService } from 'src/app/services/save-file-zip.service';
import { ToastService } from 'src/app/services/toast.service';
import { Router } from '@angular/router';
import { RefreshService } from 'src/app/services/refresh.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InstallPromptComponent,
    AccountPanelComponent,
  ],
  templateUrl: './settings.page.html',
  animations: [routeAnimation],
})
export class SettingsPage implements OnInit {
  private playlistService = inject(PlaylistService);
  private alertController = inject(AlertController);
  private audioPlayerService = inject(AudioPlayerService);
  private downloadService = inject(DownloadService);
  private saveFileZipService = inject(SaveFileZipService);
  private toastService = inject(ToastService);
  private refreshService = inject(RefreshService);
  private router = inject(Router);

  currentSong = this.audioPlayerService.currentSong;
  isNative = Capacitor.isNativePlatform();
  isLoadingImport = false;
  isLoadingExport = false;
  appVersion = environment.appVersion;
  emailSupport = environment.emailSupport;
  appName = environment.appName;

  ngOnInit() {}

  // Database Management
  async clearDatabase() {
    const confirm = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa toàn bộ dữ liệu',
      message:
        'Thao tác này sẽ xóa TẤT CẢ dữ liệu bao gồm bài hát và playlist. Bạn có chắc chắn muốn tiếp tục?',
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Xóa tất cả',
          role: 'destructive',
          handler: async () => {
            const success = await this.playlistService.clearAllDatabase();
            if (success) {
              this.downloadService.resetNotificationState();
              const alert = await this.alertController.create({
                mode: 'ios',
                header: 'Thành công',
                message: 'Đã xóa sạch dữ liệu và cache thông báo!',
                buttons: ['Đóng'],
              });
              await alert.present();
            }
          },
        },
      ],
    });
    await confirm.present();
  }

  // Import/Export functions (placeholders)
  async exportData() {
    this.isLoadingExport = true;
    await this.saveFileZipService.exportAllToZip();
    let locationFile = 'trên thiết bị';
    if (this.isNative) {
      locationFile = 'Documents';
    }
    this.toastService.success(`Đã sao lưu dữ liệu vào thư mục ${locationFile}!`);
    this.isLoadingExport = false;
  }

  async importData() {
    this.isLoadingImport = true;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const result = await this.saveFileZipService.importAllFromZip(file);
        this.toastService.success(
          `Đã nhập: ${result.songs} bài hát, ${result.playlists} playlist, ${result.audio} file audio.`
        );
        this.refreshService.triggerRefresh();
        this.isLoadingImport = false;
      }
    };
    input.click();
  }


  async showPrivacyPolicy() {
    await this.router.navigate(['/privacy-policy']);
  }

  async showTermsOfService() {
    await this.router.navigate(['/terms-of-service']);
  }


  async clearCache() {
    const confirm = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa cache',
      message:
        'Thao tác này sẽ xóa cache thông báo và reset trạng thái download. Tiếp tục?',
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Xóa cache',
          handler: async () => {
            this.downloadService.resetNotificationState();
            const alert = await this.alertController.create({
              mode: 'ios',
              header: 'Thành công',
              message: 'Đã xóa cache thành công!',
              buttons: ['Đóng'],
            });
            await alert.present();
          },
        },
      ],
    });
    await confirm.present();
  }

  goToPwaGuide(){
    this.router.navigate(['/pwa-guide']);
  }
}
