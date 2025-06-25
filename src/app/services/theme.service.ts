import { Injectable, signal, computed, effect } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private _isDarkMode = signal<boolean>(true);

  // Public readonly signals
  public readonly isDarkMode = computed(() => this._isDarkMode());

  // Effect để apply theme ngay khi khởi tạo service
  private themeEffect = effect(() => {
    this.applyTheme(this.isDarkMode());
  });

  constructor() {
    this.loadPreferences();
  }
  private loadPreferences() {
    try {
      const saved = localStorage.getItem('dark-mode');
      if (saved) {
        const isDarkMode = JSON.parse(saved) as boolean;
        this._isDarkMode.set(isDarkMode);
      } else {
        // Check system preference for initial dark mode
        const prefersDark =
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        this._isDarkMode.set(prefersDark);
      }
    } catch (error) {
      console.warn('Failed to load dark mode preference:', error);
    }
  }

  private savePreferences() {
    try {
      localStorage.setItem('dark-mode', JSON.stringify(this._isDarkMode()));
    } catch (error) {
      console.warn('Failed to save dark mode preference:', error);
    }
  }

  private applyTheme(isDark: boolean) {
    const htmlElement = document.documentElement;
    if (isDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    this.updateHeaderThemeColor(isDark);
  }
  public toggleDarkMode() {
    const current = this._isDarkMode();
    this.setDarkMode(!current);
  }

  public setDarkMode(enabled: boolean) {
    this._isDarkMode.set(enabled);
    this.savePreferences();
  }

  public resetToDefaults() {
    this._isDarkMode.set(true);
    this.savePreferences();
  }

  //header theme color
  public updateHeaderThemeColor(isDark: boolean) {
    const themeColor = isDark ? '#1f2937' : '#ffffff';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeColor);
    }
  }

  // Thêm method public để các page khác có thể set màu riêng
  public setPageHeaderThemeColor(color: string) {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', color);
    }
  }
}
