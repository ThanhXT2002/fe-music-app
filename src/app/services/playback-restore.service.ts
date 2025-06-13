import { Injectable, signal } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { AudioPlayerService } from './audio-player.service';

@Injectable({
  providedIn: 'root'
})
export class PlaybackRestoreService {
  showRestorePrompt = signal(false);
  savedSongTitle = signal('');

  constructor(
    private toastController: ToastController,
    private audioPlayerService: AudioPlayerService
  ) {}

  async checkForSavedState(): Promise<boolean> {
    try {
      const saved = localStorage.getItem('savedPlaybackState');
      if (!saved) return false;

      const savedState = JSON.parse(saved);

      // Chỉ hiển thị nếu save không quá 7 ngày
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 ngày
      if (Date.now() - savedState.savedAt > maxAge) {
        localStorage.removeItem('savedPlaybackState');
        return false;
      }

      if (savedState.currentSong) {
        this.savedSongTitle.set(savedState.currentSong.title);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking saved state:', error);
      return false;
    }
  }

  async showRestoreToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: `Tiếp tục nghe "${this.savedSongTitle()}"?`,
      duration: 5000,
      position: 'top',
      buttons: [
        {
          text: 'Tiếp tục',
          handler: () => {
            this.audioPlayerService.restorePlaybackState();
          }
        },
        {
          text: 'Bỏ qua',
          role: 'cancel',
          handler: () => {
            this.audioPlayerService.clearSavedState();
          }
        }
      ]
    });

    await toast.present();
  }
}
