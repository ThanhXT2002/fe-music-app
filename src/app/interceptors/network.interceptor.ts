import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { retry, timeout, catchError, throwError } from 'rxjs';
import { YouTubeErrorService } from '../services/youtube-error.service';
import { Capacitor } from '@capacitor/core';

export const networkInterceptor: HttpInterceptorFn = (req, next) => {
  const youtubeErrorService = inject(YouTubeErrorService);
  // Chỉ áp dụng cho API calls
  if (req.url.includes('api-music.tranxuanthanhtxt.com')) {
    // Platform-specific headers
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
      // Clone request với headers bổ sung cho production
    let headers = req.headers
      .set('Cache-Control', 'no-cache')
      .set('Pragma', 'no-cache')
      .set('Accept', 'application/json, text/plain, */*')
      .set('Content-Type', 'application/json')
      .set('User-Agent', isNative ? `XTMusic/1.0.0 (${platform} Mobile App)` : 'XTMusic/1.0.0 (Web App)')
      .set('X-Platform', platform)
      .set('X-Request-Source', isNative ? 'native-app' : 'web-app');

    // Add native-specific headers
    if (isNative) {
      headers = headers
        .set('Connection', 'keep-alive')
        .set('Keep-Alive', 'timeout=60');
    }

    const enhancedReq = req.clone({
      headers: headers,
      setParams: {
        // Add timestamp to prevent caching issues
        '_t': Date.now().toString(),
        // Platform identifier for server-side optimization
        '_platform': platform
      }
    });return next(enhancedReq).pipe(
      // Set longer timeout for native platforms (60 seconds vs 45 for web)
      timeout(Capacitor.isNativePlatform() ? 60000 : 45000),
      // Retry failed requests up to 3 times with exponential backoff
      retry({
        count: 3,delay: (error, retryCount) => {
          // Retry on network errors, timeouts, and 5xx server errors
          if (error instanceof HttpErrorResponse) {
            if (youtubeErrorService.shouldAutoRetry(error.status)) {
              // Sử dụng delay tùy chỉnh cho từng loại lỗi
              const delay = youtubeErrorService.getRetryDelay(error.status, retryCount);
              console.log(`🔄 Retrying request (attempt ${retryCount}) after ${delay}ms - Status: ${error.status}`);
              return new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          // Don't retry for other errors
          throw error;
        }
      }),      catchError((error: HttpErrorResponse) => {
        // Enhanced error handling for production
        if (error.status === 0) {
          console.error('❌ Network Error (Status 0):', {
            url: req.url,
            message: error.message,
            name: error.name,
            error: error.error
          });

          const enhancedError = new HttpErrorResponse({
            error: error.error,
            headers: error.headers,
            status: 0,
            statusText: 'Network Connection Failed',
            url: error.url || undefined,
          });

          return throwError(() => enhancedError);
        }

        // Handle 504 Gateway Timeout specifically
        if (error.status === 504) {
          console.error('❌ Gateway Timeout (504):', {
            url: req.url,
            message: 'Server processing took too long'
          });

          const timeoutError = new HttpErrorResponse({
            error: error.error,
            headers: error.headers,
            status: 504,
            statusText: 'Server Timeout - YouTube processing took too long',
            url: error.url || undefined,
          });

          return throwError(() => timeoutError);
        }

        // Log other errors
        console.error('❌ HTTP Error:', {
          status: error.status,
          statusText: error.statusText,
          url: req.url,
          message: error.message
        });

        return throwError(() => error);
      })
    );
  }

  // For non-API requests, proceed normally
  return next(req);
};
