import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  inject,
  computed,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject } from 'rxjs';
import { DatabaseService } from 'src/app/services/database.service';
import { formatTime } from 'src/app/utils/format-time.util';

import {
  IonReorderGroup,
  IonContent,
  ItemReorderEventDetail,
  IonItem,
} from '@ionic/angular/standalone';

import { SongItemComponent } from '../song-item/song-item.component';
import { BtnDownAndHeartComponent } from '../btn-down-and-heart/btn-down-and-heart.component';
import { BtnAddPlaylistComponent } from '../btn-add-playlist/btn-add-playlist.component';
import { PlaylistModalLayoutComponent } from "../playlist-modal-layout/playlist-modal-layout.component";

@Component({
  selector: 'app-current-playlist',
  templateUrl: './current-playlist.component.html',
  styleUrls: ['./current-playlist.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    BtnDownAndHeartComponent,
    BtnAddPlaylistComponent,
    PlaylistModalLayoutComponent
],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentPlaylistComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);

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
  progressTime = computed(() => formatTime(this.currentTime()));

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
    return `-${formatTime(remaining)}`;
  });

  constructor() {
    effect(() => {
      this.currentSong();
      this.isPlaying();
      this.isShuffling();
      this.currentIndex();
      this.currentTime();
      this.duration();
      this.playbackState();
      requestAnimationFrame(() => {
        this.cdr.detectChanges();
      });
    });
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'player-action-triggered',
        this.handlePlayerAction
      );
    }

    effect(() => {
      const deletedId = this.databaseService.deletedSongId();
      if (deletedId) {
        this.removeSongByIdFromCurrentPlaylist(deletedId);
        // Reset signal để tránh lặp lại
        this.databaseService.deletedSongId.set(null);
      }
    });
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

  private removeSongByIdFromCurrentPlaylist(songId: string) {
    const playlist = this.currentPlaylist();
    if (!Array.isArray(playlist)) return;
    const index = playlist.findIndex((s) => s.id === songId);
    if (index !== -1) {
      if (playlist.length <= 1) {
        this.clearPlaylist();
      } else {
        this.audioPlayerService.removeFromQueue(index);
      }
      // Đảm bảo UI cập nhật
      this.cdr.detectChanges();
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
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }





  onImageError(event: any): void {
    event.target.src = './assets/images/musical-note.webp';
  }

  onIonReorder(event: CustomEvent<ItemReorderEventDetail>) {
    const from = event.detail.from;
    const to = event.detail.to;

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
    }

    // Complete the reorder
    event.detail.complete(true);
    this.cdr.detectChanges();
  }

  getThumbnailClass(song: Song): any {
    const isCurrent = this.isCurrentSong(song);
    return {
      'spin-with-fill': isCurrent,
      'spin-paused': !this.isPlaying() && isCurrent,
      'border-purple-700': isCurrent,
    };
  }
}
