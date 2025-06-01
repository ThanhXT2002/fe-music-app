import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-install-prompt',
  template: `
    <div class="p-4" *ngIf="shouldShowInstallPrompt()">
      <!-- Install Prompt -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium text-gray-900 dark:text-white">Cài đặt</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Cài đặt app để có trải nghiệm tốt nhất với XTMusic.
          </p>
        </div>
        <button class="text-white p-3 bg-purple-600 rounded-full hover:bg-indigo-400 flex justify-center items-center"
                (click)="installApp()"
                [disabled]="!canInstall()">
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
  private installPromptAvailable = false;

    constructor(private platform: Platform) {}

  ngOnInit() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
    // Check if already installed
    if (this.isRunningStandalone()) {
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.installPromptAvailable = true;
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA được cài đặt thành công');
      this.deferredPrompt = null;
      this.installPromptAvailable = false;
    });

    // Fallback: Check if prompt should be available after a delay
    setTimeout(() => {
      if (!this.installPromptAvailable && !this.isRunningStandalone()) {
        this.installPromptAvailable = true;
      }
    }, 1000);
  }

  shouldShowInstallPrompt(): boolean {
    return !this.isRunningStandalone() && this.installPromptAvailable;
  }

  canInstall(): boolean {
    return this.deferredPrompt !== null || !this.isRunningStandalone();
  }

  isRunningStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  async installApp() {
    if (this.deferredPrompt) {
      // Use native install prompt
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }

      this.deferredPrompt = null;
      this.installPromptAvailable = false;
    } else {
      // Fallback: Show manual installation instructions
      this.showManualInstallInstructions();
    }
  }



    private showManualInstallInstructions() {
      let message = 'Để cài đặt ứng dụng:\n';

      if (this.platform.is('ios')) {
        message += '1. Nhấn vào nút Share (chia sẻ)\n2. Chọn "Add to Home Screen"';
      } else if (this.platform.is('android')) {
        message += '1. Nhấn vào menu trình duyệt (3 chấm)\n2. Chọn "Add to Home screen" hoặc "Install app"';
      } else {
        message += '1. Nhấn vào menu trình duyệt\n2. Chọn "Install" hoặc "Add to Home screen"';
      }

      alert(message);
    }

}
