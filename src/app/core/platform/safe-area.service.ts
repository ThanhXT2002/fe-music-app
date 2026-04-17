import { Injectable } from '@angular/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

/**
 * SafeAreaService — Quản lý mốc ranh giới hiển thị Notch (Tai thỏ / Đảo động nốt ruồi) của iOS / Android.
 * Dùng Capacitor thả móc neo kích thước padding đẩy giao diện Content xuống né đè vùng nguy hiểm màn hình.
 */
@Injectable({ providedIn: 'root' })
export class SafeAreaService {

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Trích lục khoảng cách Margin của màn hình thiết bị và nhét dán động vào CSS Custom Variables của khối app Root.
   */
  async applyToContent() {
    const result = await SafeArea.getSafeAreaInsets();
    const content = document.querySelector('ion-app');
    
    // Ghi đè chỉ số Pixel cụ thể đẩy các biên CSS
    if (content) {
      content.style.setProperty('--padding-top', `${result.insets.top}px`);
      content.style.setProperty('--padding-bottom', `${result.insets.bottom}px`);
      content.style.setProperty('--padding-left', `${result.insets.left}px`);
      content.style.setProperty('--padding-right', `${result.insets.right}px`);
    }
  }
}
