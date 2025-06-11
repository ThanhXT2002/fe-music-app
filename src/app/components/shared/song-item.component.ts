import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../interfaces/song.interface';

@Component({
  selector: 'app-song-item',
  template: `
    <!-- <div
      class="song-item bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      (click)="onPlay()"
      (contextmenu)="onShowMenu($event)"
    >
      <div class="flex items-center space-x-3">
        <div class="relative flex-shrink-0">
          <img
            [src]="song.thumbnail || 'assets/images/default-song.png'"
            [alt]="song.title"
            class="w-12 h-12 rounded-lg object-cover"
          />
          <div
            class="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          >
            <i class="fas fa-play text-white text-sm"></i>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-medium text-gray-900 dark:text-white truncate">
            {{ song.title }}
          </h3>
          <p
            *ngIf="showArtist"
            class="text-sm text-gray-500 dark:text-gray-400 truncate"
          >
            {{ song.artist }}
          </p>
          <div class="flex items-center space-x-2 mt-1">
            <span
              *ngIf="showAlbum && song.album"
              class="text-xs text-gray-400 dark:text-gray-500"
              >{{ song.album }}</span
            >
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button
            (click)="onToggleFavorite($event)"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            [class.text-red-500]="song.isFavorite"
            [class.text-gray-400]="!song.isFavorite"
          >
            <i [class]="song.isFavorite ? 'fas fa-heart' : 'far fa-heart'"></i>
          </button>

          <span class="text-xs text-gray-400 dark:text-gray-500 min-w-0">
            {{ formatDuration(song.duration) }}
          </span>
          <button
            (click)="onShowMenu($event)"
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 dark:text-gray-500"
          >
            <i class="fas fa-ellipsis-h"></i>
          </button>
        </div>
      </div>
    </div> -->

    <div
      (click)="onPlay()"
      (contextmenu)="onShowMenu($event)"
      class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 mb-2"
    >
      <div class="flex items-center space-x-3">
        <!-- Thumbnail -->
        <img
          [src]="song.thumbnail || 'assets/images/default-album.png'"
          [alt]="song.title"
          class="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-500"
        />

        <!-- Song Info -->
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">
            {{ song.title }}
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
            {{ song.artist }}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {{ song.duration_formatted }}
          </p>
        </div>

        <div class="flex-shrink-0">
          <button
            (click)="onShowMenu($event)"
            class="w-8 h-8 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 dark:text-gray-500"
          >
            <i class="fas fa-ellipsis-h"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .song-item:active {
        transform: scale(0.98);
      }
    `,
  ],
  imports: [CommonModule],
  standalone: true,
})
export class SongItemComponent {
  @Input() song!: Song;
  @Input() showAlbum: boolean = true;
  @Input() showArtist: boolean = true;
  @Input() playlist: Song[] = [];
  @Input() index: number = 0;
  @Output() play = new EventEmitter<{
    song: Song;
    playlist: Song[];
    index: number;
  }>();
  @Output() showMenu = new EventEmitter<Song>();
  @Output() toggleFavorite = new EventEmitter<Song>();
  onPlay() {
    this.play.emit({
      song: this.song,
      playlist: this.playlist,
      index: this.index,
    });
  }

  onShowMenu(event: Event) {
    event.stopPropagation();
    this.showMenu.emit(this.song);
  }

  onToggleFavorite(event: Event) {
    event.stopPropagation();
    this.toggleFavorite.emit(this.song);
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
