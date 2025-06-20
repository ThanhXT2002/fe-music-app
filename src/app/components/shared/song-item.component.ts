import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { IonIcon } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { apps } from 'ionicons/icons';
import { AudioPlayerService } from 'src/app/services/audio-player.service';

@Component({
  selector: 'app-song-item',
  template: `
    <div
      (click)="onPlay()"
      (contextmenu)="onShowMenu($event)"
      class="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm border border-gray-200 dark:border-gray-700 mb-2 transition-all duration-300 cursor-pointer"
      [ngClass]="{
        'bg-blue-50 dark:bg-violet-900/40 bg-opacity-60 backdrop-blur-lg border-2 border-pink-300 dark:border-purple-500':
          isCurrentSong,

        'scale-[0.98]': isCurrentSong && isThisSongPlaying,
        'hover:shadow-md': !isCurrentSong,

      }"
      [title]="isCurrentSong ? 'Click to open player' : 'Click to play'"
    >
      <div class="flex items-center space-x-3">
        <!-- Thumbnail -->
        <img
          [src]="song.thumbnail || 'assets/images/default-album.png'"
          [alt]="song.title"
          class="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2  shadow-2xl shadow-rose-500"
          [ngClass]="{
            'spin-with-fill border-lime-500': isThisSongPlaying,
            'spin-paused border-purple-500': !isThisSongPlaying,
            'border-blue-500': isCurrentSong && !isThisSongPlaying
          }"
        />
        <!-- Song Info -->
        <div class="flex-1 min-w-0">
          <h4
            class="font-medium truncate transition-colors duration-300"
            [ngClass]="{
              'text-blue-600 dark:text-blue-400': isCurrentSong,
              'text-gray-900 dark:text-gray-100': !isCurrentSong
            }"
          >
            {{ song.title }}
          </h4>
          <p
            class="text-sm truncate transition-colors duration-300"
            [ngClass]="{
              'text-blue-500 dark:text-blue-300': isCurrentSong,
              'text-gray-600 dark:text-gray-400': !isCurrentSong
            }"
          >
            {{ song.artist }}
          </p>
          <p
            class="text-xs"
            [ngClass]="{
              'text-blue-400 dark:text-blue-300': isCurrentSong,
              'text-gray-600 dark:text-gray-400': !isCurrentSong
            }"
          >
            {{ song.duration_formatted }}
          </p>
        </div>
        <div class="flex-shrink-0">
          <button
            (click)="onShowMenu($event)"
            class="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 dark:text-gray-500"
          >
            <!-- Show playing indicator if this song is currently playing -->
            <div
              *ngIf="isThisSongPlaying"
              class="text-blue-500 playing-indicator"
            >
              <i class="fas fa-volume-up text-lg"></i>
            </div>
            <!-- Show menu icon if not playing -->
            <ion-icon *ngIf="!isThisSongPlaying" name="apps"></ion-icon>
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

      /* Animation cho playing song */
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      .playing-indicator {
        animation: pulse 1.5s ease-in-out infinite;
      }
    `,
  ],
  imports: [CommonModule, IonIcon],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongItemComponent implements OnInit {
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
  @Output() openPlayer = new EventEmitter<void>();
  currentSong: Song | null = null;
  isPlaying = false;
  constructor(
    private audioPlayerService: AudioPlayerService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    addIcons({ apps });

    // Use effect to reactively update when playback state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.currentSong = state.currentSong;
      this.isPlaying = state.isPlaying;
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    // Get initial state
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;
  }

  get isCurrentSong(): boolean {
    return this.currentSong?.id === this.song.id;
  }

  get isThisSongPlaying(): boolean {
    return this.isCurrentSong && this.audioPlayerService.isPlaying();
  }
  onPlay() {
    // Nếu song này đang được phát (active), thì mở player page
    if (this.isCurrentSong) {
      this.router.navigate(['/player']);
      this.openPlayer.emit();
    } else {
      // Nếu không phải song đang phát, thì phát bài hát này
      this.play.emit({
        song: this.song,
        playlist: this.playlist,
        index: this.index,
      });
    }
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
