import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { AlertController } from '@ionic/angular';
import { DownloadService } from 'src/app/services/download.service';

@Component({
  selector: 'app-btn-delete-song',
  templateUrl: './btn-delete-song.component.html',
  styleUrls: ['./btn-delete-song.component.scss'],
})
export class BtnDeleteSongComponent {
  @Input() songId!: string;
  @Output() deleted = new EventEmitter<string>();

  constructor(
    private databaseService: DatabaseService,
    private alertController: AlertController,
    private downloadService: DownloadService,

  ) {}

    isDownloaded(): boolean {
    return this.downloadService.isSongDownloaded(this.songId);
  }

  async onDeleteClick() {
    if (!this.songId) return;
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa bài hát',
      message: 'Bạn có chắc chắn muốn xóa bài hát này?',
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: async () => {
            const success = await this.databaseService.deleteSong(this.songId);
            if (success) {
              const successAlert = await this.alertController.create({
                mode: 'ios',
                header: 'Thành công',
                message: 'Bài hát đã được xóa!',
                buttons: ['OK'],
              });
              await successAlert.present();
              this.downloadService.removeSongDownloadState(this.songId);
              this.deleted.emit(this.songId);

            } else {
              const failAlert = await this.alertController.create({
                mode: 'ios',
                header: 'Lỗi',
                message: 'Xóa bài hát thất bại!',
                buttons: ['OK'],
              });
              await failAlert.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
