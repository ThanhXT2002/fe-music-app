import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { BehaviorSubject, interval, map, Observable, switchMap, takeWhile } from "rxjs";
import { ApiResponse, SongInfo, SongStatus } from "src/app/models/song.model";
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DownloadSongYoutubeService {

  private apiUrl = environment.apiUrl;
  private currentSongSubject = new BehaviorSubject<SongInfo | null>(null);
  private statusPollingSubject = new BehaviorSubject<SongStatus | null>(null);

  currentSong$ = this.currentSongSubject.asObservable();
  songStatus$ = this.statusPollingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Lấy thông tin bài hát từ YouTube URL và bắt đầu tải về
   */
  getSongInfo(youtubeUrl: string): Observable<SongInfo> {
    return this.http.post<ApiResponse<SongInfo>>(`${this.apiUrl}/songs/info`, { youtube_url: youtubeUrl })
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }

          // Cập nhật current song
          this.currentSongSubject.next(response.data);

          // Bắt đầu polling trạng thái
          this.startStatusPolling(response.data.id);

          return response.data;
        })
      );
  }

  /**
   * Kiểm tra trạng thái xử lý của bài hát theo định kỳ
   */
  startStatusPolling(songId: string, pollInterval = 2000): void {
    interval(pollInterval)
      .pipe(
        switchMap(() => this.getSongStatus(songId)),
        takeWhile(status => status.status !== 'completed' && status.status !== 'failed', true)
      ).subscribe(status => {
        this.statusPollingSubject.next(status);
      });
  }

  /**
   * Lấy trạng thái xử lý của bài hát
   */
  getSongStatus(songId: string): Observable<SongStatus> {
    return this.http.get<ApiResponse<SongStatus>>(`${this.apiUrl}/songs/status/${songId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data;
        })
      );
  }

  /**
   * Lấy URL download cho bài hát
   */
  getDownloadUrl(songId: string): string {
    return `${this.apiUrl}/songs/download/${songId}`;
  }

  /**
   * Lấy URL thumbnail cho bài hát
   */
  getThumbnailUrl(songId: string): string {
    return `${this.apiUrl}/songs/thumbnail/${songId}`;
  }

  // /**
  //  * Download và lưu file nhạc vào IndexedDB
  //  */
  // downloadAndStoreAudio(songId: string): Observable<Blob> {
  //   return this.http.get(this.getDownloadUrl(songId), { responseType: 'blob' })
  //     .pipe(
  //       tap(audioBlob => {
  //         // Lưu vào IndexedDB cho sử dụng offline
  //         this.storeInIndexedDB(songId, audioBlob);
  //       })
  //     );
  // }

  // /**
  //  * Lưu file audio vào IndexedDB
  //  */
  // private storeInIndexedDB(songId: string, audioBlob: Blob): void {
  //   const request = indexedDB.open('musicDB', 1);

  //   request.onupgradeneeded = (event: any) => {
  //     const db = event.target.result;
  //     if (!db.objectStoreNames.contains('songs')) {
  //       db.createObjectStore('songs', { keyPath: 'id' });
  //     }
  //   };

  //   request.onsuccess = (event: any) => {
  //     const db = event.target.result;
  //     const transaction = db.transaction(['songs'], 'readwrite');
  //     const store = transaction.objectStore('songs');

  //     // Lưu song vào IndexedDB
  //     store.put({
  //       id: songId,
  //       audioBlob: audioBlob,
  //       timestamp: new Date().toISOString()
  //     });
  //   };
  // }
}


