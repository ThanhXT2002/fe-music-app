import { Component, OnInit, OnDestroy, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject, takeUntil } from 'rxjs';

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

  // Current state from audio service
  currentSong: Song | null = null;
  currentPlaylist: Song[] = [];
  currentIndex: number = 0;
  isPlaying: boolean = false;
  isShuffling: boolean = false;
  constructor() {
    // Listen to audio player state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.currentSong = state.currentSong;
      this.isPlaying = state.isPlaying;
      this.currentIndex = state.currentIndex;
      this.isShuffling = state.isShuffled;
      this.currentPlaylist = state.currentPlaylist;
    });
  }
  ngOnInit() {
    // Get initial state
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;
    this.currentIndex = state.currentIndex;
    this.isShuffling = state.isShuffled;
    this.currentPlaylist = state.currentPlaylist;
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
    return this.currentIndex;
  }

  // Check if song is currently playing
  isCurrentSong(song: Song): boolean {
    return this.currentSong?.id === song.id;
  }

  // Get CSS class for song item
  getSongItemClass(song: Song, index: number): string {
    const baseClass = 'hover:bg-gray-100 dark:hover:bg-gray-700';
    if (this.isCurrentSong(song)) {
      return `${baseClass} bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700`;
    }
    return baseClass;
  }
  // Play specific song
  async playSong(song: Song, index: number) {
    try {
      await this.audioPlayerService.playSong(song, this.currentPlaylist, index);
    } catch (error) {
      console.error('Error playing song:', error);
    }
  }
  // Remove song from playlist
  async removeSong(event: Event, index: number) {
    event.stopPropagation();

    if (this.currentPlaylist.length <= 1) {
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
}
