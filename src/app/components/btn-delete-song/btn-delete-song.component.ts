import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, SimpleChanges, OnChanges } from '@angular/core';
import { DatabaseService } from '@core/data/database.service';
import { AlertController } from '@ionic/angular';
import { DownloadService } from '@core/services/download.service';
import { Subscription } from 'rxjs';

/**
 * Component trình bày Nút "Xóa bài hát" nhằm loại bỏ dữ liệu ngoại tuyến gốc.
 *
 * Chức năng:
 * - Cung cấp cửa sổ xác nhận an toàn trước khi hành động nguy hiểm dọn kho (Alert Guard).
 * - Tác động vào Database gốc IndexedDB và đồng thời dọn Cache File đính kèm Storage Capacitor.
 */
@Component({
  selector: 'app-btn-delete-song',
  templateUrl: './btn-delete-song.component.html',
  styleUrls: ['./btn-delete-song.component.scss'],
})
export class BtnDeleteSongComponent implements OnInit, OnDestroy, OnChanges {
  // ─────────────────────────────────────────────────────────
  // Inputs & Outputs
  // ─────────────────────────────────────────────────────────
  /** Mã định danh ID bắt buộc của bài hát chuẩn bị đem ra hành hình (xoá) */
  @Input() songId!: string;
  
  /** Tín hiệu gửi về mảng cha khi tiến trình Xóa hoàn thành báo hiệu cần F5 Re-render Danh sách */
  @Output() deleted = new EventEmitter<string>();

  // ─────────────────────────────────────────────────────────
  // State 
  // ─────────────────────────────────────────────────────────
  /** Cờ nội suy xem liệu bản nhạc này có đang thực mục sở thị trên Offline mode Database không */
  isDownloaded = false;
  
  /** Xích luồng Subscriber của trạng thái tải xuống để cleanup tránh leak memory mạng */
  private songDownloadedSub?: Subscription;

  // ─────────────────────────────────────────────────────────
  // Lifecycle & Dependency Injection
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Viết logic chìm check lại trong DB xem ID bài hát đúng tiến trình tải về chưa.
   */
  private async checkDownloaded() {
    await this.downloadService.isSongDownloadedDB(this.songId);
  }

  /**
   * Gọi Controller dựng Popup Alert yêu cầu xét duyệt xóa. Rơi vào nhánh Yes thì thực thi gỡ DB.
   */
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
                message: 'Bài hát đã được xóa khỏi danh sách!',
                buttons: ['OK'],
              });
              await successAlert.present();
              this.downloadService.removeSongDownloadState(this.songId);
              this.deleted.emit(this.songId);

            } else {
              const failAlert = await this.alertController.create({
                mode: 'ios',
                header: 'Lỗi',
                message: 'Xóa bài hát thất bại, vui lòng thử khởi động lại!',
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
