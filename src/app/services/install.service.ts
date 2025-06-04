import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InstallService {
  private deferredPrompt: any = null;
  private isPromptReady = false;
  private eventListenerAdded = false;

  constructor() {
    // Đợi DOM load xong mới setup
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupInstallPrompt();
      });
    } else {
      this.setupInstallPrompt();
    }
  }

  private setupInstallPrompt() {
    if (this.eventListenerAdded) return;

    console.log('Setting up install prompt listeners...');

    // Thêm user engagement triggers
    this.addUserEngagementListeners();

    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt event triggered');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isPromptReady = true;
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA được cài đặt thành công');
      this.deferredPrompt = null;
      this.isPromptReady = false;
    });

    this.eventListenerAdded = true;
  }

  private addUserEngagementListeners() {
    // Thêm listeners cho user interactions để trigger beforeinstallprompt
    const events = ['click', 'scroll', 'keydown', 'touchstart'];
    let interactionCount = 0;

    const handleInteraction = () => {
      interactionCount++;
      console.log(`User interaction ${interactionCount}`);

      // Sau 3 interactions, check lại
      if (interactionCount >= 3 && !this.deferredPrompt) {
        setTimeout(() => {
          console.log('Checking for delayed beforeinstallprompt...');
        }, 1000);
      }

      // Remove listeners sau 5 interactions
      if (interactionCount >= 5) {
        events.forEach(event => {
          document.removeEventListener(event, handleInteraction);
        });
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true });
    });
  }

  private checkInstallability() {
    // Force check bằng cách trigger một số user interactions
    console.log('Checking PWA installability...');

    // Kiểm tra xem có service worker không
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Worker registrations:', registrations.length);
      });
    }

    // Kiểm tra manifest
    const manifest = document.querySelector('link[rel="manifest"]');
    console.log('Manifest found:', !!manifest);
  }

  canInstall(): boolean {
    return this.isPromptReady && this.deferredPrompt !== null;
  }

  isRunningStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  async install(): Promise<'accepted' | 'dismissed' | 'not-available'> {
    if (!this.deferredPrompt) {
      return 'not-available';
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.isPromptReady = false;
      return outcome;
    } catch (error) {
      console.error('Install prompt error:', error);
      return 'not-available';
    }
  }
}
