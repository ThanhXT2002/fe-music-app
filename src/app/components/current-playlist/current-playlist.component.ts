import { Component, OnInit, OnDestroy, effect, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject, takeUntil } from 'rxjs';
import { DatabaseService } from 'src/app/services/database.service';

@Component({
  selector: 'app-current-playlist',
  templateUrl: './current-playlist.component.html',
  standalone: true,  imports: [
    CommonModule
  ]
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
  // Formatted time strin

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
    return `${this.formatTime(remaining)}`;
  });

  constructor() {
    // Effect will automatically trigger change detection when signals change
    effect(() => {
      // This effect runs whenever any of the audio service signals change
      const playbackState = this.audioPlayerService.playbackState();

      // Force change detection to ensure UI updates
      this.cdr.markForCheck();
    });
  }  ngOnInit() {
    // No need to manually assign since we're using signals directly
    // Signals will automatically update the UI when values change
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

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
    const baseClass = 'hover:bg-gray-100 dark:hover:bg-gray-700';
    if (this.isCurrentSong(song)) {
      return `${baseClass} bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700`;
    }
    return baseClass;
  }  // Play specific song
  async playSong(song: Song, index: number) {
    try {
      await this.audioPlayerService.playSong(song, this.currentPlaylist(), index);
    } catch (error) {
      console.error('Error playing song:', error);
    }
  }  // Remove song from playlist
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
  }
  // Toggle shuffle mode
  async toggleShuffle() {
    try {
      this.audioPlayerService.toggleShuffle();
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
  }

    togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
  }

    nextTrack() {
    this.audioPlayerService.playNext();
  }
  async toggleFavorite() {
    const song = this.currentSong();
    if (song) {
      try {
        await this.databaseService.toggleFavorite(song.id);
        // Update the song object
        song.isFavorite = !song.isFavorite;
        this.audioPlayerService.updateCurrentSong(song);
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    }
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }
}
