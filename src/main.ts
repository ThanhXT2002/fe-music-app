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
import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { ThemeService } from './app/services/theme.service';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { SafeAreaService } from './app/services/safe-area.service';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';
import { register as registerSwiperElements } from 'swiper/element/bundle';


if (environment.production) {
  // Tắt toàn bộ log/error/warn/info khi production
  window.console.log = () => {};
  window.console.error = () => {};
  window.console.warn = () => {};
  window.console.info = () => {};
}

registerSwiperElements()
bootstrapApplication(AppComponent, {

  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideAnimations(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    importProvidersFrom(BrowserAnimationsModule),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    ThemeService,
    SafeAreaService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideLottieOptions({
      player: () => player,
    })
  ],
}).catch((error) => {
  console.error('Error initializing app:', error);
});
