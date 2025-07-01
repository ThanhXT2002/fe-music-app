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
import { DebugService } from './app/services/debug.service';
import { APP_INITIALIZER } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';
import { register as registerSwiperElements } from 'swiper/element/bundle';

function initializeFirebaseAuth() {
  return async () => {
    if (Capacitor.isNativePlatform()) {
      // Firebase Authentication sẽ tự động initialize từ google-services.json
      console.log('Firebase Authentication ready from google-services.json');
    }
  };
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
    ...(Capacitor.isNativePlatform()
      ? [
          {
            provide: APP_INITIALIZER,
            useFactory: initializeFirebaseAuth,
            multi: true,
          },
        ]
      : []),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideLottieOptions({
      player: () => player,
    }),

  ],
}).catch((error) => {
  console.error('Error initializing app:', error);
});
