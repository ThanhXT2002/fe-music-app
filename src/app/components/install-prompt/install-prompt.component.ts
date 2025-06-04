import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { InstallService } from '../../services/install.service';

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
  private showPrompt = false;

  constructor(private platform: Platform, private installService: InstallService) {}

  ngOnInit() {
    // Hiển thị prompt nếu không phải standalone mode
    if (!this.installService.isRunningStandalone()) {
      this.showPrompt = true;
    }
  }

  shouldShowInstallPrompt(): boolean {
    return this.showPrompt && !this.installService.isRunningStandalone();
  }

  async installApp() {
    const result = await this.installService.install();

    if (result === 'accepted') {
      console.log('User accepted the install prompt');
      this.showPrompt = false;
    } else if (result === 'dismissed') {
      console.log('User dismissed the install prompt');
      // Không ẩn button, để user có thể thử lại
      // this.dismissPrompt();
    } else {
      // not-available - hiển thị hướng dẫn manual
      this.showManualInstallInstructions();
    }
  }

  dismissPrompt() {
    this.showPrompt = false;
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
