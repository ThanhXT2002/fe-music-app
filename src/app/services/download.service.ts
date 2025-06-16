import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { Song, DataSong, YouTubeDownloadResponse, AudioFile, ThumbnailFile } from '../interfaces/song.interface';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { RefreshService } from './refresh.service';
import { environment } from 'src/environments/environment';

// Define DownloadTask interface directly in this file
export interface DownloadTask {
  id: string;
  title: string;
  artist: string;
  url: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
  filePath?: string;
  thumbnail?: string;
  addedAt: Date;
  // Thêm thông tin từ API
  songData?: DataSong;
}



@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private apiUrl = environment.apiUrl;

  private downloadsSubject = new BehaviorSubject<DownloadTask[]>([]);
  public downloads$ = this.downloadsSubject.asObservable();

  private activeDownloads = new Map<string, any>();
  constructor(
    private http: HttpClient,
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private refreshService: RefreshService
  ) {
    this.loadDownloadsFromStorage();
  }

  get currentDownloads(): DownloadTask[] {
    return this.downloadsSubject.value;
  }

  /**
   * Download bài hát từ API response và lưu vào database
   * @param songData - Data từ API response
   * @returns Promise<string> - ID của download task
   */
  async downloadSong(songData: DataSong): Promise<string> {
    // Kiểm tra xem bài hát đã được download chưa
    const existingTask = this.currentDownloads.find(d =>
      d.songData?.id === songData.id && d.status === 'completed'
    );

    if (existingTask) {
      console.log('Song already downloaded:', songData.title);
      return existingTask.id;
    }

    // Tạo download task mới
    const downloadTask: DownloadTask = {
      id: this.generateId(),
      title: songData.title,
      artist: songData.artist,
      url: songData.audio_url,
      progress: 0,
      status: 'pending',
      thumbnail: songData.thumbnail_url,
      addedAt: new Date(),
      songData: songData
    };

    // Thêm vào danh sách downloads
    const currentDownloads = this.currentDownloads;
    currentDownloads.unshift(downloadTask);
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();

    // Bắt đầu quá trình download
    this.startDownload(downloadTask.id);

    return downloadTask.id;
  }

  // Add a new download task (giữ nguyên method cũ để tương thích)
  addDownload(task: Omit<DownloadTask, 'id' | 'progress' | 'status' | 'addedAt'>): string {
    const downloadTask: DownloadTask = {
      ...task,
      id: this.generateId(),
      progress: 0,
      status: 'pending',
      addedAt: new Date()
    };

    const currentDownloads = this.currentDownloads;
    currentDownloads.unshift(downloadTask);
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();

    this.startDownload(downloadTask.id);
    return downloadTask.id;
  }

  // Update download progress
  updateDownloadProgress(id: string, progress: number, status?: DownloadTask['status']) {
    const currentDownloads = this.currentDownloads;
    const downloadIndex = currentDownloads.findIndex(d => d.id === id);

    if (downloadIndex !== -1) {
      currentDownloads[downloadIndex] = {
        ...currentDownloads[downloadIndex],
        progress,
        ...(status && { status })
      };

      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToStorage();
    }
  }

  // Mark download as completed
  async completeDownload(id: string, filePath?: string) {
    const download = this.getDownload(id);
    if (!download) return;

    this.updateDownload(id, {
      status: 'completed',
      progress: 100,
      filePath
    });

    // Lưu bài hát vào database nếu có songData
    if (download.songData) {
      await this.saveSongToDatabase(download.songData, filePath);
    }

    // Remove from active downloads
    this.activeDownloads.delete(id);
  }

  // Mark download as failed
  failDownload(id: string, error: string) {
    this.updateDownload(id, {
      status: 'error',
      error
    });

    this.activeDownloads.delete(id);
  }

  // Pause download
  pauseDownload(id: string) {
    const activeDownload = this.activeDownloads.get(id);
    if (activeDownload && activeDownload.abort) {
      activeDownload.abort();
    }

    this.updateDownload(id, { status: 'paused' });
    this.activeDownloads.delete(id);
  }

  // Resume download
  resumeDownload(id: string) {
    this.updateDownload(id, { status: 'pending' });
    this.startDownload(id);
  }

  // Cancel and remove download
  cancelDownload(id: string) {
    const activeDownload = this.activeDownloads.get(id);
    if (activeDownload && activeDownload.abort) {
      activeDownload.abort();
    }

    const currentDownloads = this.currentDownloads.filter(d => d.id !== id);
    this.downloadsSubject.next(currentDownloads);
    this.activeDownloads.delete(id);
    this.saveDownloadsToStorage();
  }

  // Clear completed downloads
  clearCompleted() {
    const currentDownloads = this.currentDownloads.filter(d => d.status !== 'completed');
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();
  }

  // Clear all downloads
  clearAll() {
    this.activeDownloads.forEach((download, id) => {
      if (download.abort) {
        download.abort();
      }
    });

    this.activeDownloads.clear();
    this.downloadsSubject.next([]);
    this.saveDownloadsToStorage();
  }

  // Get download by ID
  getDownload(id: string): DownloadTask | undefined {
    return this.currentDownloads.find(d => d.id === id);
  }  // Get downloads by status
  getDownloadsByStatus(status: DownloadTask['status']): DownloadTask[] {
    return this.currentDownloads.filter(d => d.status === status);
  }

  /**
   * Kiểm tra xem bài hát đã được download chưa
   * @param songId - ID của bài hát
   * @returns boolean
   */
  isSongDownloaded(songId: string): boolean {
    return this.currentDownloads.some(d =>
      d.songData?.id === songId && d.status === 'completed'
    );
  }

  /**
   * Lấy download task theo songId
   * @param songId - ID của bài hát
   * @returns DownloadTask | undefined
   */
  getDownloadBySongId(songId: string): DownloadTask | undefined {
    return this.currentDownloads.find(d => d.songData?.id === songId);
  }

  // Private methods
  private updateDownload(id: string, updates: Partial<DownloadTask>) {
    const currentDownloads = this.currentDownloads;
    const downloadIndex = currentDownloads.findIndex(d => d.id === id);

    if (downloadIndex !== -1) {
      currentDownloads[downloadIndex] = {
        ...currentDownloads[downloadIndex],
        ...updates
      };

      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToStorage();
    }
  }

  private startDownload(id: string) {
    const download = this.getDownload(id);
    if (!download) return;

    this.updateDownload(id, { status: 'downloading' });

    const abortController = new AbortController();
    this.activeDownloads.set(id, {
      abort: () => abortController.abort()
    });

    // Sử dụng real download thay vì simulate
    this.realDownload(id, download.url, abortController.signal);
  }
  /**
   * Download thực tế file audio và thumbnail
   * @param id - ID của download task
   * @param audioUrl - URL của file audio (không sử dụng nữa, lấy từ songData)
   * @param signal - AbortSignal để cancel download
   */
  private async realDownload(id: string, audioUrl: string, signal: AbortSignal) {
    try {
      const download = this.getDownload(id);
      if (!download || !download.songData) return;

      console.log('🎵 Starting real download for:', download.title);

      if (Capacitor.getPlatform() === 'web') {
        // Web platform: Download files và lưu vào IndexedDB
        await this.handleWebDownload(id, signal);
      } else {
        // Native platform: Download file thực tế vào filesystem
        await this.handleNativeDownload(id, download.songData.audio_url, signal);
      }

    } catch (error) {
      if (!signal.aborted) {
        console.error('Download error:', error);
        this.failDownload(id, 'Download failed: ' + error);
      }
    }
  }
  /**
   * Xử lý download cho web platform - download cả audio và thumbnail
   * @param id - ID của download task
   * @param signal - AbortSignal
   */
  private async handleWebDownload(id: string, signal: AbortSignal) {
    const download = this.getDownload(id);
    if (!download || !download.songData) return;

    const { songData } = download;
    let totalProgress = 0;

    try {
      // Step 1: Download audio file (60% of total progress)
      console.log('📥 Downloading audio file...');
      this.updateDownloadProgress(id, 10, 'downloading');

      const audioResponse = await fetch(songData.audio_url, { signal });
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      const audioBlob = await audioResponse.blob();
      totalProgress = 40;
      this.updateDownloadProgress(id, totalProgress);

      // Step 2: Download thumbnail (20% of total progress)
      console.log('📥 Downloading thumbnail...');
      const thumbResponse = await fetch(songData.thumbnail_url, { signal });
      if (!thumbResponse.ok) {
        throw new Error(`Failed to fetch thumbnail: ${thumbResponse.status}`);
      }

      const thumbnailBlob = await thumbResponse.blob();
      totalProgress = 60;
      this.updateDownloadProgress(id, totalProgress);

      if (signal.aborted) return;

      // Step 3: Save audio to IndexedDB (10% of total progress)
      console.log('💾 Saving audio to IndexedDB...');
      const audioSaved = await this.indexedDBService.saveAudioFile(
        songData.id,
        audioBlob,
        audioBlob.type || 'audio/mpeg'
      );

      if (!audioSaved) {
        throw new Error('Failed to save audio file to IndexedDB');
      }

      totalProgress = 80;
      this.updateDownloadProgress(id, totalProgress);

      // Step 4: Save thumbnail to IndexedDB (10% of total progress)
      console.log('💾 Saving thumbnail to IndexedDB...');
      const thumbnailSaved = await this.indexedDBService.saveThumbnailFile(
        songData.id,
        thumbnailBlob,
        thumbnailBlob.type || 'image/jpeg'
      );

      if (!thumbnailSaved) {
        throw new Error('Failed to save thumbnail file to IndexedDB');
      }

      totalProgress = 100;
      this.updateDownloadProgress(id, totalProgress);      // Complete download (filePath sẽ là undefined cho web)
      await this.completeDownload(id, undefined);

      console.log('✅ Web download completed for:', songData.title);

    } catch (error) {
      if (!signal.aborted) {
        console.error('Web download error:', error);
        throw error;
      }
    }
  }

  /**
   * Xử lý download cho native platform
   * @param id - ID của download task
   * @param audioUrl - URL của file audio
   * @param signal - AbortSignal
   */
  private async handleNativeDownload(id: string, audioUrl: string, signal: AbortSignal) {
    const download = this.getDownload(id);
    if (!download) return;

    try {
      // Download file từ URL
      const response = await fetch(audioUrl, { signal });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const total = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Unable to read response body');
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      // Đọc file theo chunks và update progress
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (signal.aborted) {
          reader.cancel();
          return;
        }

        chunks.push(value);
        received += value.length;

        // Update progress
        if (total > 0) {
          const progress = Math.round((received / total) * 100);
          this.updateDownloadProgress(id, progress);
        }
      }

      // Combine chunks
      const blob = new Blob(chunks);

      // Lưu file vào device
      const filePath = await this.saveFileToDevice(download, blob);

      // Download và save thumbnail
      await this.downloadThumbnailForNative(download);

      // Complete download
      await this.completeDownload(id, filePath);

    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }

  /**
   * Lưu file vào device (chỉ cho native)
   * @param download - Download task
   * @param blob - File blob
   * @returns Promise<string> - File path
   */
  private async saveFileToDevice(download: DownloadTask, blob: Blob): Promise<string> {
    const safeFileName = this.createSafeFileName(download.title, download.artist);
    const fileName = `${safeFileName}.m4a`;

    // Chuyển blob thành base64
    const base64Data = await this.blobToBase64(blob);

    // Lưu file vào Documents/music/
    const result = await Filesystem.writeFile({
      path: `music/${fileName}`,
      data: base64Data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    console.log('✅ File saved to:', result.uri);
    return result.uri;
  }

  /**
   * Download và lưu thumbnail cho native platform
   * @param download - Download task
   */
  private async downloadThumbnailForNative(download: DownloadTask) {
    if (!download.thumbnail || !download.songData) return;

    try {
      console.log('📸 Downloading thumbnail for native:', download.title);
      const response = await fetch(download.thumbnail);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const thumbnailBlob = await response.blob();

      // Lưu vào SQLite
      const saved = await this.databaseService.saveThumbnailFile(
        download.songData.id,
        thumbnailBlob,
        thumbnailBlob.type || 'image/jpeg'
      );

      if (saved) {
        console.log('✅ Thumbnail saved for native:', download.title);
      } else {
        console.warn('⚠️ Failed to save thumbnail for native:', download.title);
      }

    } catch (error) {
      console.warn('❌ Failed to download thumbnail for native:', error);
    }
  }

  /**
   * Lưu bài hát vào database
   * @param songData - Data từ API
   * @param filePath - Đường dẫn file (optional)
   */
  private async saveSongToDatabase(songData: DataSong, filePath?: string) {
    try {
      // Chuyển đổi DataSong thành Song object
      const song: Song = {
        id: songData.id,
        title: songData.title,
        artist: songData.artist,
        album: undefined,
        duration: songData.duration || 0,
        duration_formatted: songData.duration_formatted,
        thumbnail: songData.thumbnail_url,
        audioUrl: songData.audio_url,
        filePath: filePath,
        addedDate: new Date(),
        isFavorite: false,
        genre: this.extractGenreFromKeywords(songData.keywords || []),
        isDownloaded: true // Đánh dấu đã download
      };

      // Lưu vào database
      const success = await this.databaseService.addSong(song);

      if (success) {
        // Đánh dấu đã download trong search history
        await this.databaseService.markAsDownloaded(songData.id);
        this.refreshService.triggerRefresh();
        console.log('✅ Song saved to database:', songData.title);
      } else {
        console.error('❌ Failed to save song to database');
      }

    } catch (error) {
      console.error('Error saving song to database:', error);
    }
  }

  /**
   * Tạo tên file an toàn
   * @param title - Tên bài hát
   * @param artist - Tên nghệ sĩ
   * @returns string
   */
  private createSafeFileName(title: string, artist: string): string {
    const combined = `${title} - ${artist}`;
    return combined
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  /**
   * Chuyển blob thành base64
   * @param blob - Blob data
   * @returns Promise<string>
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Trích xuất genre từ keywords
   * @param keywords - Mảng từ khóa
   * @returns string | undefined
   */
  private extractGenreFromKeywords(keywords: string[]): string | undefined {
    if (!keywords || keywords.length === 0) return undefined;

    const genreMap: Record<string, string> = {
      'remix': 'Remix',
      'acoustic': 'Acoustic',
      'live': 'Live',
      'cover': 'Cover',
      'piano': 'Piano',
      'guitar': 'Guitar',
      'ballad': 'Ballad',
      'rap': 'Rap',
      'hip hop': 'Hip Hop',
      'pop': 'Pop',
      'rock': 'Rock',
      'jazz': 'Jazz',
      'blues': 'Blues',
      'country': 'Country',
      'classical': 'Classical',
      'electronic': 'Electronic',
      'dance': 'Dance',
      'house': 'House',
      'techno': 'Techno',
      'tiktok': 'TikTok Hit',
      'trending': 'Trending'
    };

    for (const keyword of keywords) {
      const lower = keyword.toLowerCase();
      for (const [key, genre] of Object.entries(genreMap)) {
        if (lower.includes(key)) {
          return genre;
        }
      }
    }

    return 'Nhạc Trẻ';
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private saveDownloadsToStorage() {
    try {
      const downloadsToSave = this.currentDownloads.map(d => ({
        ...d,
        // Don't save large data or sensitive info
      }));

      localStorage.setItem('xtmusic_downloads', JSON.stringify(downloadsToSave));
    } catch (error) {
      console.error('Failed to save downloads to storage:', error);
    }
  }

  private loadDownloadsFromStorage() {
    try {
      const savedDownloads = localStorage.getItem('xtmusic_downloads');
      if (savedDownloads) {
        const downloads: DownloadTask[] = JSON.parse(savedDownloads).map((d: any) => ({
          ...d,
          addedAt: new Date(d.addedAt)
        }));

        // Reset any pending/downloading status to paused on app restart
        const adjustedDownloads = downloads.map(d => ({
          ...d,
          status: (['pending', 'downloading'].includes(d.status) ? 'paused' : d.status) as DownloadTask['status']
        }));

        this.downloadsSubject.next(adjustedDownloads);
      }
    } catch (error) {
      console.error('Failed to load downloads from storage:', error);
    }
  }

  // download youtube video
  getYoutubeUrlInfo(url: string): Observable<YouTubeDownloadResponse> {
    const params = new HttpParams().set('url', url);
    return this.http
      .post<YouTubeDownloadResponse>(`${this.apiUrl}/songs/download`, null, {
        params,
      })
      .pipe(
        catchError((error) => {
          console.error('Error downloading from YouTube:', error);
          throw error;
        })
      );
  }

    validateYoutubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

}
