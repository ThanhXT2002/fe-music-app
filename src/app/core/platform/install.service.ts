import { Injectable } from '@angular/core';

/**
 * InstallService — Can thiệp kích hoạt bảng Popup Add To Homescreen (Install PWA A2HS).
 * Dùng Event `beforeinstallprompt` từ DOM Browser sinh ra để bắt chước Native Mobile App Download.
 */
@Injectable({
  providedIn: 'root'
})
export class InstallService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Găm lưu trữ đối tượng Popup Prompt Event trễ, để đợi User bấm nút mới cho hiển thị thay vì tự nổ pop */
  private deferredPrompt: any = null;
  private isPromptReady = false;
  private eventListenerAdded = false;

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor() {
    // Ép đời luồng Event Loop DOM chầm chậm chạy hết mới Load cài cắm
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupInstallPrompt();
      });
    } else {
      this.setupInstallPrompt();
    }
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────

  /**
   * Đan rẽ nhánh Listener nhạy với sự kiện `beforeinstallprompt` chóp Web PWA
   */
  private setupInstallPrompt() {
    if (this.eventListenerAdded) return;

    this.addUserEngagementListeners();

    window.addEventListener('beforeinstallprompt', (e) => {
      // HACK: Bắt buộc đè PreventDefault để chặn trình duyệt hiện Bảng A2HS Pop mặc định quá hỗn tạp
      e.preventDefault();
      this.deferredPrompt = e;
      this.isPromptReady = true;
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isPromptReady = false;
    });

    this.eventListenerAdded = true;
  }

  /**
   * Tạo thủ thuật Heuristic theo dõi mức độ gắn kết User với Website.
   * Để rò Popup Prompt tinh tế khi User có nhu cầu dùng App nhiều (Tương tác trên 3 lần bấm) 
   */
  private addUserEngagementListeners() {
    const events = ['click', 'scroll', 'keydown', 'touchstart'];
    let interactionCount = 0;

    const handleInteraction = () => {
      interactionCount++;
      // Vượt ngưỡng 3 thao tác tương tác => Tạo độ trễ Trigger móc nhử (Fake delay hook)
      if (interactionCount >= 3 && !this.deferredPrompt) {
        setTimeout(() => {
           // Giữ luồng chờ DOM móc object (hiện rỗng)
        }, 1000);
      }

      // Khi đạt giới hạn 5 interactions thì gỡ Event Listener tiết kiệm RAM (Garbage Cleanup)
      if (interactionCount >= 5) {
        events.forEach(event => {
          document.removeEventListener(event, handleInteraction);
        });
      }
    };

    // Đính chốt nghe ngóng thao tác
    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true });
    });
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /** Validate nếu mỏ neo nổ Popup cài đặt PWA sẵn sàng hay chưa */
  canInstall(): boolean {
    return this.isPromptReady && this.deferredPrompt !== null;
  }

  /**
   * Validate nếu đang kẹt trong màn hình App Standalone Desktop đập bóng (Xoá viền trình duyệt).
   * Chặn lặp nổ cài đặt nếu đã ở chế độ Native Standalone Web.
   */
  isRunningStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  /**
   * Kính tráp kích nổ màn hình Cài Đặt (A2HS Browser API Prompts User).
   */
  async install(): Promise<'accepted' | 'dismissed' | 'not-available'> {
    if (!this.deferredPrompt) {
      return 'not-available';
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.isPromptReady = false;
      return outcome;
    } catch (error) {
      console.error('Crash đứt kết nối nổ Prompt Install A2HS:', error);
      return 'not-available';
    }
  }
}
