import { Injectable } from '@angular/core';
import { Clipboard } from '@capacitor/clipboard';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

// ─────────────────────────────────────────────────────────
// Dịch Vụ Bộ Nhớ Tạm Copy/Paste (Clipboard Service)
// ─────────────────────────────────────────────────────────

/**
 * ClipboardService — Lớp trừu tượng (Adapter) để móc ngoặc và điều phối luồng thao tác Copy Text/ Đọc nội dung dán URL.
 * Hỗ trợ Bridge đan xen chạy cả trên Mobile (Capacitor API) và Web Engine Desktop (DOM Navigator API).
 */
@Injectable({
  providedIn: 'root'
})
export class ClipboardService {
  /** Cờ cắm cache xác thực quyền User cấp để tránh chọc hỏi Permission nhiều lần (Chỉ xài cho Web) */
  private hasPermission: boolean | null = null;
  private lastPermissionCheck: number = 0;
  private readonly PERMISSION_CACHE_DURATION = 30000; // Bộ nhớ đệm giữ trạng thái cấp quyền 30s

  constructor(private platform: Platform) {}

  // ─────────────────────────────────────────────────────────
  // Hành Vi Tương Tác Cơ Bản Raw
  // ─────────────────────────────────────────────────────────

  /**
   * Moi ruột Text từ Clipboard lên (Đọc).
   */
  async read(): Promise<string> {
    try {
      // HACK: Phân rẽ nhánh App Native vs App Web PWAs dể gọi đúng hàm quyền Native không crash Web Browser Sandbox
      if (this.platform.is('capacitor')) {
        // Môi trường App Native Android/iOS gắn cứng với Native Plugin
        const result = await Clipboard.read();
        return result.value || '';
      } else {
        // Môi trường Web PWA - Phải né chính sách Permission chặn Read Text DOM DOMException
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }

        if (!navigator.clipboard.readText) {
          throw new Error('Clipboard read not supported');
        }

        // Bọc Request thủng lỗ (Web thì phải có thao tác click từ User mới cho Read, không làm tự động ngầm được)
        try {
          return await navigator.clipboard.readText();
        } catch (error) {
          if (error instanceof DOMException) {
            if (error.name === 'NotAllowedError') {
              throw new Error('PERMISSION_DENIED');
            } else if (error.name === 'NotSupportedError') {
              throw new Error('NOT_SUPPORTED');
            }
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Lỗi khi cào dữ liệu từ RAM Clipboard:', error);

      // Mapper Map lỗi chập chung
      if (error instanceof Error) {
        if (error.message.includes('PERMISSION_DENIED') ||
            error.message.includes('permissions') ||
            error.message.includes('denied')) {
          throw new Error('PERMISSION_DENIED');
        } else if (error.message.includes('not supported') ||
                   error.message.includes('not available') ||
                   error.message.includes('NOT_SUPPORTED')) {
          throw new Error('NOT_SUPPORTED');
        }
      }

      throw new Error('UNKNOWN_ERROR');
    }
  }

  /**
   * Đẩy Text ghi đè vào Khay nhớ tạm (Copy).
   */
  async write(text: string): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        // Đẩy Native
        await Clipboard.write({ string: text });
      } else {
        // Web fallback
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard write not supported');
        }
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error('Lỗi cắm ghi Text vào Clipboard bộ nhớ:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Hành Cấp Phép & Chặn (Authorization Layer)
  // ─────────────────────────────────────────────────────────

  /**
   * Đọc phân dải Cache cấp phép, tránh request prompt spam trên Web Browser.
   */
  async checkPermissions(): Promise<boolean> {
    try {
      // Xác nhận vòng đời thẻ Cache
      const now = Date.now();
      if (this.hasPermission !== null &&
          (now - this.lastPermissionCheck) < this.PERMISSION_CACHE_DURATION) {
        return this.hasPermission;
      }

      let hasPermission = false;

      if (Capacitor.isNativePlatform()) {
        try {
          // Native được Default Trust
          await Clipboard.read();
          hasPermission = true;
        } catch (error) {
          console.warn('Native request fake probe failed:', error);
          hasPermission = false;
        }
      } else {
        if ('permissions' in navigator) {
          try {
            const result = await navigator.permissions.query({
              name: 'clipboard-read' as PermissionName
            });
            hasPermission = result.state === 'granted' || result.state === 'prompt';
          } catch (permError) {
            console.warn('API DOM Permission gãy chốt chặn:', permError);
            hasPermission = false;
          }
        }
        
        // Trò Hack cuối cùng check tồn tại prototype API DOM
        if (!hasPermission && navigator.clipboard && navigator.clipboard.readText) {
          try {
            hasPermission = typeof navigator.clipboard.readText === 'function';
          } catch {
            hasPermission = false;
          }
        }
      }     
      
      // Khắc cờ Cache
      this.hasPermission = hasPermission;
      this.lastPermissionCheck = Date.now();

      return hasPermission;

    } catch (error) {
      console.error('Đứt gánh gãy chốt thử quyền Permission Check:', error);
      this.hasPermission = false;
      this.lastPermissionCheck = Date.now();
      return false;
    }
  }

  /**
   * Bắn Pop-up hỏi trực diện Quyền thao tác Clipboard (Dành riêng cho Web Engine)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        return await this.checkPermissions();
      }

      // Web
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        console.warn('Clipboard API not available');
        return false;
      }

      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({
            name: 'clipboard-read' as PermissionName
          });

          if (result.state === 'granted') {
            this.hasPermission = true;
            this.lastPermissionCheck = Date.now();
            return true;
          } else if (result.state === 'denied') {
            this.hasPermission = false;
            this.lastPermissionCheck = Date.now();
            return false;
          }
        } catch (permError) {
          console.warn('Permissions API failed:', permError);
        }
      }

      // NOTE: Thao tác Web Request Permissions thường phải nổ chung với Event DOM User Trigger (Ví dụ bấm chuột)
      // Mặc định trả rỗng đợi User tương tác vật lý.
      return false; 

    } catch (error) {
      console.error('Lỗi khi mồi Request cấp quyển tay Clipboard:', error);
      return false;
    }
  }

  /** Xoá cờ rác bộ nhớ cấp phép */
  clearPermissionCache(): void {
    this.hasPermission = null;
    this.lastPermissionCheck = 0;
  }

  // ─────────────────────────────────────────────────────────
  // Hành Vi Thông Minh Khai Thác Text
  // ─────────────────────────────────────────────────────────

  /**
   * Mapper sinh văn bản mã báo Error dễ đọc nhất.
   */
  getErrorMessage(error: Error): string {
    if (error.message === 'PERMISSION_DENIED') {
      return 'Bị chặn quyền truy xuất khay nhớ. Hãy cấp quyền Paste trong trình duyệt web của bạn.';
    } else if (error.message === 'NOT_SUPPORTED') {
      return 'Trình duyệt Web không hỗ trợ tính năng Read, mong ngài hãy tự nhấn Ctrl + V.';
    } else {
      return 'Trích dữ liệu dán Paste xôi hỏng bỏng không. Vui lòng thử Manual Paste bằng tay!';
    }
  }

  /**
   * Mồi nhử thử Read Auto (Đọc dán không cần xin chóp).
   */
  async smartRead(): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    method?: 'native' | 'web' | 'user-action-required';
  }> {
    
    // Nếu là trên Web OS, cắt đuổi hất ra ngay tại cổng vì Web auto chặn
    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        error: 'USER_ACTION_REQUIRED',
        method: 'user-action-required'
      };
    }

