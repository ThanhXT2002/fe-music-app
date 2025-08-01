import { Injectable, signal } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  firstValueFrom,
  fromEvent,
  takeUntil,
  timeout,
} from 'rxjs';
import { Song, DataSong, SongsResponse } from '../interfaces/song.interface';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
} from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { MusicApiService } from './api/music-api.service';
import { ToastService } from './toast.service';
import { SongConverter } from '../utils/song.converter';
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
  addedAt: Date;
  // Thêm thông tin từ API
  songData?: DataSong;
}

// Interface for completion notifications
export interface CompletionNotification {
  songId: string;
  title: string;
  timestamp: number;
}

// Interface for status notifications
export interface StatusNotification {
  songId: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private downloadsSubject = new BehaviorSubject<DownloadTask[]>([]);
  public downloads$ = this.downloadsSubject.asObservable();
  // // Track notifications sent to prevent duplicates (persist across app restarts)
  // private notificationSentCache = new Set<string>();
  // private readyNotificationSentCache = new Set<string>(); // For ready notifications
  // private readonly NOTIFICATION_CACHE_KEY = 'download_notifications_sent';
  // private readonly READY_NOTIFICATION_CACHE_KEY = 'ready_notifications_sent';

  private songDownloadedSignal = new BehaviorSubject<{
    songId: string;
    downloaded: boolean;
  } | null>(null);
  public songDownloaded$ = this.songDownloadedSignal.asObservable();

  private activeDownloads = new Map<string, any>();
  public loadingFallbackSongIds = signal<Set<string>>(new Set());

  constructor(
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private refreshService: RefreshService,
    private musicApiService: MusicApiService,
    private toastService: ToastService
  ) {
    this.initializeDownloads();
    // this.loadNotificationCache();
  }

  /**
   * Load notification cache from localStorage to persist across app restarts
   */
  // private loadNotificationCache() {
  //   try {
  //     // Load completion notifications cache
  //     const cache = localStorage.getItem(this.NOTIFICATION_CACHE_KEY);
  //     if (cache) {
  //       const cacheArray = JSON.parse(cache);
  //       this.notificationSentCache = new Set(cacheArray);
  //     }

  //     // Load ready notifications cache
  //     const readyCache = localStorage.getItem(
  //       this.READY_NOTIFICATION_CACHE_KEY
  //     );
  //     if (readyCache) {
  //       const readyCacheArray = JSON.parse(readyCache);
  //       this.readyNotificationSentCache = new Set(readyCacheArray);
  //     }
  //   } catch (error) {
  //     console.warn('Failed to load notification cache:', error);
  //   }
  // }

  /**
   * Save notification cache to localStorage
   */
  // private saveNotificationCache() {
  //   try {
  //     const cacheArray = Array.from(this.notificationSentCache);
  //     localStorage.setItem(
  //       this.NOTIFICATION_CACHE_KEY,
  //       JSON.stringify(cacheArray)
  //     );

  //     const readyCacheArray = Array.from(this.readyNotificationSentCache);
  //     localStorage.setItem(
  //       this.READY_NOTIFICATION_CACHE_KEY,
  //       JSON.stringify(readyCacheArray)
  //     );
  //   } catch (error) {
  //     console.warn('Failed to save notification cache:', error);
  //   }
  // }

