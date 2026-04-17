import { Injectable } from '@angular/core';

/**
 * ThemeService — Nhỏ gọn nhúng DOM can thiệp Meta Color trình duyệt.
 * Dùng để gán ngầm đổi màu đường viền Status Bar Chrome/Safari mobile theo màu Web Dark Mode.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor() {
    // Đổ tông nền đen sâu tệp theme color mặc định khi App bung khung Header ban đầu
    this.setHeaderThemeColor('#000000');
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Thám hiểm móc thẻ Meta HTML đầu rễ Document và đâm xuyên Hex Code Color mới vào Tag.
   */
  public setHeaderThemeColor(color: string) {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', color);
    }
  }
}
