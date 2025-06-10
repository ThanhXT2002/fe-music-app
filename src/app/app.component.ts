import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { PWAService } from './services/pwa.service';
import { ThemeService } from 'src/app/services/theme.service';
import { IonApp, IonRouterOutlet } from "@ionic/angular/standalone";
import { Platform } from '@ionic/angular';
import { SafeAreaService } from './services/safe-area.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { DatabaseService } from './services/database.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonRouterOutlet, IonApp, CommonModule, FormsModule],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private pwaService: PWAService,
    private themeService: ThemeService,
    private safeAreaService: SafeAreaService,
    private platform: Platform,
    private dbService: DatabaseService
  ) {}


  ngOnInit() {
    this.initializeApp();
    // Khởi tạo PWA service
    this.pwaService.onNetworkStatusChange();

    // Kiểm tra updates định kỳ (mỗi 30 phút)
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  async initializeApp() {
    await this.platform.ready();

    // Khởi tạo database ngay sau khi platform ready
    try {
      console.log('🗄️ Initializing database...');
      await this.dbService.initializeDatabase();
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
    }

    if (Capacitor.isNativePlatform()) {
      console.log('🚀 Native platform detected, setting up...');

      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00000000' });

      console.log('✅ StatusBar configured');

      // No need to manage splash screen here anymore - SplashActivity handles it
    }
    this.safeAreaService.applyToContent();
  }


}
