import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  inject,
  computed,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject } from 'rxjs';
import { DatabaseService } from 'src/app/services/database.service';

import {
  IonReorderGroup,
  IonContent,
   ItemReorderEventDetail, IonItem, IonReorder, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { reorderThreeOutline } from 'ionicons/icons';
import { SongItemComponent } from "../song-item/song-item.component";

@Component({
  selector: 'app-current-playlist',
  templateUrl: './current-playlist.component.html',
  styleUrls: ['./current-playlist.component.scss'],
  standalone: true,
  imports: [IonIcon, IonReorder, IonItem,  IonReorderGroup, IonContent, CommonModule, SongItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentPlaylistComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);

  // Output để thông báo trạng thái drag cho parent component
  @Output() dragActive = new EventEmitter<boolean>();

  // Use signals to track state - this ensures proper reactivity
  currentSong = this.audioPlayerService.currentSong;
  isPlaying = this.audioPlayerService.isPlayingSignal;
  isShuffling = this.audioPlayerService.isShuffling;
  currentIndex = this.audioPlayerService.currentIndex;
  currentTime = this.audioPlayerService.currentTime;
  duration = this.audioPlayerService.duration;

  // Computed signals based on playbackState
  playbackState = this.audioPlayerService.playbackState;
  currentPlaylist = computed(() => this.playbackState().currentPlaylist);

  // Progress percentage for progress bar
  progressPercentage = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  // Formatted time strings
  progressTime = computed(() => this.formatTime(this.currentTime()));

  // Countdown time - thời gian còn lại
  remainingTime = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    const remaining = total > 0 ? total - current : 0;
    return Math.max(0, remaining); // Đảm bảo không âm
  });
  // Formatted countdown time
  durationTime = computed(() => {
    const remaining = this.remainingTime();
    return `-${this.formatTime(remaining)}`;
  });

  constructor() {
    // Force change detection when any signal changes - THIS IS THE KEY FIX
    effect(() => {
      // Track all signals that should trigger UI updates
      const song = this.currentSong();
      const playing = this.isPlaying();
      const shuffling = this.isShuffling();
      const index = this.currentIndex();
      const time = this.currentTime();
      const dur = this.duration();
      const state = this.playbackState(); // Force change detection to ensure UI updates
      // Use requestAnimationFrame to ensure it runs in next tick
      requestAnimationFrame(() => {
        this.cdr.detectChanges();
      });
    }); // Listen for custom events from PlayerPage to force change detection
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'player-action-triggered',
        this.handlePlayerAction
      );
    }

    addIcons({ reorderThreeOutline });
  }
  ngOnInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete(); // Clean up custom event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener(
        'player-action-triggered',
        this.handlePlayerAction
      );
    }
  }
  private handlePlayerAction = () => {
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
    });
  };

  // Track function for ngFor
  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
  // Get current song index in playlist
  getCurrentSongIndex(): number {
    return this.currentIndex();
  }

  // Check if song is currently playing
  isCurrentSong(song: Song): boolean {
    return this.currentSong()?.id === song.id;
  }

  // Get CSS class for song item
  getSongItemClass(song: Song, index: number): string {
    const isActive = this.isCurrentSong(song);
    if (isActive) {
      return `bg-purple-900/20 border-purple-700`;
    }

    return `border-gray-400`;
  }

  // Play specific song
  async playSong(song: Song, index: number) {
    try {
      await this.audioPlayerService.playSong(
        song,
        this.currentPlaylist(),
        index
      );
      // Force UI update after playing
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error playing song:', error);
    }
  } // Remove song from playlist
  async removeSong(event: Event, index: number) {
    event.stopPropagation();

    if (this.currentPlaylist().length <= 1) {
      // If only one song left, clear everything
      await this.clearPlaylist();
      return;
    }

    try {
      // Use removeFromQueue method from audio service
      this.audioPlayerService.removeFromQueue(index);
    } catch (error) {
      console.error('Error removing song:', error);
    }
  } // Toggle shuffle mode
  async toggleShuffle() {
    try {
      this.audioPlayerService.toggleShuffle();
      // Force UI update after action
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error toggling shuffle:', error);
    }
  }

  // Clear entire playlist
  async clearPlaylist() {
    try {
      await this.audioPlayerService.pause();
      // Set empty playlist
      await this.audioPlayerService.setPlaylist([]);
    } catch (error) {
      console.error('Error clearing playlist:', error);
    }
  }
  previousTrack() {
    this.audioPlayerService.playPrevious();
    // Force UI update after action
    this.cdr.detectChanges();
  }

  togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
    // Force UI update after action
    this.cdr.detectChanges();
  }

  nextTrack() {
    this.audioPlayerService.playNext();
    // Force UI update after action
    this.cdr.detectChanges();
  }
  async toggleFavorite() {
    const song = this.currentSong();
    if (!song) return;

    try {
      const newFavoriteStatus = !song.isFavorite;
      await this.databaseService.toggleFavorite(song.id);

      // Update the song object
      song.isFavorite = newFavoriteStatus;
      this.audioPlayerService.updateCurrentSong(song);

      // Force UI update
      this.cdr.detectChanges();

      console.log(`Song ${song.title} favorite status: ${newFavoriteStatus}`);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  // Debug method to manually check signals
  debugSignals() {
    console.log('🔍 Debug signals:', {
      currentSong: this.currentSong()?.title,
      isPlaying: this.isPlaying(),
      isShuffling: this.isShuffling(),
      currentTime: this.currentTime(),
      duration: this.duration(),
      progressPercentage: this.progressPercentage(),
      playbackState: this.playbackState(),
    });
  }

  // Force UI refresh method
  forceRefresh() {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  onImageError(event: any): void {
    event.target.src = './assets/images/musical-note.webp';
  }

  onIonReorder(event: CustomEvent<ItemReorderEventDetail>) {
    const from = event.detail.from;
    const to = event.detail.to;

    // Emit drag active state
    this.dragActive.emit(true);

    if (from !== to) {
      const playlist = [...this.currentPlaylist()];
      const [moved] = playlist.splice(from, 1);
      playlist.splice(to, 0, moved);

      const currentSong = this.currentSong();
      let newCurrentIndex = playlist.findIndex((s) => s.id === currentSong?.id);

      if (
        currentSong &&
        playlist[newCurrentIndex] &&
        playlist[newCurrentIndex].id === currentSong.id
      ) {
        this.audioPlayerService.reorderPlaylistInPlace(
          playlist,
          newCurrentIndex
        );
      } else {
        this.audioPlayerService.setPlaylist(playlist, newCurrentIndex);
      }

      // Add completion animation class
      setTimeout(() => {
        const items = document.querySelectorAll('.reorder-item-wrapper');
        if (items[to]) {
          items[to].classList.add('item-reorder-complete');
          setTimeout(() => {
            items[to].classList.remove('item-reorder-complete');
          }, 400);
        }
      }, 50);
    }

    // Complete the reorder with haptic feedback on iOS
    event.detail.complete(true);

    // iOS haptic feedback
    if ('navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Emit drag inactive state
    setTimeout(() => {
      this.dragActive.emit(false);
    }, 100);

    this.cdr.detectChanges();
  }

  getThumbnailClass(song: Song): any {
    const isCurrent = this.isCurrentSong(song);
    return {
      'spin-with-fill': isCurrent,
      'spin-paused': !this.isPlaying() && isCurrent,
      'border-purple-700': isCurrent
    };
  }
}
