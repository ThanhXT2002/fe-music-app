import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PWAService } from './services/pwa.service';
import {
  IonApp,
  IonRouterOutlet,
  IonModal,
  IonContent,
} from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { SafeAreaService } from './services/safe-area.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './services/database.service';
import { PermissionService } from './services/permission.service';
import { AudioPlayerService } from './services/audio-player.service';
import { getRedirectResult } from '@angular/fire/auth';
import { AuthService } from './services/auth.service';
import { LoadingComponent } from "./components/loading/loading.component";
import { PwaGuidePage } from "./pages/pwa-guide/pwa-guide.page";
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonRouterOutlet, IonApp, CommonModule, LoadingComponent,FormsModule],
  standalone: true,
})
export class AppComponent implements OnInit {
  private audioPlayerService = inject(AudioPlayerService);
  currentSong = this.audioPlayerService.currentSong;

  isNative = Capacitor.isNativePlatform();
  isDesktop = this.platform.is('desktop');

  // Biến trạng thái modal
hideMobileNotice: boolean = false;
dontShowMobileNotice: boolean = false;

  constructor(
    private pwaService: PWAService,
    private safeAreaService: SafeAreaService,
    private platform: Platform,
    private dbService: DatabaseService,
    private permissionService: PermissionService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log(this.isDesktop);
    this.initializeApp();
    this.pwaService.onNetworkStatusChange();

    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

    this.dontShowMobileNotice = !!localStorage.getItem('hideMobileNotice');
  this.hideMobileNotice = this.dontShowMobileNotice;
  }

  async initializeApp() {
    await this.platform.ready();
    await this.initializeDatabaseWithRetry();

    if (Capacitor.isNativePlatform()) {
      await this.requestNativePermissions();
      // Enable full screen mode - overlay web view and transparent status bar
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }
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


  onImageError(event: any): void {
    event.target.src = '/assets/images/img-body.webp';
  }

  private async requestNativePermissions(): Promise<void> {
    try {
      const success = await this.permissionService.requestAllPermissions();
      if (!success) {
        console.warn(
          '⚠️ Some permissions were denied - app may have limited functionality'
        );
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  }

  private async initializeDatabaseWithRetry(
    maxRetries: number = 3
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.dbService.initializeDatabase();
        return;
      } catch (error) {
        console.error(
          `❌ Database initialization attempt ${i + 1} failed:`,
          error
        );

        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, (i + 1) * 1000));
        } else {
          console.error('❌ All database initialization attempts failed');
        }
      }
    }
  }
}
