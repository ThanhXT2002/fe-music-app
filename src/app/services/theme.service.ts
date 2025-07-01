import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  constructor() {
    // Đặt theme color mặc định cho header
    this.setHeaderThemeColor('#000000');
  }

  // Method để set màu theme cho header
  public setHeaderThemeColor(color: string) {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', color);
    }
  }
}
