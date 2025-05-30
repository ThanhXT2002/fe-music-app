import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DatabaseService } from '../../services/database.service';
import { Song } from '../../interfaces/song.interface';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.page.html'
})
export class PlayerPage implements OnInit, OnDestroy {
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);

  currentSong = this.audioPlayerService.currentSong;
  playbackState = this.audioPlayerService.playbackState;
  currentTime = this.audioPlayerService.currentTime;
  duration = this.audioPlayerService.duration;
  isPlaying = this.audioPlayerService.isPlayingSignal;
  isShuffling = this.audioPlayerService.isShuffling;
  repeatMode = this.audioPlayerService.repeatModeSignal;
  queue = this.audioPlayerService.queue;
  currentIndex = this.audioPlayerService.currentIndex;

  // UI state
  showQueue = signal(false);
  showLyrics = signal(false);
  isDragging = signal(false);
  tempProgress = signal(0);
  volumeSliderVisible = signal(false);

  // Computed values
  progress = computed(() => {
    if (this.isDragging()) {
      return this.tempProgress();
    }
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  progressTime = computed(() => {
    const current = this.isDragging()
      ? (this.tempProgress() / 100) * this.duration()
      : this.currentTime();
    return this.formatTime(current);
  });

  durationTime = computed(() => this.formatTime(this.duration()));

  ngOnInit() {
    // Component initialization
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  goBack() {
    this.router.navigate(['/tabs/list']);
  }

  togglePlayPause() {
    if (this.isPlaying()) {
      this.audioPlayerService.pause();
    } else {
      this.audioPlayerService.play();
    }
  }

  previousTrack() {
    this.audioPlayerService.previous();
  }

  nextTrack() {
    this.audioPlayerService.next();
  }

  toggleShuffle() {
    this.audioPlayerService.toggleShuffle();
  }

  toggleRepeat() {
    this.audioPlayerService.toggleRepeat();
  }

  onProgressStart(event: MouseEvent | TouchEvent) {
    this.isDragging.set(true);
    this.updateProgress(event);
  }

  onProgressMove(event: MouseEvent | TouchEvent) {
    if (this.isDragging()) {
      this.updateProgress(event);
    }
  }

  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.isDragging()) {
      this.updateProgress(event);
      const newTime = (this.tempProgress() / 100) * this.duration();
      this.audioPlayerService.seek(newTime);
      this.isDragging.set(false);
    }
  }

  private updateProgress(event: MouseEvent | TouchEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const progress = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    this.tempProgress.set(progress);
  }

  toggleQueue() {
    this.showQueue.set(!this.showQueue());
  }

  toggleLyrics() {
    this.showLyrics.set(!this.showLyrics());
  }

  playFromQueue(index: number) {
    this.audioPlayerService.playFromQueue(index);
  }

  removeFromQueue(index: number) {
    this.audioPlayerService.removeFromQueue(index);
  }

  async addToFavorites() {
    const song = this.currentSong();
    if (song) {
      try {
        await this.databaseService.addToFavorites(song.id);
        console.log('Added to favorites');
      } catch (error) {
        console.error('Error adding to favorites:', error);
      }
    }
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getRepeatIcon(): string {
    const mode = this.repeatMode();
    switch (mode) {
      case 'one': return 'repeat-one';
      case 'all': return 'repeat';
      default: return 'repeat';
    }
  }

  getRepeatColor(): string {
    return this.repeatMode() !== 'none' ? 'primary' : 'medium';
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'primary' : 'medium';
  }

  // Mock lyrics - in real app, fetch from lyrics API
  getLyrics(): string {
    return '[Verse 1]\\nSample lyrics for demonstration\\nThis would be fetched from a lyrics API\\nBased on the current song\\n\\n[Chorus]\\nMusic brings us together\\nIn this beautiful weather\\nDancing through the night\\nEverything feels so right\\n\\n[Verse 2]\\nMore lyrics would appear here\\nAs the song progresses clear\\nReal-time synchronization\\nBrings musical sensation';
  }
}
