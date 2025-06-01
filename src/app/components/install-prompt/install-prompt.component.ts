import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-install-prompt',
  template: `
    <ion-toast
      [isOpen]="showInstallPrompt"
      message="Cài đặt TXT Music để có trải nghiệm tốt nhất!"
      position="bottom"
      [duration]="0"
      [buttons]="toastButtons"
      (didDismiss)="onDismiss()">
    </ion-toast>
  `,
  imports: [CommonModule, IonicModule],
  standalone: true
})
export class InstallPromptComponent implements OnInit {
  showInstallPrompt = false;
  private deferredPrompt: any = null;

  toastButtons = [
    {
      text: 'Cài đặt',
      handler: () => {
        this.installApp();
      }
    },
    {
      text: 'Để sau',
      role: 'cancel',
      handler: () => {
        this.dismissPrompt();
      }
    }
  ];

  ngOnInit() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event so it can be triggered later
      this.deferredPrompt = e;

      // Check if app is already installed
      if (!this.isAppInstalled()) {
        // Show install prompt after 3 seconds
        setTimeout(() => {
          this.showInstallPrompt = true;
        }, 3000);
      }
    });

    // Check if app was successfully installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA được cài đặt thành công');
      this.deferredPrompt = null;
      this.showInstallPrompt = false;
    });
  }

  private isAppInstalled(): boolean {
    // Check if app is running in standalone mode (installed)
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  async installApp() {
    if (!this.deferredPrompt) {
      return;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt variable
    this.deferredPrompt = null;
    this.showInstallPrompt = false;
  }

  dismissPrompt() {
    this.showInstallPrompt = false;

    // Don't show again for 7 days
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  }

  onDismiss() {
    this.showInstallPrompt = false;
  }

  private shouldShowPrompt(): boolean {
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (!dismissed) return true;

    const dismissedTime = parseInt(dismissed, 10);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return dismissedTime < sevenDaysAgo;
  }
}
