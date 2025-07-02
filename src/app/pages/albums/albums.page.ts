import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  effect, // Add effect import
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Album, Song } from '../../interfaces/song.interface';
import { AudioPlayerService } from '../../services/audio-player.service';
import { AlbumsPageStateService } from '../../services/albums-page-state.service';
import { AlbumService } from '../../services/album.service'; // ✨ New import
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';
import { AlertController } from '@ionic/angular'; // ✨ Add AlertController for modal
import { FormsModule } from '@angular/forms';
import { routeAnimation } from 'src/app/shared/route-animation';
import { MediaCardComponent } from "../../components/media-card/media-card.component";


@Component({
  selector: 'app-albums',
  templateUrl: './albums.page.html',
  styleUrls: ['./albums.page.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MediaCardComponent],
  animations: [routeAnimation],
})
export class AlbumsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('albumNameInput') albumNameInput!: ElementRef<HTMLInputElement>;

  // Track active album
  activeAlbum = signal<string | null>(null);

  currentSong: Song | null = null;

  constructor(
    private audioPlayerService: AudioPlayerService,
    public albumsState: AlbumsPageStateService,
    private refreshService: RefreshService,
    private albumService: AlbumService, // ✨ Inject AlbumService
    private alertController: AlertController // ✨ Inject AlertController
  ) {
    // Setup effect to watch current song changes
    this.setupCurrentSongWatcher();
  }

  async ngOnInit() {
    // Restore scroll position if available
    setTimeout(() => {
      if (this.scrollContainer && this.albumsState.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop =
          this.albumsState.scrollPosition;
      }
    }, 100);

    // Load albums if not already loaded
    if (!this.albumsState.isDataLoaded) {
      await this.loadAlbums();
    }

    // Lắng nghe tín hiệu refresh
    this.refreshService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAlbums();
      });
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.albumsState.setScrollPosition(
        this.scrollContainer.nativeElement.scrollTop
      );
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
  async loadAlbums() {
    try {
      // ✨ Use AlbumService instead of manual grouping
      const albums = await this.albumService.getAllAlbums();
      this.albumsState.setAlbums(albums);
    } catch (error) {
      console.error('Error loading albums:', error);
    }
  }
  async playAlbum(album: Album, event: Event) {
    event.stopPropagation();

    if (album.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(album.songs, 0);
    }
  }

  openAlbum(album: Album) {
    // TODO: Navigate to album detail page
    console.log('Open album:', album.name);
  }

  // Wrapper methods for MediaCardComponent events
  async onAlbumClick(item: any) {
    const album = item as Album;
    // Play album directly when clicked
    if (album.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(album.songs, 0);
    }
  }

  onAlbumMenuClick(event: {item: any, event: Event}) {
    this.showAlbumContextMenu(event.item as Album, event.event);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  trackByAlbumId(index: number, album: Album): string {
    return album.id;
  }
  // ✨ Show create album modal
  async showCreateAlbumModal() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Tạo Album Mới',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Album name',
          attributes: {
            required: true,
          },
        },
      ],
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.name) {
              await this.createNewAlbum(data.name, data.description);
              return true;
            }
            return false;
          },
        },
      ],
    });

    await alert.present();
  }
  // ✨ Create new album (artist-based)
  private async createNewAlbum(name: string, description?: string) {
    try {
      const newAlbum = await this.albumService.createAlbum({
        name: name, // Artist name becomes album name
        description: description,
      });

      if (newAlbum) {
        // Refresh albums list
        await this.loadAlbums();
        console.log('Album created successfully:', newAlbum.name);

        // Show success message
        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: `Album "${name}" đã được tạo!`,
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to create album');
      }
    } catch (error) {
      console.error('Error creating album:', error);

      // Show error message
      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: 'Không thể tạo album. Vui lòng thử lại.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  // ✨ Show album context menu for user-created albums
  async showAlbumContextMenu(album: Album, event: Event) {
    event.stopPropagation();

    if (!album.isUserCreated) {
      return; // Only for user-created albums
    }
    const alert = await this.alertController.create({
      mode: 'ios',
      header: album.name,
      buttons: [
        {
          text: '✏️ Chỉnh sửa Album',
          handler: () => {
            this.editAlbum(album);
          },
        },
        {
          text: '➕ Thêm nhạc vào Album',
          handler: () => {
            this.showAddSongsToAlbum(album);
          },
        },
        {
          text: '🗑️ Xóa Album',
          role: 'destructive',
          handler: () => {
            this.confirmDeleteAlbum(album);
          },
        },
        {
          text: 'Đóng',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  } // ✨ Edit album information (artist-based)
  async editAlbum(album: Album) {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Chỉnh sửa Album',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Tên abum',
          value: album.name, // Album name is artist name
          attributes: {
            required: true,
          },
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Album description (optional)',
          value: album.description || '',
        },
      ],
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.artistName) {
              await this.updateAlbum(
                album.id,
                data.artistName,
                data.description
              );
              return true;
            }
            return false;
          },
        },
      ],
    });

    await alert.present();
  }
  // ✨ Update album (artist-based)
  private async updateAlbum(
    albumId: string,
    artistName: string,
    description?: string
  ) {
    try {
      const success = await this.albumService.updateAlbum(albumId, {
        name: artistName, // Artist name becomes album name
        description: description,
      });

      if (success) {
        await this.loadAlbums();
        console.log('Album updated successfully');

        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: 'Album đã được cập nhật thành công!',
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to update album');
      }
    } catch (error) {
      console.error('Error updating album:', error);

      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: 'Không thể cập nhật album. Vui lòng thử lại.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  // ✨ Show add songs to album
  async showAddSongsToAlbum(album: Album) {
    // TODO: Implement add songs interface
    // For now, show a placeholder message
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Thêm Nhạc vào Album',
      message:
        'Chức năng này sẽ sớm được cập nhật. Hiện tại bạn có thể thêm bài hát vào album thông qua trang chi tiết album.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  // ✨ Confirm delete album
  async confirmDeleteAlbum(album: Album) {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa Album',
      message: `Bạn có chắc chắn muốn xóa album "${album.name}"?`,
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: async () => {
            await this.deleteAlbum(album.id);
          },
        },
      ],
    });

    await alert.present();
  }

  // ✨ Delete album
  private async deleteAlbum(albumId: string) {
    try {
      const success = await this.albumService.deleteAlbum(albumId);

      if (success) {
        await this.loadAlbums();
        console.log('Album deleted successfully');

        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: 'Album đã được xóa thành công!',
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to delete album');
      }
    } catch (error) {
      console.error('Error deleting album:', error);

      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: 'Không thể xóa album. Vui lòng thử lại.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  // ✅ Setup effect to watch current song changes
  private setupCurrentSongWatcher() {
    effect(() => {
      this.currentSong = this.audioPlayerService.currentSong();
      if (this.currentSong) {
        // Find which album contains the current song
        const currentAlbum = this.albumsState.albums.find(album =>
          album.songs.some(song => song.id === this.currentSong?.id)
        );
        this.activeAlbum.set(currentAlbum ? currentAlbum.name : null);
      } else {
        this.activeAlbum.set(null);
      }
    });
  }

  // ✨ Check if album is active
  isAlbumActive(album: Album): boolean {
    const active = this.activeAlbum();
    return active === album.name;
  }
}
