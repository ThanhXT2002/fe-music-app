import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * UiStateService — Dịch vụ cung ứng phân tích Context (Văn cảnh) của view trang đích và lưu cache Trạng thái tiêu đề động.
 */
@Injectable({
  providedIn: 'root',
})
export class UiStateService {
  // ─────────────────────────────────────────────────────────
  // STATE & SIGNALS — ĐỊNH TUYẾN
  // ─────────────────────────────────────────────────────────
  
  /** Biến cờ Signal phản quang tên mã Page (Router Url Code) hiện tại trình duyệt đang hiển thị chiếu vô. */
  private currentPage = signal<string | null>(null);
  
  /** Trỏ tín hiệu page name lên Store Component */
  setCurrentPage(page: string) {
    this.currentPage.set(page);
  }

  /** Truy suất Node nhận dạng Page */
  getCurrentPage() {
    return this.currentPage;
  }

  // ─────────────────────────────────────────────────────────
  // SUBJECTS — TIÊU ĐỀ TITLE APP HEADER
  // ─────────────────────────────────────────────────────────
  
  /** Luồng dây chuyền phát Event động (Observable Stream) thay đổi cập nhật cắm vào chữ Header Top Navbar */
  private titleSubject = new BehaviorSubject<string>('');
  title$ = this.titleSubject.asObservable();

  /** Ném text tiêu đề mới cho tất cả subcriber Header trên Header Component */
  setTitle(title: string) {
    this.titleSubject.next(title);
  }
}
