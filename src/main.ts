import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { ThemeService } from './app/services/theme.service';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { SafeAreaService } from './app/services/safe-area.service';
import { DebugService } from './app/services/debug.service';
import { APP_INITIALIZER } from '@angular/core';
import { Capacitor } from '@capacitor/core';


function initializeDebug(debugService: DebugService) {
  return () => {
    debugService.initEruda();
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    importProvidersFrom(BrowserAnimationsModule),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    ThemeService,
    SafeAreaService,
    ...(Capacitor.isNativePlatform() ? [{
      provide: APP_INITIALIZER,
      useFactory: initializeDebug,
      deps: [DebugService],
      multi: true
    }] : []),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((error) => {
  console.error('Error initializing app:', error);

});
