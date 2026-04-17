import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { tap, catchError, map } from "rxjs/operators";
import { Song, SongsResponse } from "@core/interfaces/song.interface";
import { SongConverter } from "@core/utils/song.converter";
import { environment } from "src/environments/environment";

/**
 * Service quản lý việc tải và lưu trữ (caching) dữ liệu bài hát cho trang chủ.
 *
 * Chức năng:
 * - Tải danh sách bài hát từ backend và cache lại để tránh spam API liên tục.
 * - Hỗ trợ BehaviorSubject để các component có thể subscribe và cập nhật realtime khi data thay đổi.
 * - Chuẩn hoá dữ liệu API trả về (từ nhiều định dạng) thành dạng chuẩn của mảng `Song`.
 */
@Injectable({
  providedIn: 'root',
})
export class HomeService {
  // ─────────────────────────────────────────────────────────
  // State & Properties
  // ─────────────────────────────────────────────────────────

  private apiUrl = environment.apiUrl;
  
  /** Node lưu trữ dữ liệu cache theo key để tránh call API trùng lặp */
  private cachedData: Map<string, SongsResponse<Song[]>> = new Map();
  /** BehaviorSubject lưu trạng thái data realtime cho các subscriber */
  private dataSubjects: Map<string, BehaviorSubject<SongsResponse<Song[]> | null>> = new Map();
  /** Hashmap cờ đánh dấu đang tải dữ liệu cho từng key cache */
  private loadingStates: Map<string, boolean> = new Map();

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  constructor(private http: HttpClient) {
    this.loadInitialData();
  }

  // ─────────────────────────────────────────────────────────
  // Private Helpers & State Handlers
  // ─────────────────────────────────────────────────────────

  /** Tải dữ liệu lần đầu tiên với key mặc định */
  private loadInitialData(key: string = ''): void {
    this.loadData(key, 50);
  }

  /** Tạo cache key duy nhất kết hợp giữa filter key và limit record */
  private getCacheKey(key: string, limit: number = 50): string {
    return `${key}_${limit}`;
  }

  /** Kiểm tra xem một cache key có đang trong quá trình call API tải dữ liệu hay không */
  private isLoading(cacheKey: string): boolean {
    return this.loadingStates.get(cacheKey) || false;
  }

  /** Đặt trạng thái đang tải dữ liệu cho một cache key cụ thể */
  private setLoading(cacheKey: string, loading: boolean): void {
    this.loadingStates.set(cacheKey, loading);
  }

  /** Lấy (hoặc khởi tạo nếu chưa có) BehaviorSubject cho một cache key */
  private getDataSubject(cacheKey: string): BehaviorSubject<SongsResponse<Song[]> | null> {
    if (!this.dataSubjects.has(cacheKey)) {
      this.dataSubjects.set(cacheKey, new BehaviorSubject<SongsResponse<Song[]> | null>(null));
    }
    return this.dataSubjects.get(cacheKey)!;
  }

  // ─────────────────────────────────────────────────────────
  // Private Data Fetching & Mapping
  // ─────────────────────────────────────────────────────────

