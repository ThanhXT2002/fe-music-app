import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/** Định dạng cấu trúc trả về lúc nhận diện thành công bản mix match nhạc */
export interface SongIdentifySuccessData {
  title: string;
  artist: string;
  album: string;
  release_date: string;
  score: number;
  external_ids: {
    isrc?: string;
    upc?: string;
  };
  external_metadata?: {
    youtube?: { vid?: string; };
    deezer?: {
      album?: { name?: string; id?: string };
      track?: { name?: string; id?: string };
      artists?: Array<{ name?: string; id?: string }>;
    };
    spotify?: {
      album?: { name?: string; id?: string };
      track?: { name?: string; id?: string };
      artists?: Array<{ name?: string; id?: string }>;
    };
  };
}

/** Cấu trúc Data lỗi từ service Audit Shazam cung cấp khi fail */
export interface SongIdentifyErrorData {
  status: {
    msg: string;
    code: number;
    version?: string;
  };
}

/** Cấu trúc Type kết hợp dùng xác định phân luồng trạng thái Kết quả Trả Về Thu Âm */
export type IdentifySongResponse =
  | {
      success: true;
      message: string;
      data: SongIdentifySuccessData;
    }
  | {
      success: false;
      message: string;
      data: SongIdentifyErrorData;
    };

/**
 * Service tích hợp đảm nhiệm giao tiếp việc điều phối tính năng nhận diện âm thanh (Identify Audio / Shazam).
 *
 * Chức năng:
 * - Chuẩn hóa Object sang format raw `FormData` để backend thu nạp cấu trúc File Blob thuần tuý.
 */
@Injectable({ providedIn: 'root' })
export class SongIdentifyApiService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Địa chỉ API Server cấu hình theo Environment */
  private apiUrl = environment.apiUrl;

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor(private http: HttpClient) {}

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Truyền khối gói dữ liệu thu âm Microphone (hoặc Base Audio File) nén lên Backend phân tích.
   *
   * Gói vào FormData vì API cần giao thức `multipart/form-data` thay cho chuỗi JSON thông thường.
   *
   * @param file - Tham chiếu dạng File Binary hoặc Blob Blob Object Buffer từ module thu thanh Client
   * @returns Observable xuất luồng Data Match Bài trùng khớp với ID nhạc quốc tế (Deezer/Spotify)
   */
  identifySongByFile(file: File | Blob): Observable<IdentifySongResponse> {
    const formData = new FormData();
    // Bắt buộc đẩy key "file" để Framework form parse Backend hiểu và bốc tách lưu File vật lý đúng lúc đọc stream.
    formData.append('file', file);
    return this.http.post<IdentifySongResponse>(`${this.apiUrl}/songs/identify`, formData);
  }
}
