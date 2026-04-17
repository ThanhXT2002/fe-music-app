import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { inject, Injector } from '@angular/core';
import { from, switchMap } from 'rxjs';

/**
 * Interceptor tự động đính kèm Token xác thực vào Header của mọi request gửi đi.
 *
 * Chức năng:
 * - Đánh chặn luồng HTTP Request để gắn `Bearer Token`.
 * - Hỗ trợ bảo mật các lệnh gọi Restful API yêu cầu quyền (Auth).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  
  // HACK: Gọi lấy instance của AuthService động thông qua Injector bên trong function thân.
  // Lý do: Nếu inject trực tiếp ở tham số định nghĩa sẽ gây ra lỗi gãy DI do vòng rễ gọi nhau liên lặp.
  const authService = injector.get(AuthService);
  
  return from(authService.getIdToken()).pipe(
    switchMap(token => {
      if (token) {
        // Bắt buộc clone tạo bản nhúng mới (Do tính chất Immutable không thể đổi của object Request gốc)
        const cloned = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(cloned);
      }
      return next(req);
    })
  );
};