  /**
   * Gọi API backend lấy danh sách bài hát và chuẩn hoá dữ liệu.
   *
   * Backend có thể trả về data dạng Array, mảng nằm trong property `songs`, hoặc object đơn lẻ.
   * Hàm này sẽ thống nhất tất cả format trả về dùng mảng các object `Song`.
   *
   * @param limit - Giới hạn số lượng bài hát
   * @param key - Khoá tìm kiếm / bộ lọc
   * @returns Observable phát ra Response đã chuẩn hoá
   */
  private getHomeDataFromAPI(limit: number = 50, key: string = ''): Observable<SongsResponse<Song[]>> {
    const url = `${this.apiUrl}/songs/completed?limit=${limit}&key=${key}`;
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        if (response.success && response.data) {
          if (Array.isArray(response.data)) {
            const songs = response.data.map((item: any) => SongConverter.fromApiData(item));
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          } else if (response.data.songs && Array.isArray(response.data.songs)) {
            const songs = response.data.songs.map((item: any) => SongConverter.fromApiData(item));
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          } else if (typeof response.data === 'object') {
            const songs = [SongConverter.fromApiData(response.data)];
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          }
        }

        // HACK: Format trả về không hợp lệ, fallback trả về mảng rỗng để không crash loop UI.
        // TODO: Backend phần này cần chuẩn hoá trả về duy nhất một cấu trúc interface.
        return {
          success: false,
          message: 'Invalid response format',
          data: []
        };
      })
    );
  }

  /**
   * Hàm wrapper nội bộ gọi API và quản lý trạng thái state cache/loading.
   */
  private loadData(key: string = '', limit: number = 50): void {
    const cacheKey = this.getCacheKey(key, limit);

    if (!this.isLoading(cacheKey) && !this.cachedData.has(cacheKey)) {
      this.setLoading(cacheKey, true);
      this.getHomeDataFromAPI(limit, key).subscribe({
        next: (data) => {
          this.cachedData.set(cacheKey, data);
          this.getDataSubject(cacheKey).next(data);
          this.setLoading(cacheKey, false);
        },
        error: (error) => {
          console.error(`Error loading home data for key: ${key}`, error);
          this.setLoading(cacheKey, false);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // Public Interface
  // ─────────────────────────────────────────────────────────

  /**
   * Lấy dữ liệu trang chủ, ưu tiên sử dụng Cache.
   *
   * Nếu đã có cache: Trả về dữ liệu liền mà không gọi API.
   * Nếu đang load dở: Trả về luồng để chờ dữ liệu.
   * Nếu chưa có gì: Trigger event tải và trả về luồng chờ dữ liệu.
   *
   * @param key - Lọc theo dạng key cụ thể (bỏ trống lấy tất cả)
   * @param limit - Số lượng bài hát muốn trả về
   * @returns Observable chứa danh sách hoặc null
   */
  getHomeData(key: string = '', limit: number = 50): Observable<SongsResponse<Song[]> | null> {
    const cacheKey = this.getCacheKey(key, limit);

    if (this.cachedData.has(cacheKey)) {
      return of(this.cachedData.get(cacheKey)!);
    }

    if (this.isLoading(cacheKey)) {
      return this.getDataSubject(cacheKey).asObservable();
    }

    this.loadData(key, limit);
    return this.getDataSubject(cacheKey).asObservable();
  }

  /**
   * Xoá cache cụ thể và bắt buộc gọi API lấy danh sách bài hát mới.
   *
   * @param key - Key đã cache trước đó
   * @param limit - Số lượng cần lấy
   * @returns Observable phát ra kết quả tải hoặc lỗi
   * @throws Gửi lỗi qua luồng Error của Observable nếu xảy ra lỗi HTTP
   */
  refreshData(key: string = '', limit: number = 1000): Observable<SongsResponse<Song[]>> {
    const cacheKey = this.getCacheKey(key, limit);

    this.cachedData.delete(cacheKey);
    this.setLoading(cacheKey, true);

    return this.getHomeDataFromAPI(limit, key).pipe(
      tap(data => {
        this.cachedData.set(cacheKey, data);
        this.getDataSubject(cacheKey).next(data);
        this.setLoading(cacheKey, false);
      }),
      catchError(error => {
        this.setLoading(cacheKey, false);
        throw error;
      })
    );
  }

  /** Xoá sạch toàn bộ cache dữ liệu và trạng thái loading đang có của dịch vụ. */
  clearCache(): void {
    this.cachedData.clear();
    this.dataSubjects.clear();
    this.loadingStates.clear();
  }

  /**
   * Xoá cache của một filter đặc thù (mức limit và key tuỳ chọn).
   *
   * @param key - Từ khoá lọc
   * @param limit - Giới hạn phần tử
   */
  clearCacheForKey(key: string = '', limit: number = 50): void {
    const cacheKey = this.getCacheKey(key, limit);
    this.cachedData.delete(cacheKey);
    this.dataSubjects.delete(cacheKey);
    this.loadingStates.delete(cacheKey);
  }
}
