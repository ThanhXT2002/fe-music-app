import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

/**
 * LoadingService — Lớp dịch vụ quản lý trạng thái hiển thị vòng xoay chờ (Loading Indicator).
 * Sử dụng mô hình truyền dẫn dữ liệu Signal mới của Angular 16+ thay vì BehaviorSubject.
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Node chứa trạng thái Reactive Boolean xác nhận có đang rớt vào phiên chờ luồng tải dữ liệu hay không */
  private readonly _loading = signal<boolean>(false);

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Kích hoạt buộc hiển thị Spinner vòng xoay.
   */
  show() {
    this._loading.set(true);
  }

  /**
   * Giải phóng, tắt chế độ chờ tải.
   */
  hide() {
    this._loading.set(false);
  }

  /**
   * Đảo nghịch logic hiển thị Spinner.
   */
  toggle() {
    this._loading.set(!this._loading());
  }

  /**
   * Lấy giá trị chuỗi tín hiệu dạng Signal Hook.
   * Phù hợp để binding thẳng vào template HTML (không cần xài pipe async).
   */
  loading() {
    return this._loading();
  }

  /**
   * Lấy giá trị thời gian thực tĩnh thông thường (Imperative Pull).
   */
  isLoading(): boolean {
    return this._loading();
  }
}
