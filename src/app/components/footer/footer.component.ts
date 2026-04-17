import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

/**
 * Component hiển thị thông tin bản quyền và liên kết ở chân trang (Footer).
 *
 * Chức năng:
 * - Hiển thị footer tĩnh đối với người dùng truy cập bằng Web tĩnh thuần tuý.
 * - Ẩn hoàn toàn Footer nếu ứng dụng đang chạy dưới dạng App Native hoặc PWA (Mobile), 
 *   để tối ưu không gian vốn dĩ rất chật chội của các màn hình điện thoại.
 */
@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class FooterComponent implements OnInit {
  /** 
   * Cờ kiểm soát việc hiển thị khối HTML footer. 
   * Mặc định là true, sẽ tắt đi nếu phát hiện Native/PWA. 
   */
  isShowingFooter: boolean = true;

  constructor(private platform: Platform) {
    if (Capacitor.isNativePlatform() || this.platform.is('pwa')) {
      this.isShowingFooter = false;
    }
  }

  ngOnInit() {}
}
