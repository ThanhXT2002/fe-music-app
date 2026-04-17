import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams,
  HttpErrorResponse,
  HttpRequest,
  HttpEvent
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  SongsResponse,
  SongStatusResponse,
  SongStatus,
} from '@core/interfaces/song.interface';
import { environment } from '../../../environments/environment';

/**
 * Service xử lý giao tiếp HTTP với backend API cho các nghiệp vụ tải và xử lý trạng thái bài hát.
 *
 * Chức năng cốt lõi:
 * - Lấy thông tin bài hát từ YouTube URL.
 * - Hỗ trợ 2 cơ chế tải: Proxy Download (tiếp âm proxy qua Youtube stream) và Standard Download (lưu server).
 * - Poll kiểm tra trạng thái background jobs (FFmpeg) từ task hàng đợi của backend.
 *
 * Phụ thuộc: `HttpClient`, Biến khởi tạo môi trường gốc `environment.apiUrl`
 */
@Injectable({
  providedIn: 'root',
})
export class MusicApiService {
  // ─────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ─────────────────────────────────────────────────────────
  // Metadata & Status Handlers
  // ─────────────────────────────────────────────────────────

  /**
   * Trích xuất trước thông tin metadata từ cấu trúc Youtube URL xuống hệ thống server.
   *
   * Được gọi khi user copy/paste liên kết trên thanh search hoặc cần cache check trước thông tin.
   * Hệ thống sẽ xác nhận xem đây có phải video chuẩn không có thể extract được dữ liệu không.
   *
   * @param youtube_url - Chuỗi URL chia sẻ từ YouTube (vd: `https://youtu.be/...` hoặc `youtube.com/watch`)
   * @returns Observable phát ra Object kết quả chi tiết ban đầu của bài hát (Thumbnail, Artist, Tên Bài)
   */
  getSongInfo(youtube_url: string): Observable<SongsResponse> {
    const url = `${this.apiUrl}/songs/info`;
    // Post URL về cho backend đánh giá và cạo data meta
    const body = { youtube_url: youtube_url };
    return this.http.post<SongsResponse>(url, body);
  }

  /**
   * Lệnh gọi liên tục (polling) lấy thông tin tiến trình thực thi của background worker tải/encode audio (FFmpeg).
   *
   * @param songId - Khóa ID hash ngoại định danh quá trình xử lý bài hát 
   * @returns Observable báo lại cấu trúc gồm phần trăm (progress) và status dạng Text
   */
  getSongStatus(songId: string): Observable<SongStatusResponse> {
    return this.http
      .get<SongStatusResponse>(`${this.apiUrl}/songs/status/${songId}`)
      .pipe(catchError(this.handleError('getSongStatus')));
  }

  // ─────────────────────────────────────────────────────────
  // Data Transport (Download & Streams)
  // ─────────────────────────────────────────────────────────

  /**
   * Kích hoạt tiến trình Proxy Audio trực diện từ máy chủ Backend (Stream thẳng từ yt-dlp).
   *
   * Thay vì chờ server tải nguyên file xuống Disk rồi chuyển tiếp cực chậm, 
   * việc Proxy Download giúp Backend trả về Request Stream Byte chunk realtime (tăng max tốc độ UI).
   *
   * @param songId - Khóa hash nhận dạng file
   * @returns Observable phát ra Response Buffer (Blob) và Event báo cáo dung lượng Request Progress
   */
  proxyDownloadAudio(songId: string): Observable<HttpEvent<Blob>> {
    const url = `${this.apiUrl}/songs/proxy-download/${songId}`;
    const req = new HttpRequest<any>('GET', url, null, {
      responseType: 'blob',
      reportProgress: true,
    });
    return this.http.request<Blob>(req).pipe(
      catchError(this.handleError('proxyDownloadAudio'))
    );
  }

  /**
   * Tải lại file audio thủ công bằng các Endpoint API tiêu chuẩn.
   *
   * Dùng cho việc tải lại khi file audio đã tồn tại trạng thái `completed` trên server và đảm bảo chắc chắn không bị block.
   *
   * @param songId - Hash ID file cần lấy
   * @param downloadParam - Quy định nhúng Query `download=true` báo Backend cấu hình header attachment
   * @returns Observable phát ra Data Binary Byte của Blob File (Audio) kèm quá trình tính Byte tải xuống
   */
  downloadSongAudio(songId: string, downloadParam: boolean = true): Observable<HttpEvent<Blob>> {
    let url = `${this.apiUrl}/songs/download/${songId}`;
    let params = undefined;
    if (downloadParam) {
      params = new HttpParams().set('download', 'true');
    }
    const req = new HttpRequest<any>('GET', url, null, {
      params,
      responseType: 'blob',
      reportProgress: true,
    });

    return this.http.request<Blob>(req).pipe(
      catchError(this.handleError('downloadSongAudioWithProgress'))
    );
  }

