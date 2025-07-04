import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, firstValueFrom } from 'rxjs';
import {
  SongsResponse,
  SongStatusResponse,
  DataSong,
  SongStatus
} from '../../interfaces/song.interface';
import { environment } from '../../../environments/environment';

/**
 * Service để giao tiếp với Music API v3
 * Implement 4 API endpoints chính cho Download Page
 */
@Injectable({
  providedIn: 'root'
})
export class MusicApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * 1. POST /api/v3/songs/info - Get Song Info từ YouTube URL
   * @param url - YouTube URL
   * @returns Observable<SongsResponse>
   */
  getSongInfo(youtube_url: string): Observable<SongsResponse> {
    const url = `${this.apiUrl}/songs/info`;
    const body = { youtube_url: youtube_url };
    return this.http.post<SongsResponse>(url, body);
  }



  /**
   * 2. GET /api/v3/songs/status/{song_id} - Get Song Status
   * Kiểm tra trạng thái xử lý của bài hát
   * @param songId - ID của bài hát
   * @returns Observable<SongStatusResponse>
   */
  getSongStatus(songId: string): Observable<SongStatusResponse> {
    return this.http.get<SongStatusResponse>(
      `${this.apiUrl}/songs/status/${songId}`
    ).pipe(
      catchError(this.handleError('getSongStatus'))
    );
  }

  /**
   * 3. GET /api/v3/songs/download/{song_id} - Download Song Audio
   * Download file audio đã được xử lý
   * @param songId - ID của bài hát
   * @param downloadParam - Thêm parameter download=true để download file
   * @returns Observable<Blob>
   */
  downloadSongAudio(songId: string, downloadParam: boolean = true): Observable<Blob> {
    let url = `${this.apiUrl}/songs/download/${songId}`;

    if (downloadParam) {
      const params = new HttpParams().set('download', 'true');
      return this.http.get(url, {
        responseType: 'blob',
        params
      }).pipe(
        catchError(this.handleError('downloadSongAudio'))
      );
    }

    return this.http.get(url, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError('downloadSongAudio'))
    );
  }

  /**
   * 4. GET /api/v3/songs/thumbnail/{song_id} - Get Thumbnail
   * Download thumbnail của bài hát
   * @param songId - ID của bài hát
   * @returns Observable<Blob>
   */
  downloadThumbnail(songId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/songs/thumbnail/${songId}`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError('downloadThumbnail'))
    );
  }

  /**
   * Download both audio and thumbnail for a song
   * @param songId - ID của bài hát
   * @returns Promise<{audioBlob: Blob, thumbnailBlob: Blob | null}>
   */
  async downloadSongWithThumbnail(songId: string): Promise<{
    audioBlob: Blob;
    thumbnailBlob: Blob | null;
  }> {
    try {
      console.log('🎵 Starting download for song:', songId);

      // Download audio (bắt buộc)
      const audioBlob = await firstValueFrom(this.downloadSongAudio(songId, true));

      // Download thumbnail (optional, không fail toàn bộ nếu lỗi)
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await firstValueFrom(this.downloadThumbnail(songId));
        console.log('✅ Thumbnail downloaded successfully');
      } catch (thumbnailError) {
        console.warn('⚠️ Thumbnail download failed:', thumbnailError);
        // Continue without thumbnail - this is not critical
      }

      console.log('✅ Audio downloaded successfully');
      return {
        audioBlob,
        thumbnailBlob
      };

    } catch (error) {
      console.error('❌ Download failed:', error);
      throw error;
    }
  }

  /**
   * Helper: Streaming URL cho audio player (không download)
   * @param songId - ID của bài hát
   * @returns string - URL để stream
   */
  getStreamingUrl(songId: string): string {
    return `${this.apiUrl}/songs/download/${songId}`;
  }

  /**
   * Helper: Download URL với parameter download=true
   * @param songId - ID của bài hát
   * @returns string - URL để download
   */
  getDownloadUrl(songId: string): string {
    return `${this.apiUrl}/songs/download/${songId}?download=true`;
  }

  /**
   * Helper: Thumbnail URL
   * @param songId - ID của bài hát
   * @returns string - URL thumbnail
   */
  getThumbnailUrl(songId: string): string {
    return `${this.apiUrl}/songs/thumbnail/${songId}`;
  }

  /**
   * Validate YouTube URL
   * @param url - URL cần validate
   * @returns boolean
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

  /**
   * Error handler
   * @param operation - Tên operation bị lỗi
   * @returns Function để handle error
   */
  private handleError(operation: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = `${operation} failed: `;

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage += error.error.message;
      } else {
        // Server-side error
        switch (error.status) {
          case 400:
            errorMessage += 'Bad Request - Invalid parameters';
            break;
          case 404:
            errorMessage += 'Song not found or not ready';
            break;
          case 429:
            errorMessage += 'Too many requests - Please wait';
            break;
          case 500:
            errorMessage += 'Server error - Please try again later';
            break;
          case 0:
            errorMessage += 'Network error or CORS issue';
            break;
          default:
            errorMessage += `HTTP ${error.status}: ${error.message}`;
        }
      }

      console.error('❌ MusicApiService Error:', errorMessage, error);
      return throwError(() => new Error(errorMessage));
    };
  }

  /**
   * Utility: Check if song is ready for download based on status
   * @param status - SongStatus object
   * @returns boolean
   */
  isSongReadyForDownload(status: SongStatus): boolean {
    return status.status === 'completed' && status.progress === 1;
  }

  /**
   * Utility: Get progress percentage from status
   * @param status - SongStatus object
   * @returns number - Progress percentage (0-100)
   */
  getProgressPercentage(status: SongStatus): number {
    return Math.round(status.progress * 100);
  }

  /**
   * Utility: Get user-friendly status message
   * @param status - SongStatus object
   * @returns string - Status message
   */
  getStatusMessage(status: SongStatus): string {
    switch (status.status) {
      case 'pending':
        return 'Đang chờ xử lý...';
      case 'processing':
        return `Đang xử lý... ${this.getProgressPercentage(status)}%`;
      case 'completed':
        return 'Sẵn sàng tải xuống';
      case 'failed':
        return `Xử lý thất bại: ${status.error_message || 'Lỗi không xác định'}`;
      default:
        return 'Trạng thái không xác định';
    }
  }
}
