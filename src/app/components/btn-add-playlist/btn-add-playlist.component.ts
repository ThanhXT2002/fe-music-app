import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, OnDestroy, OnChanges, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { AudioPlayerService } from '@core/services/audio-player.service';
import { IonicModule } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import { DownloadService } from '@core/services/download.service';
import { Subscription } from 'rxjs';

/**
 * Component hiển thị Nút "Thêm vào Playlist" hoặc "Đã thêm" dùng trong ngữ cảnh danh sách nhạc.
 *
 * Chức năng:
 * - Theo dõi trạng thái của ID bài hát xem đã từng nằm trong thư viện chưa (qua Subscription).
 * - Click gọi ra Bottom Modal Sheet cho khâu chọn lựa Playlist đích.
 */
@Component({
  selector: 'app-btn-add-playlist',
  imports: [CommonModule, IonicModule],
  templateUrl: './btn-add-playlist.component.html',
  styleUrls: ['./btn-add-playlist.component.scss'],
})
export class BtnAddPlaylistComponent implements OnInit, OnDestroy, OnChanges {
  // ─────────────────────────────────────────────────────────
  // Dependencies & Inputs
  // ─────────────────────────────────────────────────────────
  private modalCtrl = inject(ModalController);
  private downloadService = inject(DownloadService);
  private cdr = inject(ChangeDetectorRef);

  /** Đầu vào ID chuỗi định danh độc nhất của bài hát, làm căn cứ truy xuất dữ liệu DB */
  @Input() songId!: string;

  // ─────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────
  /** Trạng thái cờ đánh dấu bài hát liệu đã lưu thành công ở Database gốc chăng */
  isDownloaded = false;
  
  /** Quản trị Subcriber tránh thất thoát Memory ngầm (Leak) */
  private songDownloadedSub?: Subscription;

  constructor() {}

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────
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
  // Logic Methods
  // ─────────────────────────────────────────────────────────
  /**
   * Quét lại một vòng DB qua Service để đồng bộ giá trị Download thật.
   */
  private async checkDownloaded() {
    await this.downloadService.isSongDownloadedDB(this.songId);
  }

  /**
   * Khởi chạy Dynamic Import tạo Modal Component khi User tương tác ấn nút thao tác thêm vô danh sách.
   */
  async toggleAddPlaylist() {
    if (!this.songId) return;
    try {
      // Import động component modal danh sách playlist
      const { PlaylistSelectModalComponent } = await import(
        '../playlist-select-modal/playlist-select-modal.component'
      );
      const modal = await this.modalCtrl.create({
        component: PlaylistSelectModalComponent,
        componentProps: {
          songId: this.songId
        },
        presentingElement: undefined,
        breakpoints: [0, 0.6, 1],
        initialBreakpoint: 0.6,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });
      await modal.present();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Lỗi khi mở giao diện chọn Playlist:', error);
    }
  }
}
