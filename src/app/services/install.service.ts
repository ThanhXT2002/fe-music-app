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

    // Thêm user engagement triggers
    this.addUserEngagementListeners();

    window.addEventListener('beforeinstallprompt', (e) => {

      e.preventDefault();
      this.deferredPrompt = e;
      this.isPromptReady = true;
    });

    window.addEventListener('appinstalled', () => {
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
      // Sau 3 interactions, check lại
      if (interactionCount >= 3 && !this.deferredPrompt) {
        setTimeout(() => {

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
