import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DatabaseService } from '../../services/database.service';
import { Song } from '../../interfaces/song.interface';
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
  queue = this.audioPlayerService.queue;
  currentIndex = this.audioPlayerService.currentIndex;

  // UI state signals
  showQueue = signal(false);
  showLyrics = signal(false);
  isDragging = signal(false);
  tempProgress = signal(0);
  volumeSliderVisible = signal(false);
  volume = signal(1);

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
    // Initialize volume from audio service
    this.volume.set(this.audioPlayerService.getVolume());
     this.setPlayerThemeColor();
  }

  ngOnDestroy() {
    // Cleanup if needed
    this.themeService.updateHeaderThemeColor(this.themeService.isDarkMode());
  }

  private setPlayerThemeColor() {
    // Chọn indigo-900 (#312e81) - màu cuối của gradient
    // Đây là màu đẹp nhất và phù hợp với theme tối
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

  private updateProgress(event: MouseEvent | TouchEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const progress = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    this.tempProgress.set(progress);
  }

  // Volume control
  onVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    this.volume.set(volume);
    this.audioPlayerService.setVolume(volume);
  }

  toggleMute() {
    this.audioPlayerService.toggleMute();
    this.volume.set(this.audioPlayerService.getVolume());
  }

  toggleVolumeSlider() {
    this.volumeSliderVisible.set(!this.volumeSliderVisible());
  }

  // Queue management
  toggleQueue() {
    this.showQueue.set(!this.showQueue());
    this.showLyrics.set(false);
  }

  playFromQueue(index: number) {
    this.audioPlayerService.playFromQueue(index);
  }

  removeFromQueue(index: number) {
    this.audioPlayerService.removeFromQueue(index);
  }

  // Lyrics
  toggleLyrics() {
    this.showLyrics.set(!this.showLyrics());
    this.showQueue.set(false);
  }
  // Favorites
  async addToFavorites() {
    const song = this.currentSong();
    if (song && !song.isFavorite) {
      try {
        const newStatus = await this.databaseService.toggleFavorite(song.id);
        song.isFavorite = newStatus;
        this.audioPlayerService.updateCurrentSong(song);
        console.log('Added to favorites');
      } catch (error) {
        console.error('Error adding to favorites:', error);
      }
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

  // Utility methods
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
    return this.repeatMode() !== 'none' ? 'text-purple-500' : 'text-gray-400';
  }

  getShuffleColor(): string {
    return this.isShuffling() ? 'text-purple-500' : 'text-gray-400';
  }

  getVolumeIcon(): string {
    const vol = this.volume();
    if (vol === 0) return 'volume-mute';
    if (vol < 0.5) return 'volume-down';
    return 'volume-up';
  }
}
