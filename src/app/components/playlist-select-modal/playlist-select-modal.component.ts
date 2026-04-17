import { Component, OnInit, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController, AlertController } from '@ionic/angular/standalone';
import { PlaylistService } from '@core/services/playlist.service';
import { LibraryStore } from '../../core/stores/library.store';
import { Playlist } from '@core/interfaces/playlist.interface';
import { CommonModule } from '@angular/common';
import { IonContent, IonList } from "@ionic/angular/standalone";

/**
 * Component Sheet trượt dưới lên nhằm hiển thị Danh Sách Playlist (Chọn Thêm Hoặc Gỡ).
 *
 * Chức năng:
 * - Tương tác Database để Fetch danh mục Playlist mà User này đã tạo tự do cất giấu.
 * - Hiển thị Alert Native Modal tạo mới Playlist (Tên List Mới).
 * - Hành vi Toggle Tick/Untick đưa bài hát vô list hoặc bốc ra khỏi List.
 */
@Component({
  selector: 'app-playlist-select-modal',
  templateUrl: './playlist-select-modal.component.html',
  styleUrls: ['./playlist-select-modal.component.scss'],
  standalone: true,
  imports: [IonList, IonContent, FormsModule, CommonModule],
})
export class PlaylistSelectModalComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Input Data Params
  // ─────────────────────────────────────────────────────────
  /** ID Của bản nhạc đang chuẩn bị cần xếp vào Ngăn Playlist nào đó */
  @Input() songId!: string;
  
  // ─────────────────────────────────────────────────────────
  // Local Properties
  // ─────────────────────────────────────────────────────────
  /** Data mang kết quả trả ra từ API Service */
  playlists: Playlist[] = [];
  
  /** Trạng thái UX Loading cho khung đồ hoạ */
  loading = false;

  private readonly modalCtrl = inject(ModalController);
  private readonly playlistService = inject(PlaylistService);
  private readonly alertController = inject(AlertController);
  private readonly library = inject(LibraryStore);

  // ─────────────────────────────────────────────────────────
  // Callbacks Cycle
  // ─────────────────────────────────────────────────────────
  async ngOnInit() {
    await this.loadPlaylists();
  }

  // ─────────────────────────────────────────────────────────
  // Controller Logic
  // ─────────────────────────────────────────────────────────
  /**
   * Gọi Service đùn data Playlist loại "User" về (Tránh loại Hệ thống sinh ra ví dụ Fav List).
   */
  async loadPlaylists() {
    this.loading = true;
    this.playlists = (await this.playlistService.getPlaylistsByType('user')) || [];
    this.loading = false;
  }

  /**
   * Lookup tìm xem cái Node ID `songId` đó có kẹt bên trong lõi mảng `songs` thuộc playlist đó không.
   */
  isSongInPlaylist(playlist: Playlist): boolean {
    if (!this.songId) return false;
    // Hầu hết Model Playlist trả về kèm Songs Array con
    return playlist.songs?.some(s => s.id === this.songId);
  }

  /**
   * Kích bắn quá trình Inject Insert DB / Delete Row DB (Thêm Playlist / Xóa Bài).
   */
  async onTogglePlaylist(playlist: Playlist, checked: boolean) {
    if (!this.songId) return;
    if (checked) {
      await this.playlistService.addSongToPlaylist(playlist.id, this.songId);
    } else {
      await this.playlistService.removeSongFromPlaylist(playlist.id, this.songId);
    }
    await this.loadPlaylists();
    this.library.refresh(); // Sync Đồng bộ trạng thái thẻ Tab ngoài Layout User Library
  }

  /**
   * Đẩy Popup Khung Native thông minh yêu cầu nhập Tên thư mục Nhạc muốn khai sinh mới mẻ.
   */
  async showCreatePlaylistAlert() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Tạo Playlist Mới',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Tên playlist',
          attributes: { required: true },
        },
      ],
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              await this.createArtistPlaylist(data.name.trim());
              return true;
            }
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Thổi luồng kết xuất Service Data cho thao tác Tạo thư mục mới.
   */
  private async createArtistPlaylist(name: string) {
    await this.playlistService.createArtistPlaylist({ name });
    await this.loadPlaylists();
  }

  /**
   * Biến mất Panel
   */
  close() {
    this.modalCtrl.dismiss();
  }
}
