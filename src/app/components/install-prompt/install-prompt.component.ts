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
                (click)="installApp()">
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
  private showPrompt = false;
  private promptDismissed = false;

  constructor(private platform: Platform) {}

  ngOnInit() {
    // Hiển thị ngay lập tức nếu không phải standalone mode
    if (!this.isRunningStandalone() && !this.isDismissedRecently()) {
      this.showPrompt = true;
    }

    this.setupInstallPrompt();
  }

  private setupInstallPrompt() {
    // Skip nếu đã ở trong app
    if (this.isRunningStandalone()) {
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt event triggered');
      e.preventDefault();
      this.deferredPrompt = e;

      // Có native prompt, hiển thị ngay
      if (!this.isDismissedRecently()) {
        this.showPrompt = true;
      }
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA được cài đặt thành công');
      this.deferredPrompt = null;
      this.showPrompt = false;
    });
  }

  shouldShowInstallPrompt(): boolean {
    return this.showPrompt && !this.isRunningStandalone();
  }

  isRunningStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  async installApp() {
    if (this.deferredPrompt) {
      // Native install prompt
      try {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
          this.dismissPrompt();
        }

        this.deferredPrompt = null;
      } catch (error) {
        console.error('Install prompt error:', error);
        this.showManualInstallInstructions();
      }
    } else {
      // Fallback: Manual instructions
      this.showManualInstallInstructions();
    }
  }

  dismissPrompt() {
    this.showPrompt = false;
    this.promptDismissed = true;

    // Don't show again for 24 hours
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  }

  private isDismissedRecently(): boolean {
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (!dismissed) return false;

    const dismissedTime = parseInt(dismissed, 10);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return dismissedTime > oneDayAgo;
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
