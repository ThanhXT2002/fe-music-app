import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  effect, // Add effect import
  EffectRef // <-- Thêm dòng này
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Album, Song } from '../../interfaces/song.interface';
import { AudioPlayerService } from '../../services/audio-player.service';
import { PlaylistService } from '../../services/playlist.service'; // ✨ Updated import
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';
import { AlertController } from '@ionic/angular'; // ✨ Add AlertController for modal
import { FormsModule } from '@angular/forms';
import { MediaCardComponent } from "../../components/media-card/media-card.component";
import { ToastService } from '../../services/toast.service';


@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.page.html',
  styleUrls: ['./playlists.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MediaCardComponent]
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
  private currentSongEffectDispose?: EffectRef;

  constructor(
    private router: Router,
    private audioPlayerService: AudioPlayerService,
    private refreshService: RefreshService,
    private playlistService: PlaylistService,
    private alertController: AlertController,
    private toastService: ToastService
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
    this.currentSongEffectDispose?.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadPlaylists() {
    try {
      // Force clear all cache first
      await this.playlistService.clearAllCache();
      this.playlistService['databaseService'].clearPlaylistsCache();

      const playlists = await this.playlistService.getAllArtistPlaylists();

      // Update signals directly
      this.playlists.set(playlists);
      this.isDataLoaded.set(true);
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  }
  async playPlaylist(playlist: Album, event: Event) {
    event.stopPropagation();

    if (playlist.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(playlist.songs, 0, playlist.id);
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
      await this.audioPlayerService.setPlaylist(playlist.songs, 0, playlist.id);
    }
  }

  onPlaylistMenuClick(event: {item: any, event: Event}) {
    this.showPlaylistContextMenu(event.item as Album, event.event);
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
      const newPlaylist = await this.playlistService.createArtistPlaylist({
        name: name,
      });

      if (newPlaylist) {
        await this.loadPlaylists();
        this.toastService.show({
          message: `Playlist "${name}" đã được tạo!`,
          color: 'success',
          duration: 2000,
          icon: 'checkmark-circle'
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
        icon: 'alert-circle'
      });
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
          text: '➕ Chỉnh sửa Playlist',
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
      const success = await this.playlistService.updateArtistPlaylist(playlistId, {
        name: playlistName
      });

      if (success) {
        await this.playlistService.clearAllCache();

        setTimeout(async () => {
          await this.loadPlaylists();
        }, 100);

         this.toastService.show({
          message: `Tên playlist đã được cập nhật!`,
          color: 'success',
          duration: 3000,
          icon: 'checkmark-circle'
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
        icon: 'alert-circle'
      });
    }
  }

  // ✨ Show add songs to playlist
  async showAddSongsToPlaylist(playlist: Album) {
    this.router.navigate(['/edit-playlist', playlist.id]);
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
        this.toastService.show({
          message: 'Playlist đã được xóa thành công!',
          color: 'success',
          duration: 2000,
          icon: 'checkmark-circle'
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
        icon: 'alert-circle'
      });
    }
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  // ✅ Setup effect to watch current song changes
  private setupCurrentSongWatcher() {
    this.currentSongEffectDispose = effect(() => {
      this.currentSong = this.audioPlayerService.currentSong();
      const playlists = this.playlists();
      let activeId: string | null = null;

      if (this.currentSong) {
        // 1. Try last played playlist by id
        const lastPlaylistId = this.audioPlayerService.lastPlaylistId;
        if (lastPlaylistId) {
          const lastPlaylist = playlists.find(p => p.id === lastPlaylistId);
          if (lastPlaylist && lastPlaylist.songs.some(s => s.id === this.currentSong?.id)) {
            activeId = lastPlaylist.id;
          }
        }
        // 2. If not found, try dynamic playlist
        if (!activeId) {
          const dynamic = playlists.find(p => (p as any).type === 'dynamic' && p.songs.some(s => s.id === this.currentSong?.id));
          if (dynamic) activeId = dynamic.id;
        }
        // 3. If not found, try user playlist
        if (!activeId) {
          const user = playlists.find(p => (p as any).type === 'user' && p.songs.some(s => s.id === this.currentSong?.id));
          if (user) activeId = user.id;
        }
        // 4. If not found, any playlist containing the song
        if (!activeId) {
          const anyPlaylist = playlists.find(p => p.songs.some(s => s.id === this.currentSong?.id));
          if (anyPlaylist) activeId = anyPlaylist.id;
        }
      }
      this.activePlaylist.set(activeId);
    });
  }

  // ✨ Check if playlist is active
  isPlaylistActive(playlist: Album): boolean {
    const active = this.activePlaylist();
    return active === playlist.id;
  }
}
