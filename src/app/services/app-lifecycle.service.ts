import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { AudioPlayerService } from './audio-player.service';

@Injectable({
  providedIn: 'root'
})
export class AppLifecycleService {
  private audioPlayerService = inject(AudioPlayerService);

  constructor() {
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners() {
    // Lắng nghe khi app chuyển sang background hoặc bị đóng
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // App đang chuyển sang background - lưu trạng thái
        this.audioPlayerService.savePlaybackState();
      }
    });
    // Lắng nghe khi app bị terminate
    App.addListener('backButton', () => {
      this.audioPlayerService.savePlaybackState();
    });

    // Lắng nghe beforeunload cho web
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.audioPlayerService.savePlaybackState();
      });

      // Lắng nghe pagehide cho PWA/mobile browsers
      window.addEventListener('pagehide', () => {
        this.audioPlayerService.savePlaybackState();
      });

      // Lắng nghe visibilitychange
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.audioPlayerService.savePlaybackState();
        }
      });
    }
  }
}
