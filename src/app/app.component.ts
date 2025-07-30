import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PWAService } from './services/pwa.service';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './services/database.service';
import { PermissionService } from './services/permission.service';
import { LoadingComponent } from './components/loading/loading.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HealthCheckService } from './services/api/health-check.service';
import { PWAInstallationModalComponent } from "./components/pwa-installation-modal/pwa-installation-modal.component";
import { Title } from '@angular/platform-browser';
import { CustomTitleService } from './services/custom-title.service';
import { filter, map, Subject, takeUntil, tap } from 'rxjs';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    IonRouterOutlet,
    IonApp,
    CommonModule,
    LoadingComponent,
    FormsModule,
    PWAInstallationModalComponent
],
  standalone: true,
})
export class AppComponent implements OnInit {
  private healthCheckService = inject(HealthCheckService);

  constructor(
    private pwaService: PWAService,
    private platform: Platform,
    private dbService: DatabaseService,
    private permissionService: PermissionService,
    private router: Router,
    private titleService: Title,
    private customTitleService: CustomTitleService
  ) {
    this.actionHealthCheck();
  }

  ngOnInit() {
    this.initializeApp();
    this.pwaService.onNetworkStatusChange();

    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

    this.customTitleService.title$.subscribe(title => {
    if (title) {
      this.titleService.setTitle(title);
    }
  });


    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.getDeepestRoute(this.router.routerState.root)),
      tap(route => {
        const title = route.snapshot.data['title'];
        if (title) {
          this.customTitleService.setTitle(`${title} - XTMusic`);
        }
      })
    ).subscribe();
  }

  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
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

  actionHealthCheck() {
    if (!this.healthCheckService.isHealthy() || !navigator.onLine) {
      this.router.navigate(['/list']);
    }
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
