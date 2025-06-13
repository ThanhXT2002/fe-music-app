import { Injectable, signal, computed, effect } from '@angular/core';

export interface ThemePreferences {
  darkMode: boolean;
  autoPlay: boolean;
  shuffleMode: boolean;
  repeatMode: 'none' | 'one' | 'all';
  downloadQuality: 'high' | 'medium' | 'low';
  notifications: boolean;
  backgroundPlay: boolean;
  storageLocation: string;
  cacheSize: number; // in MB
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private _preferences = signal<ThemePreferences>({
    darkMode: false,
    autoPlay: true,
    shuffleMode: false,
    repeatMode: 'none',
    downloadQuality: 'high',
    notifications: true,
    backgroundPlay: true,
    storageLocation: '/storage/music',
    cacheSize: 500,
  });

  // Public readonly signals
  public readonly preferences = this._preferences.asReadonly();
  public readonly isDarkMode = computed(() => this._preferences().darkMode);

  // Effect để apply theme ngay khi khởi tạo service
  private themeEffect = effect(() => {
    this.applyTheme(this.isDarkMode());
  });

  constructor() {
    this.loadPreferences();
  }

  private loadPreferences() {
    try {
      const saved = localStorage.getItem('theme-preferences');
      if (saved) {
        const preferences = JSON.parse(saved) as ThemePreferences;
        this._preferences.set(preferences);
      } else {
        // Check system preference for initial dark mode
        const prefersDark =
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          this.updatePreferences({ darkMode: true });
        }
      }
    } catch (error) {
      console.warn('Failed to load theme preferences:', error);
    }
  }

  private savePreferences() {
    try {
      localStorage.setItem(
        'theme-preferences',
        JSON.stringify(this._preferences())
      );
    } catch (error) {
      console.warn('Failed to save theme preferences:', error);
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

  public updatePreferences(updates: Partial<ThemePreferences>) {
    const current = this._preferences();
    const updated = { ...current, ...updates };
    this._preferences.set(updated);
    this.savePreferences();
  }

  public toggleDarkMode() {
    const current = this._preferences();
    this.updatePreferences({ darkMode: !current.darkMode });
  }

  public setDarkMode(enabled: boolean) {
    this.updatePreferences({ darkMode: enabled });
  }

  public resetToDefaults() {
    this._preferences.set({
      darkMode: false,
      autoPlay: true,
      shuffleMode: false,
      repeatMode: 'none',
      downloadQuality: 'high',
      notifications: true,
      backgroundPlay: true,
      storageLocation: '/storage/music',
      cacheSize: 500,
    });
    this.savePreferences();
  }

  //header theme color
  public updateHeaderThemeColor(isDark: boolean) {
    const themeColor = isDark ? '#1f2937' : '#ffffff'; // Hoặc màu bạn muốn
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
