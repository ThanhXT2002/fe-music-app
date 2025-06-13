import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DatabaseService } from '../../services/database.service';
import { ModalController, IonicModule } from '@ionic/angular';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule,IonicModule],
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss']
})
export class PlayerPage implements OnInit, OnDestroy {
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private themeService = inject(ThemeService);

  // Audio service signals
  currentSong = this.audioPlayerService.currentSong;
  playbackState = this.audioPlayerService.playbackState;
  currentTime = this.audioPlayerService.currentTime;
  duration = this.audioPlayerService.duration;
  isPlaying = this.audioPlayerService.isPlayingSignal;
  isShuffling = this.audioPlayerService.isShuffling;
  repeatMode = this.audioPlayerService.repeatModeSignal;
  currentIndex = this.audioPlayerService.currentIndex;

  // UI state signals
  isDragging = signal(false);
  tempProgress = signal(0);

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
    this.setPlayerThemeColor();
  }

  ngOnDestroy() {
    this.themeService.updateHeaderThemeColor(this.themeService.isDarkMode());
  }

  private setPlayerThemeColor() {
    this.themeService.setPageHeaderThemeColor('#312e81');
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
  }

  previousTrack() {
    this.audioPlayerService.playPrevious();
  }

  nextTrack() {
    this.audioPlayerService.playNext();
  }

  toggleShuffle() {
    this.audioPlayerService.toggleShuffle();
  }

  toggleRepeat() {
    this.audioPlayerService.toggleRepeat();
  }

  // Progress bar interaction
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

  private updateProgress(event: MouseEvent | TouchEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const progress = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    this.tempProgress.set(progress);
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getRepeatColor(): string {
    return this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-gray-400';
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'text-purple-500' : 'text-gray-400';
  }
}