    try {
      const content = await this.read();
      return {
        success: true,
        content,
        method: 'native'
      };
    } catch (error) {
      console.warn('Bắt tay Native Auto Read thất bại rụng:', error);

      return {
        success: false,
        error: 'NEEDS_MANUAL_PASTE',
        method: 'user-action-required'
      };
    }
  }

  /**
   * Khởi chạy Trigger Read sau khi bắt mạch được Event Focus/Click của User (Sống sót qua tường lửa DOM Web)
   */
  async readFromUserAction(): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    method?: 'native' | 'web' | 'event';
  }> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native app cắm thông chốt
        const result = await Clipboard.read();
        return {
          success: true,
          content: result.value || '',
          method: 'native'
        };
      } else {
        // Web - Khớp gọi ngay Event Loop DOM
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return {
            success: false,
            error: 'NOT_SUPPORTED',
            method: 'web'
          };
        }

        try {
          const content = await navigator.clipboard.readText();
          return {
            success: true,
            content,
            method: 'web'
          };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            return {
              success: false,
              error: 'PERMISSION_DENIED',
              method: 'web'
            };
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Lỗi khi moi ruột Clipboard từ Event click User:', error);
      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        method: 'web'
      };
    }
  }

  /**
   * Định danh Regex Filter cấu trúc URL có đúng form Youtube String không.
   */
  validateClipboardContent(content: string): {
    isValid: boolean;
    isYouTubeUrl: boolean;
    cleanUrl?: string;
    suggestion?: string;
  } {
    if (!content || content.trim().length === 0) {
      return {
        isValid: false,
        isYouTubeUrl: false,
        suggestion: 'Mảng rỗng hoặc Text khay nhớ mục nát không có giá trị copy.'
      };
    }

    const trimmed = content.trim();

    // Regular Expression soi chiếu cấu trúc URL chuẩn Youtube Watch
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(youtubeRegex);

    if (match) {
      const videoId = match[1];
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

      return {
        isValid: true,
        isYouTubeUrl: true,
        cleanUrl,
        suggestion: 'Gắn link cắm chốt Youtube xuất sắc thành công!'
      };
    }

    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      return {
        isValid: false,
        isYouTubeUrl: false,
        suggestion: 'Gãy cấu hình - Bắt được chữ Youtube nhưng link thối hỏng. Không xác định được Video ID.'
      };
    }

    // Tự nội suy nếu User Cop nhầm đúng cái mã Video ID ngắn gọn cụt lủn (11 kí tự chữ số gạch ngang hệ đếm Hexa 64)
    const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (videoIdRegex.test(trimmed)) {
      const cleanUrl = `https://www.youtube.com/watch?v=${trimmed}`;
      return {
        isValid: true,
        isYouTubeUrl: true,
        cleanUrl,
        suggestion: 'Video ID phát hiện đơn côi và đã được Ráp tự động thành Link Full!'
      };
    }

    return {
      isValid: false,
      isYouTubeUrl: false,
      suggestion: 'Text trong bộ nhớ cào lên không giống hình thái Link Bài Hát Music!'
    };
  }

  /**
   * Khối chóp đóng đinh Auto Try Paste và quét cờ Validate đồng bộ gộp làm 1 chặng.
   */
  async autoPasteWithValidation(): Promise<{
    success: boolean;
    content?: string;
    cleanUrl?: string;
    error?: string;
    suggestion?: string;
    needsManualPaste?: boolean;
  }> {
    try {

      const readResult = await this.smartRead();

      if (!readResult.success) {
        if (readResult.error === 'NEEDS_MANUAL_PASTE') {
          return {
            success: false,
            needsManualPaste: true,
            error: 'Manual paste required',
            suggestion: 'Vui lòng nhấn tổ hợp phím thủ công bằng phím Cứng (Ctrl+V) hoặc đè màn dán Text.'
          };
        }

        return {
          success: false,
          error: readResult.error || 'Unknown clipboard error',
          suggestion: 'Ngoại lệ bộ phanh khay rớt. Thao tác dán không tồn tại hỏng.'
        };
      }

      // Regex Chạy Validation
      const validation = this.validateClipboardContent(readResult.content!);

      if (validation.isValid && validation.isYouTubeUrl) {
        return {
          success: true,
          content: readResult.content,
          cleanUrl: validation.cleanUrl,
          suggestion: validation.suggestion
        };
      } else {
        return {
          success: false,
          content: readResult.content,
          error: 'Invalid content',
          suggestion: validation.suggestion
        };
      }

    } catch (error) {
      console.error('Logic dán Link Validation sụp đổ gãy khối:', error);
      return {
        success: false,
        error: 'Clipboard operation failed',
        suggestion: 'Vui lòng chèn dán gượng tay và Check lại thiết lập Permission bảo mật Web!'
      };
    }
  }
}
