import { Injectable } from '@angular/core';

/**
 * LocalStorageService — Trạm gác cửa Wrapper kết nối an toàn với Window DOM `localStorage`.
 * Ngăn ngừa cảnh lỗi sập RAM khi xài Key cứng (Typo Error), gom cục tất cả Key ở một mảng tĩnh để dễ Re-factor.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageService {

  // ─────────────────────────────────────────────────────────
  // System Registry Cấu Hình Local Storage Keys (Bộ Nhớ Nhỏ)
  // ─────────────────────────────────────────────────────────

  /**
   * Tổng kho Key Tên Cặp Cấu Hình (Registry Typed).
   * Dùng tính năng khóa mảng `as const` của TypeScript để fix cứng Literal Enum không cho Typo sai chính tả khi gọi.
   */
  private readonly KEYS = {
    YT_TRACKS: 'yt-tracks',
    YT_PLAYLIST_ID: 'yt-playlistId',
    YT_RELATED: 'yt-related',
    BACK_SEARCH: 'back-search',
    APP_THEME: 'app-theme',
    PLAYBACK_STATE: 'playback-state',
  } as const;

  // ─────────────────────────────────────────────────────────
  // Thao Tác Thống Kê Type Safe
  // ─────────────────────────────────────────────────────────

  /**
   * Rẽ JSON và Nhả dữ liệu. 
   * Trả về Null nếu Storage trống hoảng hoặc Json bị Crash Decode gãy lỗi Parsing đứt vỡ.
   * 
   * @param key Cờ rào chắn khóa key nằm trong Enum KEYS định sẵn ở root root
   */
  get<T>(key: keyof typeof this.KEYS): T | null {
    try {
      const raw = localStorage.getItem(this.KEYS[key]);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null; // Im lặng bỏ qua dẫy lỗi Parse rác
    }
  }

  /**
   * Set ép gói mảng Object/Mảng xuống JSON đẩy vào thẻ ổ đĩa Memory Cấp 2 của Browser.
   * Nếu đổ vô Null/Undefined tự động móc ngắt Remove Key xóa rác đĩa C.
   */
  set<T>(key: keyof typeof this.KEYS, value: T): void {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(this.KEYS[key]);
      } else {
        localStorage.setItem(this.KEYS[key], JSON.stringify(value));
      }
    } catch (e) {
      console.warn(`LocalStorageService: Đẩy lưu mảng Local Save với key "${key}" thất chốt!`, e);
    }
  }

  /**
   * Dập tắt Remove chỉ đích danh 1 cờ.
   */
  remove(key: keyof typeof this.KEYS): void {
    try {
      localStorage.removeItem(this.KEYS[key]);
    } catch {
      // HACK: Nuốt gãy ngoại lệ, im re chặn Throw log bẩn terminal
    }
  }

  /**
   * Kiểm tra nhanh cờ trạng thái sự tồn tại Data trong khay bộ đệm.
   */
  has(key: keyof typeof this.KEYS): boolean {
    return localStorage.getItem(this.KEYS[key]) !== null;
  }
}
