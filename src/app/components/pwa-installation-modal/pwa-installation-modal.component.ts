import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';

/**
 * Component trình chiếu Tờ Banner Thông Báo Khuyên dùng PWA lúc vừa truy cập Web.
 *
 * Chức năng:
 * - Thông báo thủ công thay vì Prompt cứng nếu Hệ điều hành Mobile Browser ngăn cản code Install Popup.
 * - Lưu cờ Remember Choice lên LocalStorage tránh Spam người dùng khó chịu.
 */
@Component({
  selector: 'app-pwa-installation-modal',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './pwa-installation-modal.component.html',
  styleUrls: ['./pwa-installation-modal.component.scss'],
})
export class PWAInstallationModalComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Injection Dependencies
  // ─────────────────────────────────────────────────────────
  private platform = inject(Platform);
  private router = inject(Router);

  // ─────────────────────────────────────────────────────────
  // Variables 
  // ─────────────────────────────────────────────────────────
  /** Cờ Toggle tắt mở Banner vật lý Component */
  hideMobileNotice: boolean = false;
  
  /** Cờ trạng thái ngầm gắn checkmark checkbox "Đừng nhắc tôi" */
  dontShowMobileNotice: boolean = false;
  
  /** Tra khảo định tính App Build Capacitor */
  isNative = Capacitor.isNativePlatform();
  
  /** Tra khảo Desktop View (Sẽ bỏ qua cảnh báo PWA điện thoại) */
  isDesktop = this.platform.is('desktop');

  // ─────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────
  ngOnInit() {
    this.dontShowMobileNotice = !!localStorage.getItem('hideMobileNotice');
    // Nếu User đã tick Không show lần trc thì ngay lập tức dấu diễm nó từ nhịp OnInit
    this.hideMobileNotice = this.dontShowMobileNotice;
  }

  // ─────────────────────────────────────────────────────────
  // Interaction Logic
  // ─────────────────────────────────────────────────────────
  /**
   * Nắng nghe Tích Checkbox để ghi xuống bộ nhớ Offline LocalStorage Web Base.
   */
  onDontShowAgainChange() {
    if (this.dontShowMobileNotice) {
      localStorage.setItem('hideMobileNotice', '1');
    } else {
      localStorage.removeItem('hideMobileNotice');
    }
  }

  /** 
   * Giao tiếp sang điều hướng Router Route Link trang /pwa-guide.
   */
  goToGuide() {
    this.hideMobileNotice = true;
    this.router.navigate(['/pwa-guide']);
  }
}
