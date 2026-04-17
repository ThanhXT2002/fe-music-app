import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  effect,
  EffectRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Album, Song } from '@core/interfaces/song.interface';
import { PlayerStore } from '../../core/stores/player.store';
import { PlaylistStore } from '../../core/stores/playlist.store';
import { AlertController } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { MediaCardComponent } from "../../components/media-card/media-card.component";
import { ToastService } from '@core/ui/toast.service';

/**
 * Trang Qu?n L� Danh s�ch ph�t (Playlists Page).
 *
 * Ch?c nang:
 * - Hi?n th? danh s�ch Playlists do ngu?i d�ng t?o.
 * - Cho ph�p t?o m?i, d?i t�n ho?c x�a Playlist.
 * - Cho ph�p th�m nhanh b�i h�t dang ph�t v�o thu m?c.
 */
@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.page.html',
  styleUrls: ['./playlists.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MediaCardComponent, RouterLink],
})
export class PlaylistsPage implements OnInit, OnDestroy {
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('playlistNameInput') playlistNameInput!: ElementRef<HTMLInputElement>;

  // ═══ STORES (3 only) ═══
  readonly player = inject(PlayerStore);
  private readonly playlistStore = inject(PlaylistStore);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly toastService = inject(ToastService);

  // ═══ STATE ═══
  readonly playlists = this.playlistStore.playlists;
  readonly isDataLoaded = this.playlistStore.isLoaded;

  activePlaylist = signal<string | null>(null);
  scrollPosition = 0;

  private currentSongEffectDispose?: EffectRef;

  constructor() {
    this.setupCurrentSongWatcher();
  }

  // ═══ LIFECYCLE ═══
  async ngOnInit() {
    setTimeout(() => {
      if (this.scrollContainer && this.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollPosition;
      }
    }, 100);

    await this.playlistStore.loadAll();
  }

  ngOnDestroy() {
    if (this.scrollContainer) {
      this.scrollPosition = this.scrollContainer.nativeElement.scrollTop;
    }
    this.currentSongEffectDispose?.destroy();
  }

  // ═══ PLAYLIST ACTIONS ═══
  async playPlaylist(playlist: Album, event: Event) {
    event.stopPropagation();
    if (playlist.songs.length > 0) {
      await this.player.setPlaylist(playlist.songs, 0, playlist.id);
    }
  }

  async onPlaylistClick(item: any) {
    const playlist = item as Album;
    if (playlist.songs.length > 0) {
      await this.player.setPlaylist(playlist.songs, 0, playlist.id);
    }
  }

  onPlaylistMenuClick(event: { item: any; event: Event }) {
    this.showPlaylistContextMenu(event.item as Album, event.event);
  }

  openPlaylist(playlist: Album) {
    console.log('Open playlist:', playlist.name);
  }

  trackByPlaylistId(index: number, playlist: Album): string {
    return playlist.id;
  }

  // ═══ CREATE ═══
  async showCreatePlaylistModal() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Tạo Playlist Mới',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Playlist name',
          attributes: { required: true },
        },
      ],
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.name?.trim()) {
              await this.createNewPlaylist(data.name.trim());
              return true;
            }
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async createNewPlaylist(name: string) {
    try {
      const newPlaylist = await this.playlistStore.create(name);
      if (newPlaylist) {
        this.toastService.show({
          message: `Playlist "${name}" đã được tạo!`,
          color: 'success',
          duration: 2000,
          icon: 'checkmark-circle',
        });
      } else {
        throw new Error('Failed to create playlist');
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      this.toastService.show({
        message: `Không thể tạo playlist: ${error}`,
        color: 'danger',
        duration: 3000,
        icon: 'alert-circle',
      });
    }
  }

  // ═══ CONTEXT MENU ═══
  async showPlaylistContextMenu(playlist: Album, event: Event) {
    event.stopPropagation();
    if (!playlist.isUserCreated) return;

    const alert = await this.alertController.create({
      mode: 'ios',
      header: playlist.name,
      buttons: [
        {
          text: '✏️ Đổi tên Playlist',
          handler: () => this.editNamePlaylist(playlist),
        },
        {
          text: '➕ Chỉnh sửa Playlist',
          handler: () => this.showAddSongsToPlaylist(playlist),
        },
        {
          text: '🗑️ Xóa Playlist',
          role: 'destructive',
          handler: () => this.confirmDeletePlaylist(playlist),
        },
        { text: 'Đóng', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  // ═══ RENAME ═══
  async editNamePlaylist(playlist: Album) {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Đổi tên Playlist',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Tên playlist mới',
          value: playlist.name,
          attributes: { required: true },
        },
      ],
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.name?.trim()) {
              await this.updatePlaylistName(playlist.id, data.name.trim());
              return true;
            }
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async updatePlaylistName(playlistId: string, playlistName: string) {
    try {
      const success = await this.playlistStore.rename(playlistId, playlistName);
      if (success) {
        this.toastService.show({
          message: 'Tên playlist đã được cập nhật!',
          color: 'success',
          duration: 3000,
          icon: 'checkmark-circle',
        });
      } else {
        throw new Error('Failed to update playlist name');
      }
    } catch (error) {
      console.error('Error updating playlist name:', error);
      this.toastService.show({
        message: `Không thể cập nhật tên playlist: ${error}`,
        color: 'danger',
        duration: 3000,
        icon: 'alert-circle',
      });
    }
  }

  // ═══ DELETE ═══
  async confirmDeletePlaylist(playlist: Album) {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa Playlist',
      message: `Bạn có chắc chắn muốn xóa playlist "${playlist.name}"?`,
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: async () => this.deletePlaylist(playlist.id),
        },
      ],
    });
    await alert.present();
  }

  private async deletePlaylist(playlistId: string) {
    try {
      const success = await this.playlistStore.delete(playlistId);
      if (success) {
        this.toastService.show({
          message: 'Playlist đã được xóa thành công!',
          color: 'success',
          duration: 2000,
          icon: 'checkmark-circle',
        });
      } else {
        throw new Error('Failed to delete playlist');
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
      this.toastService.show({
        message: `Không thể xóa playlist: ${error}`,
        color: 'danger',
        duration: 3000,
        icon: 'alert-circle',
      });
    }
  }

  // ═══ UTILITIES ═══
  async showAddSongsToPlaylist(playlist: Album) {
    this.router.navigate(['/edit-playlist', playlist.id]);
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

  isPlaylistActive(playlist: Album): boolean {
    return this.activePlaylist() === playlist.id;
  }

  // ═══ SONG WATCHER — Uses PlaylistStore logic ═══
  private setupCurrentSongWatcher() {
    this.currentSongEffectDispose = effect(() => {
      const currentSong = this.player.currentSong();
      const activeId = currentSong
        ? this.playlistStore.findActivePlaylist(
            currentSong.id,
            this.player.lastPlaylistId
          )
        : null;
      this.activePlaylist.set(activeId);
    });
  }
}
