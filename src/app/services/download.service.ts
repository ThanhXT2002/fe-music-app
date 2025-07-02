import { Injectable, signal } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  Observable,
  firstValueFrom,
  timeout,
} from 'rxjs';
import {
  Song,
  DataSong,
  YouTubeDownloadResponse,
  AudioFile,
  ThumbnailFile,
} from '../interfaces/song.interface';
import {
  HttpClient,
  HttpParams,
  HttpErrorResponse,
} from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
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
  providedIn: 'root',
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
    this.initializeDownloads();
  }
  
  private async initializeDownloads() {
    try {
      console.log('🔄 Initializing DownloadService...');

      // Đảm bảo IndexedDB được khởi tạo trước khi load downloads
      const isInitialized = await this.indexedDBService.initDB();

      if (isInitialized) {
        // IndexedDB initialized successfully
        await this.loadDownloadsFromIndexedDB();
        // Downloads loaded successfully
      } else {
        console.warn(
          '⚠️ IndexedDB initialization failed, downloads will not persist'
        );
      }
    } catch (error) {
      console.error('❌ Error initializing downloads:', error);
    }
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
    const existingTask = this.currentDownloads.find(
      (d) => d.songData?.id === songData.id && d.status === 'completed'
    );

    if (existingTask) {
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
      songData: songData,
    }; // Thêm vào danh sách downloads
    const currentDownloads = this.currentDownloads;
    currentDownloads.unshift(downloadTask);
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToIndexedDB();

    // Bắt đầu quá trình download
    this.startDownload(downloadTask.id);

    return downloadTask.id;
  }

  // Add a new download task (giữ nguyên method cũ để tương thích)
  addDownload(
    task: Omit<DownloadTask, 'id' | 'progress' | 'status' | 'addedAt'>
  ): string {
    const downloadTask: DownloadTask = {
      ...task,
      id: this.generateId(),
      progress: 0,
      status: 'pending',
      addedAt: new Date(),
    };
    const currentDownloads = this.currentDownloads;
    currentDownloads.unshift(downloadTask);
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToIndexedDB();

    this.startDownload(downloadTask.id);
    return downloadTask.id;
  }
  // Update download progress
  updateDownloadProgress(
    id: string,
    progress: number,
    status?: DownloadTask['status']
  ) {
    const currentDownloads = this.currentDownloads;
    const downloadIndex = currentDownloads.findIndex((d) => d.id === id);

    if (downloadIndex !== -1) {
      currentDownloads[downloadIndex] = {
        ...currentDownloads[downloadIndex],
        progress,
        ...(status && { status }),
      };

      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToIndexedDB();
    }
  }

  // Mark download as completed
  async completeDownload(id: string, filePath?: string) {
    const download = this.getDownload(id);
    if (!download) return;

    this.updateDownload(id, {
      status: 'completed',
      progress: 100,
      filePath,
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
      error,
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
    const currentDownloads = this.currentDownloads.filter((d) => d.id !== id);
    this.downloadsSubject.next(currentDownloads);
    this.activeDownloads.delete(id);
    this.saveDownloadsToIndexedDB();
  }
  // Clear completed downloads
  clearCompleted() {
    const currentDownloads = this.currentDownloads.filter(
      (d) => d.status !== 'completed'
    );
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToIndexedDB();
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
    this.saveDownloadsToIndexedDB();
  }

  // Get download by ID
  getDownload(id: string): DownloadTask | undefined {
    return this.currentDownloads.find((d) => d.id === id);
  } // Get downloads by status
  getDownloadsByStatus(status: DownloadTask['status']): DownloadTask[] {
    return this.currentDownloads.filter((d) => d.status === status);
  }

  /**
   * Kiểm tra xem bài hát đã được download chưa
   * @param songId - ID của bài hát
   * @returns boolean
   */
  isSongDownloaded(songId: string): boolean {
    return this.currentDownloads.some(
      (d) => d.songData?.id === songId && d.status === 'completed'
    );
  }

  /**
   * Lấy download task theo songId
   * @param songId - ID của bài hát
   * @returns DownloadTask | undefined
   */
  getDownloadBySongId(songId: string): DownloadTask | undefined {
    return this.currentDownloads.find((d) => d.songData?.id === songId);
  }

  // Private methods
  private updateDownload(id: string, updates: Partial<DownloadTask>) {
    const currentDownloads = this.currentDownloads;
    const downloadIndex = currentDownloads.findIndex((d) => d.id === id);

    if (downloadIndex !== -1) {
      currentDownloads[downloadIndex] = {
        ...currentDownloads[downloadIndex],
        ...updates,
      };
      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToIndexedDB();
    }
  }

  private startDownload(id: string) {
    const download = this.getDownload(id);
    if (!download) return;

    this.updateDownload(id, { status: 'downloading' });

    const abortController = new AbortController();
    this.activeDownloads.set(id, {
      abort: () => abortController.abort(),
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
  private async realDownload(
    id: string,
    audioUrl: string,
    signal: AbortSignal
  ) {
    try {
      const download = this.getDownload(id);
      if (!download || !download.songData) return;

      // All platforms now use IndexedDB for storage
      await this.handleWebDownload(id, signal);
    } catch (error) {
      if (!signal.aborted) {
        console.error('Download error:', error);
        this.failDownload(id, 'Download failed: ' + error);
      }
    }
  }
  /**
   * Xử lý download cho tất cả platforms - download cả audio và thumbnail
   * @param id - ID của download task
   * @param signal - AbortSignal
   */
  private async handleWebDownload(id: string, signal: AbortSignal) {
    const download = this.getDownload(id);
    if (!download || !download.songData) return;

    const { songData } = download;
    let totalProgress = 0;

    try {
      // Step 1: Download audio file (70% of total progress)
      this.updateDownloadProgress(id, 10, 'downloading');
      // Fake progress to 50% for audio download (2.5s)
      await this.animateProgress(id, 10, 50, 2500);

      console.log('🎵 Downloading audio from:', songData.audio_url);
      const audioBlob = await firstValueFrom(
        this.http
          .get(songData.audio_url, {
            responseType: 'blob',
            headers: {
              Accept: 'audio/*,*/*;q=0.9',
              'User-Agent': 'IonicApp/1.0',
              'Cache-Control': 'no-cache',
            },
          })
          .pipe(
            timeout(120000) // 2 minutes timeout for mobile
          )
      );

      if (signal.aborted) return;
      // Audio downloaded successfully

      // Step 2: Download thumbnail (20% of total progress) - optional
      // Animate progress from 50 to 70% (0.8s)
      await this.animateProgress(id, 50, 70, 800);

      let thumbnailBlob: Blob | null = null;
      try {
        console.log('🖼️ Downloading thumbnail from:', songData.thumbnail_url);
        thumbnailBlob = await firstValueFrom(
          this.http
            .get(songData.thumbnail_url, {
              responseType: 'blob',
              headers: {
                Accept: 'image/*,*/*;q=0.9',
                'Cache-Control': 'no-cache',
              },
            })
            .pipe(
              timeout(30000) // 30 seconds timeout for thumbnail
            )
        );
        // Thumbnail downloaded successfully
      } catch (thumbError) {
        console.warn(
          '⚠️ Thumbnail download failed (CORS or network error), continuing without thumbnail:',
          thumbError
        );
        // Continue without thumbnail - this is not critical
      }

      // Step 3: Save audio to IndexedDB (15% of total progress)
      // Animate progress from 70 to 85% (0.8s)
      await this.animateProgress(id, 70, 85, 800);

      if (signal.aborted) return;
      console.log('💾 Saving audio to IndexedDB...');
      console.log('📊 Audio blob info:', {
        size: audioBlob.size,
        type: audioBlob.type,
        songId: songData.id,
      });

      try {
        // Double check IndexedDB is ready
        const isReady = await this.indexedDBService.initDB();
        if (!isReady) {
          throw new Error('IndexedDB initialization failed');
        }

        const audioSaved = await this.indexedDBService.saveAudioFile(
          songData.id,
          audioBlob,
          audioBlob.type || 'audio/mpeg'
        );
        if (!audioSaved) {
          throw new Error('Failed to save audio file to IndexedDB');
        }
        // Audio saved to IndexedDB successfully
      } catch (saveError) {
        console.error('❌ Error saving audio to IndexedDB:', saveError);

        // Try one more time after a delay if save fails
        console.log('🔄 Retrying save after delay...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const retrySuccess = await this.indexedDBService.saveAudioFile(
          songData.id,
          audioBlob,
          audioBlob.type || 'audio/mpeg'
        );

        if (!retrySuccess) {
          throw new Error(
            `Failed to save audio file after retry: ${saveError}`
          );
        }

        // Audio file saved successfully on retry
      }

      // Step 4: Save thumbnail to IndexedDB (15% of total progress) - optional
      // Animate progress from 85 to 100% (0.6s)
      await this.animateProgress(id, 85, 100, 600);

      if (thumbnailBlob) {
        console.log('💾 Saving thumbnail to IndexedDB...');
        try {
          const thumbnailSaved = await this.indexedDBService.saveThumbnailFile(
            songData.id,
            thumbnailBlob,
            thumbnailBlob.type || 'image/jpeg'
          );

          if (thumbnailSaved) {
            console.log('✅ Thumbnail saved to IndexedDB');
          } else {
            console.warn('⚠️ Failed to save thumbnail, but continuing...');
          }
        } catch (thumbSaveError) {
          console.warn(
            '⚠️ Error saving thumbnail to IndexedDB (non-critical):',
            thumbSaveError
          );
        }
      } else {
        console.log(
          'ℹ️ No thumbnail to save (download failed or CORS blocked)'
        );
      }

      this.updateDownloadProgress(id, 100); // Ensure hits 100%
      await this.completeDownload(id, undefined);
    } catch (error) {
      if (signal.aborted) {
        console.log('ℹ️ Download was aborted by user');
        return; // Don't throw error for user-initiated abort
      }

      // Handle HTTP errors
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          console.error('❌ CORS or network error during download:', error);
          throw new Error(
            'Download blocked by CORS policy or network error. Please check your connection.'
          );
        } else {
          console.error(
            `❌ HTTP error during download: ${error.status}`,
            error
          );
          throw new Error(`HTTP error ${error.status}: ${error.message}`);
        }
      }

      console.error('❌ Web download error:', error);
      throw error;
    }
  }

  /**
   * Animate progress between two values over a given duration.
   */
  private animateProgress(
    id: string,
    from: number,
    to: number,
    duration: number
  ) {
    const stepTime = 16; // ms (60fps)
    const steps = duration / stepTime;
    let current = from;
    const increment = (to - from) / steps;

    return new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        current += increment;
        if (
          (increment > 0 && current >= to) ||
          (increment < 0 && current <= to)
        ) {
          current = to;
          clearInterval(timer);
          this.updateDownloadProgress(id, Math.round(current));
          resolve();
        } else {
          this.updateDownloadProgress(id, Math.round(current));
        }
      }, stepTime);
    });
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
        isDownloaded: true, // Đánh dấu đã download
      }; // Lưu vào database
      const success = await this.databaseService.addSong(song);

      if (success) {
        // No need to call markAsDownloaded since we already set isDownloaded = true
        this.refreshService.triggerRefresh();
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
      remix: 'Remix',
      acoustic: 'Acoustic',
      live: 'Live',
      cover: 'Cover',
      piano: 'Piano',
      guitar: 'Guitar',
      ballad: 'Ballad',
      rap: 'Rap',
      'hip hop': 'Hip Hop',
      pop: 'Pop',
      rock: 'Rock',
      jazz: 'Jazz',
      blues: 'Blues',
      country: 'Country',
      classical: 'Classical',
      electronic: 'Electronic',
      dance: 'Dance',
      house: 'House',
      techno: 'Techno',
      tiktok: 'TikTok Hit',
      trending: 'Trending',
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
  private async saveDownloadsToIndexedDB() {
    try {
      // Đảm bảo IndexedDB đã được khởi tạo
      const isInitialized = await this.indexedDBService.initDB();
      if (!isInitialized) {
        console.warn(
          '⚠️ IndexedDB initialization failed, skipping download saving'
        );
        return;
      }

      const downloadsToSave = this.currentDownloads.map((d) => ({
        ...d,
        // Don't save large data or sensitive info
      }));

      await this.indexedDBService.put('downloads', {
        id: 'downloads',
        tasks: downloadsToSave,
      });
    } catch (error) {
      console.error('Failed to save downloads to IndexedDB:', error);
    }
  }
  private async loadDownloadsFromIndexedDB() {
    try {
      // Đảm bảo IndexedDB đã được khởi tạo
      const isInitialized = await this.indexedDBService.initDB();
      if (!isInitialized) {
        console.warn(
          '⚠️ IndexedDB initialization failed, skipping download loading'
        );
        return;
      }

      const savedData = await this.indexedDBService.get(
        'downloads',
        'downloads'
      );
      if (savedData && savedData.tasks && Array.isArray(savedData.tasks)) {
        const downloads: DownloadTask[] = savedData.tasks.map((d: any) => ({
          ...d,
          addedAt: new Date(d.addedAt),
        }));

        // Reset any pending/downloading status to paused on app restart
        const adjustedDownloads = downloads.map((d) => ({
          ...d,
          status: (['pending', 'downloading'].includes(d.status)
            ? 'paused'
            : d.status) as DownloadTask['status'],
        }));

        this.downloadsSubject.next(adjustedDownloads);
      }
    } catch (error) {
      console.error('Failed to load downloads from IndexedDB:', error);
      // Đặt mảng rỗng nếu không thể load được
      this.downloadsSubject.next([]);
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
