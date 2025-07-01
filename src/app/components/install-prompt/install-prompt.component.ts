import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { InstallService } from '../../services/install.service';

@Component({
  selector: 'app-install-prompt',
  template: `
    <div class="liquid-glass-panel" *ngIf="shouldShowInstallPrompt()">
      <div class="liquid-glass-bg">
        <div class="liquid-glass-blur"></div>
        <div class="liquid-glass-highlight"></div>
      </div>
      <div class="liquid-glass-header">
        <h2 class="liquid-glass-title">Appearance</h2>
      </div>

      <div class="liquid-glass-content">
        <div class="liquid-glass-row-between ">
        <div>
          <h3 class="liquid-glass-subtitle">Cài đặt</h3>
          <p class="liquid-glass-description-strong">
            Cài đặt app để có trải nghiệm tốt nhất với XTMusic.
          </p>
        </div>
        <button
          class="text-white p-3 bg-purple-600 rounded-full hover:bg-indigo-400 flex justify-center items-center"
          (click)="installApp()"
        >
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
      </div>
    </div>
  `,
  imports: [CommonModule, IonicModule],
  standalone: true,
})
export class InstallPromptComponent implements OnInit {
  private showPrompt = false;

  constructor(
    private platform: Platform,
    private installService: InstallService
  ) {}

  ngOnInit() {
    // Không hiển thị ngay nữa, chờ service xác nhận
    // if (!this.installService.isRunningStandalone()) {
    //   this.showPrompt = true;
    // }

    // Kiểm tra định kỳ xem đã có thể install chưa
    this.checkInstallAvailability();
  }

  private checkInstallAvailability() {
    const checkInterval = setInterval(() => {
      if (
        this.installService.canInstall() &&
        !this.installService.isRunningStandalone()
      ) {
        this.showPrompt = true;
        clearInterval(checkInterval);
      }
    }, 500);

    // Dừng check sau 30 giây
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 30000);
  }

  shouldShowInstallPrompt(): boolean {
    // Chỉ hiển thị khi service xác nhận có thể install
    return (
      this.showPrompt &&
      this.installService.canInstall() &&
      !this.installService.isRunningStandalone()
    );
  }

  async installApp() {
    const result = await this.installService.install();
    if (result === 'accepted') {
      this.showPrompt = false;
    } else if (result === 'dismissed') {
      // Không ẩn button, để user có thể thử lại
    } else {
      this.showManualInstallInstructions();
    }
  }

  dismissPrompt() {
    this.showPrompt = false;
  }

  private showManualInstallInstructions() {
    let message = 'Để cài đặt ứng dụng:\n';

    if (this.platform.is('ios')) {
      message +=
        '1. Nhấn vào nút Share (chia sẻ)\n2. Chọn "Add to Home Screen"';
    } else if (this.platform.is('android')) {
      message +=
        '1. Nhấn vào menu trình duyệt (3 chấm)\n2. Chọn "Add to Home screen" hoặc "Install app"';
    } else {
      message +=
        '1. Nhấn vào menu trình duyệt\n2. Chọn "Install" hoặc "Add to Home screen"';
    }

    alert(message);
  }
}
