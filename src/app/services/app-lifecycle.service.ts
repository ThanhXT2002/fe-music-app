import { Injectable, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { AudioPlayerService } from './audio-player.service';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class AppLifecycleService {
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);

  constructor() {
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners() {
    // Lắng nghe khi app chuyển sang background hoặc bị đóng
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // App đang chuyển sang background - lưu trạng thái
        this.handleAppPause();
      } else {
        // App đang active trở lại
        this.handleAppResume();
      }
    });

    // Lắng nghe khi app bị terminate
    App.addListener('backButton', () => {
      this.handleAppPause();
    });

    // Lắng nghe beforeunload cho web
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.handleAppPause();
      });

      // Lắng nghe pagehide cho PWA/mobile browsers
      window.addEventListener('pagehide', () => {
        this.handleAppPause();
      });

      // Lắng nghe visibilitychange
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.handleAppPause();
        } else if (document.visibilityState === 'visible') {
          this.handleAppResume();
        }
      });
    }
  }

  /**
   * Handle khi app pause/background
   */
  private async handleAppPause() {
    try {
      console.log('📱 App pausing - saving state...');      // Lưu playback state
      this.audioPlayerService.savePlaybackState();

      // IndexedDB doesn't need explicit close
      console.log('🔄 IndexedDB cleanup completed');

      // App state saved successfully
    } catch (error) {
      console.error('❌ Error saving app state:', error);
    }
  }

  /**
   * Handle khi app resume/foreground
   */
  private async handleAppResume() {
    try {
      console.log('📱 App resuming - restoring state...');

      // Khởi tạo lại database connection
      await this.databaseService.initializeDatabase();

      // App state restored successfully
    } catch (error) {
      console.error('❌ Error restoring app state:', error);
    }
  }
}
