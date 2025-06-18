import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { DatabaseService } from './services/database.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit {

  constructor(
    private platform: Platform,
    private databaseService: DatabaseService
  ) {}

  async ngOnInit() {
    await this.platform.ready();
    await this.initializeApp();
  }

  private async initializeApp() {
    try {
      await this.databaseService.initializeDatabase();

      if (this.platform.is('capacitor')) {
        await StatusBar.setStyle({ style: Style.Default });
        await SplashScreen.hide();
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }
}
