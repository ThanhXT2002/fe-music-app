import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Song, Album } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { AlbumsPageStateService } from '../../services/albums-page-state.service';
import { AlbumService } from '../../services/album.service'; // ✨ New import
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';
import { AlertController } from '@ionic/angular'; // ✨ Add AlertController for modal
import { FormsModule } from '@angular/forms'; // ✨ Add FormsModule for forms

@Component({
  selector: 'app-albums',  template: `
    <div class="albums-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">Albums</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ albumsState.albums.length }} albums</p>
          </div>
          <!-- ✨ Create Album Button -->
          <button
            (click)="showCreateAlbumModal()"
            class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2"
          >
            <i class="fas fa-plus text-sm"></i>
            <span>New Album</span>
          </button>
        </div>
      </div>
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4" #scrollContainer>
        <!-- Albums Grid -->
        <div
          *ngIf="albumsState.albums.length > 0"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >          <div
            *ngFor="let album of albumsState.albums; trackBy: trackByAlbumId"
            (click)="openAlbum(album)"
            class="album-card bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative"
          >
            <!-- ✨ User Album Menu for editable albums -->
            <div *ngIf="album.isUserCreated" class="absolute top-2 right-2 z-10">
              <button
                (click)="showAlbumContextMenu(album, $event)"
                class="w-8 h-8 bg-black bg-opacity-20 hover:bg-opacity-40 rounded-full flex items-center justify-center text-white transition-all"
              >
                <i class="fas fa-ellipsis-v text-sm"></i>
              </button>
            </div>

            <!-- Album Cover -->
            <div class="relative mb-3">
              <img
                [src]="album.thumbnail || 'assets/images/default-album.png'"
                [alt]="album.name"
                class="w-full aspect-square rounded-lg object-cover"
              />

              <!-- Play Button Overlay -->
              <div
                class="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              >
                <button
                  (click)="playAlbum(album, $event)"
                  class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-600 transition-colors"
                >
                  <i class="fas fa-play ml-1"></i>
                </button>
              </div>
            </div>

            <!-- Album Info -->
            <div class="text-center">
              <h3
                class="font-medium text-gray-900 dark:text-white truncate mb-1"
              >
                {{ album.name }}
                <!-- ✨ User-created indicator -->
                <i *ngIf="album.isUserCreated" class="fas fa-user-edit text-purple-500 text-xs ml-1" title="User created album"></i>
              </h3>
              <div
                class="flex items-center justify-center space-x-2 text-xs text-gray-400 dark:text-gray-500"
              >
                <span>{{ album.songs.length }} bài</span>
                <span>•</span>
                <span>{{ formatDuration(album.totalDuration) }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Empty State -->
        <div *ngIf="albumsState.albums.length === 0" class="text-center py-16">
          <i
            class="fas fa-compact-disc text-6xl text-gray-300 dark:text-gray-600 mb-6"
          ></i>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Chưa có album nào
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">
            Tải nhạc từ YouTube để tạo albums tự động
          </p>
          <button
            routerLink="/tabs/search"
            class="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <i class="fas fa-download mr-2"></i>
            Tải nhạc
          </button>
        </div>
      </div>
    </div>
  `,
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
