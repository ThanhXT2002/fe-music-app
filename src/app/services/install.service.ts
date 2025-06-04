import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InstallService {
  private deferredPrompt: any = null;
  private isPromptReady = false;

  constructor() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
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
