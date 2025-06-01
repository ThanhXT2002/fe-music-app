import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-install-prompt',
  template: `
    <div class="p-4" *ngIf="!isRunningStandalone()">
      <!-- Dark Mode Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-gray-900 dark:text-white">Cài đặt</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Cài đặt app để có trải nghiệm tốt nhất với XTMusic.
          </p>
        </div>
        <button class="text-white p-3 bg-purple-600 rounded-full hover:bg-indigo-400 flex justify-center items-center" (click)="installApp()">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    </div>
  `,
  imports: [CommonModule, IonicModule],
  standalone: true,
})
export class InstallPromptComponent implements OnInit {
  private deferredPrompt: any = null;

  ngOnInit() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
    });

    // Check if app was successfully installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA được cài đặt thành công');
      this.deferredPrompt = null;
    });
  }

  isRunningStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
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
  }
}
