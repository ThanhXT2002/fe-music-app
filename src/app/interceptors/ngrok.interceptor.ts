import { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  let modifiedReq = req;

  if (req.url.includes('ngrok-free.app') || req.url.includes('ngrok.io')) {
    console.log('🌐 Ngrok request detected:', req.url);

    modifiedReq = req.clone({
      setHeaders: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'IonicApp/1.0'
      }
    });

    console.log('✅ Added ngrok headers');
  }

  return next(modifiedReq).pipe(
    tap({
      next: (response) => {
        if (req.url.includes('ngrok')) {
          console.log('📥 Ngrok response:', response);
        }
      },
      error: (error) => {
        if (req.url.includes('ngrok')) {
          console.error('❌ Ngrok error:', error);
        }
      }
    })
  );
};
