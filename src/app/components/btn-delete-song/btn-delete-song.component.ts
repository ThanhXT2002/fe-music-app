import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, SimpleChanges, OnChanges  } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { AlertController } from '@ionic/angular';
import { DownloadService } from 'src/app/services/download.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-btn-delete-song',
  templateUrl: './btn-delete-song.component.html',
  styleUrls: ['./btn-delete-song.component.scss'],
})
export class BtnDeleteSongComponent implements OnInit, OnDestroy, OnChanges {
  @Input() songId!: string;
  @Output() deleted = new EventEmitter<string>();

  isDownloaded = false;
  private songDownloadedSub?: Subscription;

  constructor(
    private databaseService: DatabaseService,
    private alertController: AlertController,
    private downloadService: DownloadService,
    private cdr: ChangeDetectorRef

  ) {}

ngOnInit() {
    this.songDownloadedSub = this.downloadService.songDownloaded$.subscribe(data => {
      if (data && data.songId === this.songId) {
        this.isDownloaded = data.downloaded;
        this.cdr.markForCheck();
      }
    });
    this.checkDownloaded();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['songId'] && !changes['songId'].firstChange) {
      this.checkDownloaded();
    }
  }

  ngOnDestroy() {
    this.songDownloadedSub?.unsubscribe();
  }

    private async checkDownloaded() {
    await this.downloadService.isSongDownloadedDB(this.songId);
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
