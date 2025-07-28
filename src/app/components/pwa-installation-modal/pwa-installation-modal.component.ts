import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';


@Component({
  selector: 'app-pwa-installation-modal',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './pwa-installation-modal.component.html',
  styleUrls: ['./pwa-installation-modal.component.scss'],
})
export class PWAInstallationModalComponent implements OnInit {
  private platform = inject(Platform);
  private router = inject(Router);

  // Biến trạng thái modal
  hideMobileNotice: boolean = false;
  dontShowMobileNotice: boolean = false;
  isNative = Capacitor.isNativePlatform();
  isDesktop = this.platform.is('desktop');

  ngOnInit() {
    this.dontShowMobileNotice = !!localStorage.getItem('hideMobileNotice');
    this.hideMobileNotice = this.dontShowMobileNotice;
  }

    onDontShowAgainChange() {
    if (this.dontShowMobileNotice) {
      localStorage.setItem('hideMobileNotice', '1');
    } else {
      localStorage.removeItem('hideMobileNotice');
    }
  }

    // Khi nhấn "Xem hướng dẫn cài đặt"
  goToGuide() {
    this.hideMobileNotice = true;
    this.router.navigate(['/pwa-guide']);
  }
}
