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
import { PlaylistService } from '../../services/playlist.service'; // ✨ Updated import
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';
import { AlertController } from '@ionic/angular'; // ✨ Add AlertController for modal
import { FormsModule } from '@angular/forms';
import { MediaCardComponent } from "../../components/media-card/media-card.component";

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.page.html',
  styleUrls: ['./playlists.page.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MediaCardComponent]
})
export class PlaylistsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('playlistNameInput') playlistNameInput!: ElementRef<HTMLInputElement>;

  // Direct playlist management signals
  playlists = signal<Album[]>([]);
  isDataLoaded = signal<boolean>(false);
  scrollPosition = 0;

  // Track active playlist
  activePlaylist = signal<string | null>(null);

  currentSong: Song | null = null;

  constructor(
    private audioPlayerService: AudioPlayerService,
    private refreshService: RefreshService,
    private playlistService: PlaylistService, // ✨ Updated to use PlaylistService
    private alertController: AlertController // ✨ Inject AlertController
  ) {
    // Setup effect to watch current song changes
    this.setupCurrentSongWatcher();
  }

  async ngOnInit() {
    // Restore scroll position if available
    setTimeout(() => {
      if (this.scrollContainer && this.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollPosition;
      }
    }, 100);

    // Always load playlists fresh from database
    await this.loadPlaylists();

    // Lắng nghe tín hiệu refresh
    this.refreshService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadPlaylists();
      });
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.scrollPosition = this.scrollContainer.nativeElement.scrollTop;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadPlaylists() {
    try {
      // ✨ Always load fresh from database
      console.log('=== LOADING PLAYLISTS START ===');
      console.log('Current playlists in signal before load:', this.playlists().map(p => ({ id: p.id, name: p.name })));

      // Force clear all cache first
      await this.playlistService.clearAllCache();

      // Also force clear database cache explicitly
      this.playlistService['databaseService'].clearPlaylistsCache();

      const playlists = await this.playlistService.getAllArtistPlaylists();

      // Update signals directly
      this.playlists.set(playlists);
      this.isDataLoaded.set(true);

      console.log('=== PLAYLISTS LOADED ===');
      console.log('Total playlists:', playlists.length);
      playlists.forEach((playlist, index) => {
        console.log(`Playlist ${index + 1}:`, {
          id: playlist.id,
          name: playlist.name,
          artist: playlist.artist,
          isUserCreated: playlist.isUserCreated,
          songs: playlist.songs.length
        });
      });
      console.log('Updated playlists in signal after load:', this.playlists().map(p => ({ id: p.id, name: p.name })));
      console.log('=== LOADING PLAYLISTS END ===');
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  }
  async playPlaylist(playlist: Album, event: Event) {
    event.stopPropagation();

    if (playlist.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(playlist.songs, 0);
    }
  }

  openPlaylist(playlist: Album) {
    // TODO: Navigate to playlist detail page
    console.log('Open playlist:', playlist.name);
  }

  // Wrapper methods for MediaCardComponent events
  async onPlaylistClick(item: any) {
    const playlist = item as Album;
    // Play playlist directly when clicked
    if (playlist.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(playlist.songs, 0);
    }
  }

  onPlaylistMenuClick(event: {item: any, event: Event}) {
    this.showPlaylistContextMenu(event.item as Album, event.event);
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

  trackByPlaylistId(index: number, playlist: Album): string {
    return playlist.id;
  }
  // ✨ Show create playlist modal
  async showCreatePlaylistModal() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Tạo Playlist Mới',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Playlist name',
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
            if (data.name && data.name.trim()) {
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
  // ✨ Create new playlist (artist-based)
  private async createNewPlaylist(name: string) {
    try {
      console.log('Creating new playlist:', name);

      const newPlaylist = await this.playlistService.createArtistPlaylist({
        name: name, // Artist name becomes playlist name
      });

      console.log('Created playlist:', newPlaylist);

      if (newPlaylist) {
        // Refresh playlists list
        await this.loadPlaylists();
        console.log('Playlist created successfully:', newPlaylist.name);

        // Show success message
        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: `Playlist "${name}" đã được tạo!`,
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to create playlist');
      }
    } catch (error) {
      console.error('Error creating playlist:', error);

      // Show error message
      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: `Không thể tạo playlist: ${error}`,
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  // ✨ Show playlist context menu for user-created playlists
  async showPlaylistContextMenu(playlist: Album, event: Event) {
    event.stopPropagation();

    if (!playlist.isUserCreated) {
      return; // Only for user-created playlists
    }
    const alert = await this.alertController.create({
      mode: 'ios',
      header: playlist.name,
      buttons: [
        {
          text: '✏️ Đổi tên Playlist',
          handler: () => {
            this.editNamePlaylist(playlist);
          },
        },
        {
          text: '➕ Thêm nhạc vào Playlist',
          handler: () => {
            this.showAddSongsToPlaylist(playlist);
          },
        },
        {
          text: '🗑️ Xóa Playlist',
          role: 'destructive',
          handler: () => {
            this.confirmDeletePlaylist(playlist);
          },
        },
        {
          text: 'Đóng',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  // ✨ Edit playlist name only
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
            if (data.name && data.name.trim()) {
              await this.updatePlaylistName(
                playlist.id,
                data.name.trim()
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
  // ✨ Update playlist name only
  private async updatePlaylistName(
    playlistId: string,
    playlistName: string
  ) {
    try {
      console.log('=== UPDATING PLAYLIST NAME START ===');
      console.log('Playlist ID:', playlistId);
      console.log('New name:', playlistName);

      const success = await this.playlistService.updateArtistPlaylist(playlistId, {
        name: playlistName
      });

      console.log('Update result:', success);

      if (success) {
        console.log('=== FORCE RELOAD FROM DATABASE ===');

        // Force clear ALL caches
        await this.playlistService.clearAllCache();

        // Force reload playlists with a small delay to ensure IndexedDB write is complete
        setTimeout(async () => {
          await this.loadPlaylists();
          console.log('=== PLAYLIST RELOADED AFTER UPDATE ===');
        }, 100);

        console.log('Playlist name updated successfully');

        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: 'Tên playlist đã được cập nhật!',
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to update playlist name');
      }
    } catch (error) {
      console.error('Error updating playlist name:', error);

      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: `Không thể cập nhật tên playlist: ${error}`,
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  // ✨ Show add songs to playlist
  async showAddSongsToPlaylist(playlist: Album) {
    // TODO: Implement add songs interface
    // For now, show a placeholder message
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Thêm Nhạc vào Playlist',
      message:
        'Chức năng này sẽ sớm được cập nhật. Hiện tại bạn có thể thêm bài hát vào playlist thông qua trang chi tiết playlist.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  // ✨ Confirm delete playlist
  async confirmDeletePlaylist(playlist: Album) {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Xóa Playlist',
      message: `Bạn có chắc chắn muốn xóa playlist "${playlist.name}"?`,
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Xóa',
          role: 'destructive',
          handler: async () => {
            await this.deletePlaylist(playlist.id);
          },
        },
      ],
    });

    await alert.present();
  }

  // ✨ Delete playlist
  private async deletePlaylist(playlistId: string) {
    try {
      const success = await this.playlistService.deleteArtistPlaylist(playlistId);

      if (success) {
        await this.loadPlaylists();
        console.log('Playlist deleted successfully');

        const successAlert = await this.alertController.create({
          mode: 'ios',
          header: 'Thành Công',
          message: 'Playlist đã được xóa thành công!',
          buttons: ['OK'],
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to delete playlist');
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);

      const errorAlert = await this.alertController.create({
        mode: 'ios',
        header: 'Lỗi',
        message: 'Không thể xóa playlist. Vui lòng thử lại.',
        buttons: ['OK'],
      });
      await errorAlert.present();
    }
  }

  // ✨ Clear database for debugging
  async clearDatabase() {
    const confirm = await this.alertController.create({
      mode: 'ios',
      header: 'Clear Database',
      message: 'This will delete ALL data including songs and playlists. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            const success = await this.playlistService.clearAllDatabase();
            if (success) {
              this.playlists.set([]);
              console.log('Database cleared successfully');

              const alert = await this.alertController.create({
                mode: 'ios',
                header: 'Success',
                message: 'Database cleared successfully!',
                buttons: ['OK']
              });
              await alert.present();
            }
          }
        }
      ]
    });

    await confirm.present();
  }

  // ✨ Force reload playlists từ database (for testing)
  async forceReloadPlaylists() {
    console.log('Force reloading playlists...');
    await this.loadPlaylists();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  // ✅ Setup effect to watch current song changes
  private setupCurrentSongWatcher() {
    effect(() => {
      this.currentSong = this.audioPlayerService.currentSong();
      if (this.currentSong) {
        // Find which playlist contains the current song
        const currentPlaylist = this.playlists().find((playlist: Album) =>
          playlist.songs.some((song: Song) => song.id === this.currentSong?.id)
        );
        this.activePlaylist.set(currentPlaylist ? currentPlaylist.name : null);
      } else {
        this.activePlaylist.set(null);
      }
    });
  }

  // ✨ Check if playlist is active
  isPlaylistActive(playlist: Album): boolean {
    const active = this.activePlaylist();
    return active === playlist.name;
  }
}
