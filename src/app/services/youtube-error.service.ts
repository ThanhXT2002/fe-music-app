import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class YouTubeErrorService {

  /**
   * Phân tích và đưa ra lời khuyên cho lỗi YouTube
   */
  analyzeYouTubeError(error: any): {
    message: string;
    suggestions: string[];
    canRetry: boolean;
    severity: 'low' | 'medium' | 'high';
  } {
    const status = error.status || 0;

    switch (status) {
      case 0:
        return {
          message: 'Không thể kết nối đến server',
          suggestions: [
            'Kiểm tra kết nối internet',
            'Thử kết nối WiFi khác',
            'Tắt VPN nếu đang sử dụng',
            'Thử lại sau vài phút'
          ],
          canRetry: true,
          severity: 'high'
        };

      case 400:
        return {
          message: 'URL YouTube không hợp lệ',
          suggestions: [
            'Kiểm tra lại link YouTube',
            'Đảm bảo link là video công khai',
            'Thử copy link từ trình duyệt',
            'Không sử dụng link playlist'
          ],
          canRetry: false,
          severity: 'medium'
        };

      case 403:
        return {
          message: 'Video bị hạn chế truy cập',
          suggestions: [
            'Video có thể bị khóa bản quyền',
            'Video chỉ có thể xem ở một số quốc gia',
            'Thử video khác cùng bài hát',
            'Tìm phiên bản cover hoặc remix'
          ],
          canRetry: false,
          severity: 'medium'
        };

      case 404:
        return {
          message: 'Video không tồn tại',
          suggestions: [
            'Video đã bị xóa bởi tác giả',
            'Channel đã bị khóa',
            'Kiểm tra lại URL',
            'Tìm video khác cùng bài hát'
          ],
          canRetry: false,
          severity: 'low'
        };

      case 429:
        return {
          message: 'Quá nhiều yêu cầu',
          suggestions: [
            'Đợi 5-10 phút rồi thử lại',
            'Giảm số lượng tải cùng lúc',
            'Thử vào thời gian khác',
            'Server đang quá tải'
          ],
          canRetry: true,
          severity: 'medium'
        };

      case 502:
        return {
          message: 'Server gateway lỗi',
          suggestions: [
            'Server tạm thời không khả dụng',
            'Thử lại sau 2-3 phút',
            'Lỗi từ phía YouTube',
            'Kiên nhẫn chờ server phục hồi'
          ],
          canRetry: true,
          severity: 'medium'
        };

      case 503:
        return {
          message: 'Server đang bảo trì',
          suggestions: [
            'YouTube đang bảo trì',
            'Thử lại sau 10-15 phút',
            'Kiểm tra trang status của YouTube',
            'Chờ đợi server online lại'
          ],
          canRetry: true,
          severity: 'medium'
        };

      case 504:
        return {
          message: 'Server xử lý quá lâu (timeout)',
          suggestions: [
            'Video có thể quá dài (>10 phút)',
            'Server YouTube đang chậm',
            'Thử video ngắn hơn (<5 phút)',
            'Thử lại vào giờ ít người dùng',
            'Chọn video chất lượng thấp hơn'
          ],
          canRetry: true,
          severity: 'high'
        };

      case 520:
      case 521:
      case 522:
      case 523:
      case 524:
        return {
          message: 'Lỗi Cloudflare/CDN',
          suggestions: [
            'Lỗi từ hệ thống CDN',
            'Thử lại sau 5 phút',
            'Có thể do vị trí địa lý',
            'Thử kết nối VPN khác vùng'
          ],
          canRetry: true,
          severity: 'medium'
        };

      default:
        return {
          message: `Lỗi không xác định (${status})`,
          suggestions: [
            'Lỗi không thường gặp',
            'Thử lại sau vài phút',
            'Liên hệ hỗ trợ nếu lỗi lặp lại',
            'Thử video khác'
          ],
          canRetry: true,
          severity: 'medium'
        };
    }
  }

  /**
   * Kiểm tra xem có nên tự động retry không
   */
  shouldAutoRetry(status: number): boolean {
    const retryableStatuses = [0, 502, 503, 504, 520, 521, 522, 523, 524];
    return retryableStatuses.includes(status);
  }

  /**
   * Tính toán delay cho retry dựa trên loại lỗi
   */
  getRetryDelay(status: number, attempt: number): number {
    switch (status) {
      case 504: // Timeout - cần delay lâu hơn
        return Math.pow(2, attempt) * 3000; // 3s, 6s, 12s
      case 429: // Rate limit - delay rất lâu
        return Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
      case 502:
      case 503:
        return Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
      default:
        return Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
    }
  }

  /**
   * Format thông báo lỗi cho user
   */
  formatUserMessage(error: any): string {
    const analysis = this.analyzeYouTubeError(error);
    return `${analysis.message}. ${analysis.suggestions[0] || 'Vui lòng thử lại sau.'}`;
  }
}
