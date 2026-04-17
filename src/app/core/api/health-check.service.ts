import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

/** Cấu trúc dữ liệu trả về khi kiểm tra sức khỏe của server API */
export interface HealthCheckResponse {
  success: boolean;
  message: string;
  version: string;
}

/**
 * Service kiểm tra trạng thái hoạt động (health check) của backend API.
 *
 * Chức năng:
 * - Ping server backend để lấy trạng thái và phiên bản
 * - Lưu trữ trạng thái vào signal `isHealthy` để toàn bộ ứng dụng có thể theo dõi realtime
 */
@Injectable({
  providedIn: 'root',
})
export class HealthCheckService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Endpoint gọi kiểm tra health của API */
  apiUrl = environment.apiUrl + '/health';
  
  /** Signal báo cáo trạng thái backend hiện tại, true nếu API hoạt động bình thường */
  isHealthy = signal<boolean>(true);

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor(private http: HttpClient) {
    this.refreshHealth();
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Yêu cầu kiểm tra lại trạng thái health của server và cập nhật vào signal `isHealthy`.
   */
  refreshHealth(): void {
    this.checkHealth().subscribe({
      next: (response) => this.isHealthy.set(response.success),
      error: () => this.isHealthy.set(false),
    });
  }

  /**
   * Gọi API GET tới endpoint health của backend.
   *
   * @returns Observable chứa trạng thái và phiên bản backend
   */
  checkHealth(): Observable<HealthCheckResponse> {
    return this.http.get<HealthCheckResponse>(this.apiUrl);
  }
}