  private async initializeDownloads() {
    try {
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
      url: this.musicApiService.getDownloadUrl(songData.id),
      progress: 0,
      status: 'pending',
      addedAt: new Date(),
      songData: songData,
    };
    // Thêm vào danh sách downloads
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
  async completeDownload(id: string) {
    const download = this.getDownload(id);
    if (!download) return;

    this.updateDownload(id, {
      status: 'completed',
      progress: 100,
    });

    // Lưu bài hát vào database nếu có songData
    if (download.songData) {
      await this.saveSongToDatabase(download.songData);
    }

    // Send completion notification only once per song
    if (download.songData?.id) {
      // const songId = download.songData.id;
      this.toastService.success(
          `Bài hát ${download.title} đã được tải xuống thành công!`
        );
      // if (!this.notificationSentCache.has(songId)) {
      //   this.notificationSentCache.add(songId);
      //   this.saveNotificationCache();

      // }
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
  }

  // Get downloads by status
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

  /**
   * Kiểm tra bài hát đã thực sự được tải về (có cả metadata và audio blob)
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async isSongDownloadedDB(songId: string): Promise<boolean> {
    const song = await this.databaseService.getSongById(songId);
    if (!song) {
      this.songDownloadedSignal.next({ songId, downloaded: false });
      return false;
    }
    const hasAudio = await this.indexedDBService.hasFile('audioFiles', songId);
    const result = !!hasAudio;
    this.songDownloadedSignal.next({ songId, downloaded: result });
    return result;
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
    this.realDownload(id, abortController.signal);
  }
  /**
   * Download thực tế file audio và thumbnail
   * @param id - ID của download task
   * @param audioUrl - URL của file audio (không sử dụng nữa, lấy từ songData)
   * @param signal - AbortSignal để cancel download
   */
  private async realDownload(id: string, signal: AbortSignal) {
    const download = this.getDownload(id);
    try {
      if (!download || !download.songData) return;
      // All platforms now use IndexedDB for storage
      await this.handleWebDownload(id, signal);
    } catch (error) {
      if (!signal.aborted) {
        if(!environment.production) {
          console.error('Download error:', error);
        }

        this.handleDownloadFallback(error, download, id);
      }
    }
  }

  /**
   * Fallback khi download lỗi: gọi getSongInfo để server process lại, rồi polling tiếp
   */
  private handleDownloadFallback(
    error: any,
    download: DownloadTask | undefined,
    id: string
  ) {
    // Fallback: Nếu lỗi là not found hoặc not ready thì gọi getSongInfo
    if (
      error?.message?.includes('not found') ||
      error?.message?.includes('not ready')
    ) {
      // Tạo youtube_url từ songId (giả sử có dạng https://youtu.be/{id})
      const songId = download?.songData?.id;
      const youtubeUrl = songId
        ? this.createYoutubeUrlFromId(songId)
        : undefined;
      if (youtubeUrl && songId) {
        this.loadingFallbackSongIds.update((set) => {
          const newSet = new Set(set);
          newSet.add(songId);
          return newSet;
        });
        this.getSongInfo(youtubeUrl).subscribe({
          next: () => {
            this.loadingFallbackSongIds.update(set => {
              const newSet = new Set(set);
              newSet.delete(songId);
              return newSet;
            });
            console.log(`Server đã nhận yêu cầu tải lại bài hát ${songId}`);
            // Sau khi server nhận, tiếp tục polling lại
            if (download?.songData) {
              this.startStatusPolling(download.songData);
            }
          },
          error: (err) => {
            this.toastService.error('Không thể gửi yêu cầu tải bài hát!');
          },
        });
      }
    }
    this.failDownload(id, 'Download failed: ' + error);
  }

  /**
   * Utility: Tạo youtube_url từ songId (dạng https://youtu.be/{id})
   */
  private createYoutubeUrlFromId(songId: string): string {
    return `https://youtu.be/${songId}`;
  }
  /**
   * Xử lý download cho tất cả platforms - download cả audio và thumbnail
   * @param id - ID của download task
   * @param signal - AbortSignal
   */
  // Main handler - clean and readable
  private async handleWebDownload(
    id: string,
    signal: AbortSignal,
    duration?: number
  ) {
    const download = this.getDownload(id);
    if (!download || !download.songData) return;

    const { songData } = download;
    const timeoutMs = this.calculateTimeout(duration ?? songData.duration);

    try {
      // Bước 1: Khởi tạo (1%)
      this.updateDownloadProgress(id, 1, 'downloading');

      // Bước 2: Tải audio (1-91%)
      const audioBlob = await this.downloadAudio(
        songData.id,
        id,
        signal,
        timeoutMs
      );
      if (signal.aborted) return;

      // Bước 3: Tải thumbnail (91-93%)
      await this.downloadThumbnail(songData, download, id);

      // Bước 4: Lưu vào IndexedDB (93-97%)
      await this.saveToIndexedDB(songData.id, audioBlob, id, signal);

      // Bước 5: Hoàn tất (97-100%)
      await this.finalizeDownload(id);
    } catch (error) {
      if (signal.aborted) return;
      throw this.handleDownloadError(error);
    }
  }

  // Tính toán timeout dựa vào duration
  private calculateTimeout(duration?: number): number {
    const DEFAULT_TIMEOUT = 120000; // 2 phút
    const LONG_SONG_TIMEOUT = 600000; // 10 phút
    const LONG_SONG_THRESHOLD = 1800; // 30 phút

    return duration && duration > LONG_SONG_THRESHOLD
      ? LONG_SONG_TIMEOUT
      : DEFAULT_TIMEOUT;
  }

  // Tải audio với real progress
  private async downloadAudio(
    songId: string,
    downloadId: string,
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<Blob> {
    return await this.downloadAudioWithRealProgress(
      songId,
      downloadId,
      signal,
      timeoutMs,
      1, // startProgress
      91 // endProgress
    );
  }

  // Tải thumbnail
  private async downloadThumbnail(
    songData: any,
    download: any,
    downloadId: string
  ): Promise<void> {
    this.updateDownloadProgress(downloadId, 91, 'downloading');

    try {
      const thumbnailBlob = await firstValueFrom(
        this.musicApiService.downloadThumbnail(songData.id).pipe(timeout(30000))
      );

      if (thumbnailBlob) {
        const thumbnailBase64 = await this.processThumbnail(thumbnailBlob);
        download.songData.thumbnail_url = thumbnailBase64;
      }
    } catch (thumbError) {
      console.warn('Không tải được thumbnail, tiếp tục tải audio:', thumbError);
    }
  }

  // Xử lý thumbnail blob thành base64
  private async processThumbnail(thumbnailBlob: Blob): Promise<string> {
    const mimeType = thumbnailBlob.type || 'image/webp';
    const base64 = await this.blobToBase64(thumbnailBlob);
    return `data:${mimeType};base64,${base64}`;
  }

  // Lưu file vào IndexedDB
  private async saveToIndexedDB(
    songId: string,
    audioBlob: Blob,
    downloadId: string,
    signal: AbortSignal
  ): Promise<void> {
    this.updateDownloadProgress(downloadId, 93, 'downloading');
    if (signal.aborted) return;

    try {
      await this.attemptSaveToIndexedDB(songId, audioBlob);
    } catch (saveError) {
      // Retry logic
      await this.retrySaveToIndexedDB(songId, audioBlob, saveError);
    }
  }

  // Thử lưu vào IndexedDB
  private async attemptSaveToIndexedDB(
    songId: string,
    audioBlob: Blob
  ): Promise<void> {
    const isReady = await this.indexedDBService.initDB();
    if (!isReady) throw new Error('Không khởi tạo được IndexedDB');

    const audioSaved = await this.indexedDBService.saveAudioFile(
      songId,
      audioBlob,
      audioBlob.type || 'audio/mpeg'
    );

    if (!audioSaved) {
      throw new Error('Lưu file audio vào IndexedDB thất bại');
    }
  }

  // Retry save logic
  private async retrySaveToIndexedDB(
    songId: string,
    audioBlob: Blob,
    originalError: any
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const retrySuccess = await this.indexedDBService.saveAudioFile(
      songId,
      audioBlob,
      audioBlob.type || 'audio/mpeg'
    );

    if (!retrySuccess) {
      throw new Error(
        `Lưu file audio thất bại sau khi thử lại: ${originalError}`
      );
    }
  }

  // Hoàn tất download
  private async finalizeDownload(downloadId: string): Promise<void> {
    this.updateDownloadProgress(downloadId, 97, 'downloading');
    await this.animateProgress(downloadId, 97, 100, 500);
    this.updateDownloadProgress(downloadId, 100);
    await this.completeDownload(downloadId);
  }

  // Xử lý lỗi download
  private handleDownloadError(error: any): Error {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new Error(
          'Lỗi CORS hoặc mạng khi tải. Vui lòng kiểm tra kết nối.'
        );
      } else {
        return new Error(`Lỗi HTTP ${error.status}: ${error.message}`);
      }
    }
    return error;
  }

  // Hàm helper để xử lý real progress
  private async downloadAudioWithRealProgress(
    songId: string,
    downloadId: string,
    signal: AbortSignal,
    timeoutMs: number,
    startProgress: number,
    endProgress: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const subscription = this.musicApiService
        .downloadSongAudio(songId, true)
        .pipe(
          timeout(timeoutMs),
          takeUntil(fromEvent(signal, 'abort')) // Hủy khi signal abort
        )
        .subscribe({
          next: (event: HttpEvent<Blob>) => {
            if (signal.aborted) {
              subscription.unsubscribe();
              return;
            }

            if (event.type === HttpEventType.DownloadProgress) {
              // Tính toán progress thực
              if (event.total) {
                const percentLoaded = Math.round(
                  (event.loaded / event.total) * 100
                );
                // Map từ 0-100% của download sang startProgress-endProgress
                const mappedProgress =
                  startProgress +
                  (percentLoaded * (endProgress - startProgress)) / 100;
                this.updateDownloadProgress(
                  downloadId,
                  Math.round(mappedProgress),
                  'downloading'
                );
              }
            } else if (event.type === HttpEventType.Response) {
              // Download hoàn thành
              this.updateDownloadProgress(
                downloadId,
                endProgress,
                'downloading'
              );
              resolve(event.body as Blob);
            }
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          },
        });

      // Cleanup khi signal abort
      signal.addEventListener('abort', () => {
        subscription.unsubscribe();
      });
    });
  }

  /**
   * Animate progress between two values over a given duration.
   * Uses exponential easing for more realistic download progress feel
   */
  private animateProgress(
    id: string,
    from: number,
    to: number,
    duration: number
  ) {
    const stepTime = 100; // ms (10fps for smoother but less CPU intensive)
    const steps = duration / stepTime;
    let currentStep = 0;

    return new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        currentStep++;

        // Use exponential easing for more realistic progress feel
        const progress = currentStep / steps;
        const easedProgress =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const current = from + (to - from) * easedProgress;

        if (currentStep >= steps) {
          clearInterval(timer);
          this.updateDownloadProgress(id, to);
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
   */
  private async saveSongToDatabase(songData: DataSong) {
    try {
      // Chuyển đổi DataSong thành Song object using SongConverter
      const song: Song = SongConverter.fromApiData(songData);

      // Set additional fields for downloaded song
      song.addedDate = new Date();
      song.isFavorite = false;
      song.keywords = songData.keywords || [];

      // Gán thumbnail_url nếu có
      if (songData.thumbnail_url) {
        song.thumbnail_url = songData.thumbnail_url;
      }

      // Lưu vào database
      const success = await this.databaseService.addSong(song);

      if (success) {
        this.refreshService.triggerRefresh();
      } else {
        console.error('❌ Failed to save song to database');
      }
    } catch (error) {
      console.error('Error saving song to database:', error);
    }
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

  // === NEW API METHODS ===

  /**
   * Xóa hoàn toàn trạng thái download và polling của một bài hát khi xóa khỏi IndexedDB
   * @param songId - ID của bài hát
   */
  public removeSongDownloadState(songId: string): void {
    // Xóa download task khỏi danh sách
    const currentDownloads = this.currentDownloads.filter(
      (d: DownloadTask) => d.songData?.id !== songId
    );
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToIndexedDB();

    // Xóa polling interval nếu có
    this.stopStatusPolling(songId);

    // Xóa trạng thái khỏi songStatusMap
    this.songStatusMap.delete(songId);

    // // Xóa notification cache nếu có
    // this.notificationSentCache.delete(songId);
    // this.readyNotificationSentCache.delete(songId);
    // this.saveNotificationCache();
  }

  /**
   * NEW: Get song info từ YouTube URL sử dụng API
   * @param url - YouTube URL
   * @returns Observable<SongsResponse>
   */
  getSongInfo(url: string): Observable<SongsResponse> {
    return this.musicApiService.getSongInfo(url);
  }

  /**
   * NEW: Get song status để check xem đã ready download chưa
   * @param songId - ID của bài hát
   * @returns Observable<SongStatusResponse>
   */
  getSongStatus(songId: string) {
    return this.musicApiService.getSongStatus(songId);
  }

  /**
   * NEW: Workflow mới - Add song từ YouTube URL với API
   * 1. Get song info từ URL
   * 2. Save song info ngay lập tức
   * 3. Poll status cho đến khi ready
   * 4. Download khi ready
   * @param url - YouTube URL
   * @returns Promise<string> - Song ID
   */
  // async addSongFromUrl(url: string): Promise<string> {
  //   try {
  //     // Step 1: Get song info từ API
  //     const response = await firstValueFrom(this.getSongInfo(url));

  //     if (!response.success || !response.data) {
  //       throw new Error(response.message || 'Failed to get song info');
  //     }

  //     const songData = response.data;
  //     // Step 2: Save song info ngay lập tức vào database
  //     await this.saveSongToDatabase(songData);

  //     // Step 3: Create download task để track progress
  //     const downloadId = await this.downloadSong(songData);

  //     return songData.id;
  //   } catch (error) {
  //     console.error('❌ Error adding song from URL:', error);
  //     throw error;
  //   }
  // }

  /**
   * NEW: Poll song status và tự động download khi ready
   * @param songId - ID của bài hát
   * @param maxAttempts - Số lần poll tối đa
   * @returns Promise<boolean> - Success status
   */
  // async pollAndDownload(
  //   songId: string,
  //   maxAttempts: number = 60
  // ): Promise<boolean> {

  //   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  //     try {
  //       const statusResponse = await firstValueFrom(this.getSongStatus(songId));

  //       if (!statusResponse.success) {
  //         console.warn(
  //           `⚠️ Status check failed (${attempt}/${maxAttempts}):`,
  //           statusResponse.message
  //         );
  //         continue;
  //       }

  //       const status = statusResponse.data;

  //       if (this.musicApiService.isSongReadyForDownload(status)) {

  //         // Find the download task and trigger actual download
  //         const downloadTask = this.getDownloadBySongId(songId);
  //         if (downloadTask) {
  //           this.startDownload(downloadTask.id);
  //           return true;
  //         } else {
  //           console.warn('⚠️ Download task not found for song:', songId);
  //           return false;
  //         }
  //       } else if (status.status === 'failed') {
  //         console.error('❌ Song processing failed:', status.error_message);
  //         return false;
  //       }

  //       // Wait 2 seconds before next poll
  //       await new Promise((resolve) => setTimeout(resolve, 2000));
  //     } catch (error) {
  //       console.error(
  //         `❌ Error polling status (${attempt}/${maxAttempts}):`,
  //         error
  //       );

  //       if (attempt === maxAttempts) {
  //         throw error;
  //       }

  //       // Wait before retry
  //       await new Promise((resolve) => setTimeout(resolve, 3000));
  //     }
  //   }

  //   console.warn('⚠️ Max polling attempts reached, song may not be ready');
  //   return false;
  // }

  /**
   * Clear notification cache (useful for testing or reset)
   */
  // clearNotificationCache() {
  //   this.notificationSentCache.clear();
  //   this.readyNotificationSentCache.clear();
  //   localStorage.removeItem(this.NOTIFICATION_CACHE_KEY);
  //   localStorage.removeItem(this.READY_NOTIFICATION_CACHE_KEY);
  // }

  /**
   * Check if notification was already sent for a song
   */
  // hasNotificationBeenSent(songId: string): boolean {
  //   return this.notificationSentCache.has(songId);
  // }

  /**
   * Check if ready notification was already sent for a song
   */
  // hasReadyNotificationBeenSent(songId: string): boolean {
  //   return this.readyNotificationSentCache.has(songId);
  // }

  /**
   * Clear all notification caches and reset polling state
   */
  resetNotificationState() {
    // this.clearNotificationCache();
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    this.songStatusMap.clear();
  }

  // === LEGACY METHODS (for backwards compatibility) ===

  // download youtube video (LEGACY - use getSongInfo instead)
  getYoutubeUrlInfo(url: string): Observable<SongsResponse> {
    return this.getSongInfo(url);
  }

  validateYoutubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  // Song status polling - move from page to service
  private pollingIntervals = new Map<string, any>();
  private songStatusMap = new Map<
    string,
    { status: string; progress: number; ready: boolean }
  >();

  // Kiểm tra xem bài hát có đang được polling không
  isPolling(songId: string): boolean {
    const status = this.getSongStatusSync(songId);
    return status
      ? (status.status === 'pending' || status.status === 'processing') &&
          !status.ready
      : false;
  }

  /**
   * Bắt đầu quá trình kiểm tra trạng thái bài hát (polling) - tập trung xử lý tại service
   * @param songId - ID của bài hát
   */
  startStatusPolling(songData: DataSong): void {
    const songId = songData.id;
    // Không bắt đầu polling nếu đã tồn tại hoặc bài hát đã sẵn sàng
    if (this.pollingIntervals.has(songId)) {
      return;
    }

    const pollStatus = async () => {
      try {
        const statusResponse = await firstValueFrom(this.getSongStatus(songId));

        if (statusResponse.success) {
          const status = statusResponse.data;
          const isReady =
            status.status === 'completed' && status.progress === 1;

          // Cập nhật trạng thái vào map
          this.songStatusMap.set(songId, {
            status: status.status,
            progress: Math.round(status.progress * 100),
            ready: isReady,
          });

          if (isReady) {
            this.stopStatusPolling(songId);
            this.downloadSong(songData);
            this.toastService.success('Bài hát đã sẵn sàng để tải xuống!');
            // Chỉ gửi thông báo "sẵn sàng" một lần cho mỗi bài hát
            // if (!this.readyNotificationSentCache.has(songId)) {
            //   this.readyNotificationSentCache.add(songId);
            //   this.saveNotificationCache();
            //   this.toastService.success('Bài hát đã sẵn sàng để tải xuống!');
            // }
          } else if (status.status === 'failed') {
            console.error('❌ Song processing failed:', status.error_message);
            this.stopStatusPolling(songId);
            // Gửi thông báo lỗi

            this.toastService.success(
              `Xử lý thất bại: ${status.error_message}`
            );
          }
        } else {
          console.warn('⚠️ Status check failed:', statusResponse.message);
        }
      } catch (error) {
        console.error('❌ Error polling status:', error);
        // Tiếp tục polling, không dừng lại khi gặp lỗi đơn lẻ
      }
    };

    // Kiểm tra trạng thái ngay lập tức, sau đó lặp lại mỗi 2 giây
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    this.pollingIntervals.set(songId, interval);
  }

  /**
   * Stop polling song status
   * @param songId - ID của bài hát
   */
  stopStatusPolling(songId: string): void {
    const interval = this.pollingIntervals.get(songId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(songId);
    }
  }

  /**
   * Get song status from service
   * @param songId - ID của bài hát
   * @returns Status object or undefined
   */
  getSongStatusSync(songId: string) {
    return this.songStatusMap.get(songId);
  }

  /**
   * Check if song is ready for download
   * @param songId - ID của bài hát
   * @returns boolean
   */
  isSongReadyForDownload(songId: string): boolean {
    const status = this.getSongStatusSync(songId);
    return status?.ready === true;
  }

  /**
   * Clean up polling when service is destroyed
   */
  ngOnDestroy() {
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
  }
}
