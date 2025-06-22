import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Album } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { AlbumsPageStateService } from '../../services/albums-page-state.service';
import { AlbumService } from '../../services/album.service'; // ✨ New import
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';
import { AlertController } from '@ionic/angular'; // ✨ Add AlertController for modal
import { FormsModule } from '@angular/forms'; // ✨ Add FormsModule for forms

@Component({
  selector: 'app-albums',
templateUrl: './albums.page.html',
  styles: [
    `
      .album-card:active {
        transform: scale(0.98);
      }

      .album-card:hover {
        transform: translateY(-2px);
      }
    `,
  ],
  imports: [CommonModule, RouterLink, FormsModule],
  standalone: true,
})
export class AlbumsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  constructor(
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService,
    public albumsState: AlbumsPageStateService,
    private refreshService: RefreshService,
    private albumService: AlbumService, // ✨ Inject AlbumService
    private alertController: AlertController // ✨ Inject AlertController
  ) {}

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
      header: 'Create New Album',
      subHeader: 'Enter artist name (will be used as album name)',
      inputs: [
        {
          name: 'artistName',
          type: 'text',
          placeholder: 'Artist name',
          attributes: {
            required: true
          }
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Album description (optional)'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },        {
          text: 'Create',
          handler: async (data) => {
            if (data.artistName) {
              await this.createNewAlbum(data.artistName, data.description);
              return true;
            }
            return false;
          }
        }
      ]
    });

    await alert.present();
  }
  // ✨ Create new album (artist-based)
  private async createNewAlbum(artistName: string, description?: string) {
    try {
      const newAlbum = await this.albumService.createAlbum({
        name: artistName, // Artist name becomes album name
        description: description
      });

      if (newAlbum) {
        // Refresh albums list
        await this.loadAlbums();
        console.log('Album created successfully:', newAlbum.name);

        // Show success message
        const successAlert = await this.alertController.create({
          header: 'Success',
          message: `Album "${artistName}" created successfully!`,
          buttons: ['OK']
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to create album');
      }
    } catch (error) {
      console.error('Error creating album:', error);

      // Show error message
      const errorAlert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to create album. Please try again.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  // ✨ Show album context menu for user-created albums
  async showAlbumContextMenu(album: Album, event: Event) {
    event.stopPropagation();

    if (!album.isUserCreated) {
      return; // Only for user-created albums
    }    const alert = await this.alertController.create({
      header: album.name,
      subHeader: `By ${album.artist}`,
      buttons: [
        {
          text: '✏️ Edit Album',
          handler: () => {
            this.editAlbum(album);
          }
        },
        {
          text: '➕ Add Songs',
          handler: () => {
            this.showAddSongsToAlbum(album);
          }
        },
        {
          text: '🗑️ Delete Album',
          role: 'destructive',
          handler: () => {
            this.confirmDeleteAlbum(album);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }  // ✨ Edit album information (artist-based)
  async editAlbum(album: Album) {
    const alert = await this.alertController.create({
      header: 'Edit Album',
      subHeader: 'Edit artist name (album name)',
      inputs: [
        {
          name: 'artistName',
          type: 'text',
          placeholder: 'Artist name',
          value: album.name, // Album name is artist name
          attributes: {
            required: true
          }
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Album description (optional)',
          value: album.description || ''
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: async (data) => {
            if (data.artistName) {
              await this.updateAlbum(album.id, data.artistName, data.description);
              return true;
            }
            return false;
          }
        }
      ]
    });

    await alert.present();
  }
  // ✨ Update album (artist-based)
  private async updateAlbum(albumId: string, artistName: string, description?: string) {
    try {
      const success = await this.albumService.updateAlbum(albumId, {
        name: artistName, // Artist name becomes album name
        description: description
      });

      if (success) {
        await this.loadAlbums();
        console.log('Album updated successfully');

        const successAlert = await this.alertController.create({
          header: 'Success',
          message: 'Album updated successfully!',
          buttons: ['OK']
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to update album');
      }
    } catch (error) {
      console.error('Error updating album:', error);

      const errorAlert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to update album. Please try again.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  // ✨ Show add songs to album
  async showAddSongsToAlbum(album: Album) {
    // TODO: Implement add songs interface
    // For now, show a placeholder message
    const alert = await this.alertController.create({
      header: 'Add Songs',
      message: 'This feature will allow you to add songs to your album. Implementation coming soon!',
      buttons: ['OK']
    });
    await alert.present();
  }

  // ✨ Confirm delete album
  async confirmDeleteAlbum(album: Album) {
    const alert = await this.alertController.create({
      header: 'Delete Album',
      message: `Are you sure you want to delete "${album.name}"? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.deleteAlbum(album.id);
          }
        }
      ]
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
          header: 'Success',
          message: 'Album deleted successfully!',
          buttons: ['OK']
        });
        await successAlert.present();
      } else {
        throw new Error('Failed to delete album');
      }
    } catch (error) {
      console.error('Error deleting album:', error);

      const errorAlert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to delete album. Please try again.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }
}
