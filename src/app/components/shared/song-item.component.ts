import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '../../interfaces/song.interface';
import { IonIcon } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { apps } from 'ionicons/icons';

@Component({
  selector: 'app-song-item',
  template: `
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
          class="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-500 shadow-2xl shadow-rose-500"
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
            class="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 dark:text-gray-500"
          >
            <!-- <i class="fas fa-ellipsis-h"></i> -->
             <ion-icon name="apps"></ion-icon>
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
  imports: [CommonModule,IonIcon],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
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

  constructor() {
    addIcons({ apps });
  }
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
