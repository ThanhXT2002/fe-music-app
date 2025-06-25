import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PWAService } from './services/pwa.service';
import { IonApp, IonRouterOutlet, IonModal } from "@ionic/angular/standalone";
import { Platform } from '@ionic/angular';
import { SafeAreaService } from './services/safe-area.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './services/database.service';
import { PermissionService } from './services/permission.service';
import { DebugService } from './services/debug.service';
import { ThemeService } from './services/theme.service';
import { CurrentPlaylistComponent } from "./components/current-playlist/current-playlist.component";

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonRouterOutlet, IonApp, CommonModule],
  standalone: true
})
export class AppComponent implements OnInit {
  constructor(
    private pwaService: PWAService,
    private safeAreaService: SafeAreaService,
    private platform: Platform,
    private dbService: DatabaseService,
    private permissionService: PermissionService,
    // private debugService: DebugService,
    public themeService: ThemeService
  ) {
    // this.debugService.initEruda();
  }
  ngOnInit() {
    this.initializeApp();
    this.pwaService.onNetworkStatusChange();

    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);
  }

  async initializeApp() {
    await this.platform.ready();
    await this.initializeDatabaseWithRetry();

    if (Capacitor.isNativePlatform()) {
      await this.requestNativePermissions();
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }

    this.safeAreaService.applyToContent();
  }

  private async requestNativePermissions(): Promise<void> {
    try {
      const success = await this.permissionService.requestAllPermissions();
      if (!success) {
        console.warn('⚠️ Some permissions were denied - app may have limited functionality');
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  }

  private async initializeDatabaseWithRetry(maxRetries: number = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.dbService.initializeDatabase();
        return;
      } catch (error) {
        console.error(`❌ Database initialization attempt ${i + 1} failed:`, error);

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        } else {
          console.error('❌ All database initialization attempts failed');
        }
      }
    }
  }
}
