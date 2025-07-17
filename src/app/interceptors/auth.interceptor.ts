import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { inject, Injector } from '@angular/core';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  // Lấy AuthService khi thực sự cần, tránh vòng lặp DI
  const authService = injector.get(AuthService);
  return from(authService.getIdToken()).pipe(
    switchMap(token => {
      if (token) {
        const cloned = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(cloned);
      }
      return next(req);
    })
  );
};