  /**
   * Kéo file ảnh Thumbnail từ Database/Folder tạm của Backend đã được cache lại.
   *
   * @param songId - ID của bài hát gắn liền với ảnh
   * @returns Observable trích xuất cấu trúc Ảnh (Blob Image)
   */
  downloadThumbnail(songId: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/songs/thumbnail/${songId}`, {
        responseType: 'blob',
      })
      .pipe(catchError(this.handleError('downloadThumbnail')));
  }

  /**
   * Tải Thumbnail bypass qua server proxy nội bộ. Lấy trực tiếp từ static file `ytimg` của Youtube.
   *
   * Hạn chế rủi ro ngưng kết nối nếu backend chính quá tải.
   *
   * @param thumbnailUrl - Đường dẫn trỏ thẳng vào Server Avatar của GG (Vd. i.ytimg.com)
   * @returns Observable Image Blob
   */
  downloadThumbnailDirect(thumbnailUrl: string): Observable<Blob> {
    return this.http
      .get(thumbnailUrl, { responseType: 'blob' })
      .pipe(catchError(this.handleError('downloadThumbnailDirect')));
  }

  // ─────────────────────────────────────────────────────────
  // URL Helpers
  // ─────────────────────────────────────────────────────────

  /** Lấy Base path dẫn trực tiếp vào audio file nhằm truyền làm tham số `src=""` cho element AudioNative */
  getStreamingUrl(songId: string): string {
    return `${this.apiUrl}/songs/download/${songId}`;
  }

  /** Lấy Base path có cờ lệnh download kích phát hộp thoại `Save file as` trên Browser */
  getDownloadUrl(songId: string): string {
    return `${this.apiUrl}/songs/download/${songId}?download=true`;
  }

  /** Lấy endpoint ảnh thumbnail trỏ nội bộ do server quản duyệt */
  getThumbnailUrl(songId: string): string {
    return `${this.apiUrl}/songs/thumbnail/${songId}`;
  }

  /**
   * Kiểm tra biểu thức chính quy (Regex) xem URL nhập liệu có tuân thủ format thuộc domain Youtube hợp lệ.
   *
   * @param url - Chuỗi URL cần validate trước khi submit lên server
   * @returns Đúng nết hợp quy Youtube
   */
  validateYoutubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  }

  // ─────────────────────────────────────────────────────────
  // Error Mapping & UI Formatters
  // ─────────────────────────────────────────────────────────

  /**
   * Đánh chặn, format và chuẩn hóa Error Response API theo chuẩn ngôn ngữ Tiếng Việt thân thiện.
   *
   * Nhận dạng HTTP Code để mapping hiển thị Toast Error tự nhiên hơn.
   *
   * @param operation - Tên action đang lỗi để truy vết khi logging console trong devmode
   * @returns Operator block `catchError` của RxJS văng ra `never` Error hoàn chỉnh
   */
  private handleError(operation: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = `${operation} failed: `;

      if (error.error instanceof ErrorEvent) {
        errorMessage += error.error.message;
      } else {
        switch (error.status) {
          case 400:
            errorMessage += 'Bad Request - Lỗi cấu trúc đầu vào không hợp lệ.';
            break;
          case 404:
            errorMessage += 'Mã nhận diện bản nhạc không được tìm thấy trên Server.';
            break;
          case 429:
            errorMessage += 'Dịch vụ gặp tình trạng giới hạn yêu cầu (Rate Limit). Ráng đợi một chút rồi tải lại.';
            break;
          case 500:
            errorMessage += 'Hệ thống Backend sập chập diện rộng, nấn ná thử lại sau.';
            break;
          case 0:
            errorMessage += 'Đứt gánh kết nối trung gian hoặc bị kiểm duyệt chéo CORS bảo mật chặn.';
            break;
          default:
            errorMessage += `HTTP ${error.status}: ${error.message}`;
        }
      }

      console.error('MusicApiService Error:', errorMessage, error);
      return throwError(() => new Error(errorMessage));
    };
  }

  /**
   * Boolean Function check trạng thái hoàn thành an toàn dành cho việc tải cứng (Download).
   *
   * @param status - State tải hiện thời của Hash Record trên DB
   * @returns True nếu như đã vượt 100% processing thành công
   */
  isSongReadyForDownload(status: SongStatus): boolean {
    return status.status === 'completed' && status.progress === 1;
  }

  /** 
   * Trả về khối phần trăm nguyên của Process trạng thái.
   * @param status - Cấu trúc trạng thái bài hát
   * @returns Trị số nguyên hệ số 100
   */
  getProgressPercentage(status: SongStatus): number {
    return Math.round(status.progress * 100);
  }

  /**
   * Hàm chuyển đổi Object Status API thô cứng sang dạng văn bản Human Text cho UI tiến trình tải bài.
   *
   * @param status - Phản hồi Trạng Thái DB của backend
   * @returns Message báo cáo quá trình xử lý có nội dung Tiếng Việt. 
   */
  getStatusMessage(status: SongStatus): string {
    switch (status.status) {
      case 'pending':
        return 'Chờ tới lượt xử lý đợi xếp hàng tải bài hát...';
      case 'processing':
        return `Tiến trình cào nhạc đang xử lý mã hóa file... ${this.getProgressPercentage(status)}%`;
      case 'completed':
        return 'Xong rồi! File sẵn sàng chờ nhấp tải.';
      case 'failed':
        return `Khủng hoảng trong quá trình xử lý nội dung Server: ${
          status.error_message || 'Không có mã lỗi cục bộ'
        }`;
      default:
        return 'Trạng thái bất ngờ không nằm trong từ điển cho sẵn';
    }
  }
}
