import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, timeout } from 'rxjs';
import {
  Song,
  DataSong,
  SongsResponse,
  SongConverter,
} from '../interfaces/song.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { MusicApiService } from './api/music-api.service';
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
  private apiUrl = environment.apiUrl;

  private downloadsSubject = new BehaviorSubject<DownloadTask[]>([]);
  public downloads$ = this.downloadsSubject.asObservable();
  // Notification system to prevent duplicates
  private completionNotificationsSubject =
    new BehaviorSubject<CompletionNotification | null>(null);
  public completionNotifications$ =
    this.completionNotificationsSubject.asObservable();

  // Status notifications for ready/failed states
  private statusNotificationsSubject =
    new BehaviorSubject<StatusNotification | null>(null);
  public statusNotifications$ = this.statusNotificationsSubject.asObservable();

  // Track notifications sent to prevent duplicates (persist across app restarts)
  private notificationSentCache = new Set<string>();
  private readyNotificationSentCache = new Set<string>(); // For ready notifications
  private readonly NOTIFICATION_CACHE_KEY = 'download_notifications_sent';
  private readonly READY_NOTIFICATION_CACHE_KEY = 'ready_notifications_sent';

  private activeDownloads = new Map<string, any>();
  constructor(
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private refreshService: RefreshService,
    private musicApiService: MusicApiService
  ) {
    this.initializeDownloads();
    this.loadNotificationCache();
  }

  /**
   * Load notification cache from localStorage to persist across app restarts
   */
  private loadNotificationCache() {
    try {
      // Load completion notifications cache
      const cache = localStorage.getItem(this.NOTIFICATION_CACHE_KEY);
      if (cache) {
        const cacheArray = JSON.parse(cache);
        this.notificationSentCache = new Set(cacheArray);
      }

      // Load ready notifications cache
      const readyCache = localStorage.getItem(
        this.READY_NOTIFICATION_CACHE_KEY
      );
      if (readyCache) {
        const readyCacheArray = JSON.parse(readyCache);
        this.readyNotificationSentCache = new Set(readyCacheArray);
      }
    } catch (error) {
      console.warn('Failed to load notification cache:', error);
    }
  }

  /**
   * Save notification cache to localStorage
   */
  private saveNotificationCache() {
    try {
      const cacheArray = Array.from(this.notificationSentCache);
      localStorage.setItem(
        this.NOTIFICATION_CACHE_KEY,
        JSON.stringify(cacheArray)
      );

      const readyCacheArray = Array.from(this.readyNotificationSentCache);
      localStorage.setItem(
        this.READY_NOTIFICATION_CACHE_KEY,
        JSON.stringify(readyCacheArray)
      );
    } catch (error) {
      console.warn('Failed to save notification cache:', error);
    }
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
      const songId = download.songData.id;
      if (!this.notificationSentCache.has(songId)) {
        this.notificationSentCache.add(songId);
        this.saveNotificationCache();

        const notification: CompletionNotification = {
          songId,
          title: download.title,
          timestamp: Date.now(),
        };
        this.completionNotificationsSubject.next(notification);
      }
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
    this.realDownload(id, abortController.signal);
  }
  /**
   * Download thực tế file audio và thumbnail
   * @param id - ID của download task
   * @param audioUrl - URL của file audio (không sử dụng nữa, lấy từ songData)
   * @param signal - AbortSignal để cancel download
   */
  private async realDownload(id: string, signal: AbortSignal) {
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
  private async handleWebDownload(
    id: string,
    signal: AbortSignal,
    duration?: number
  ) {
    const download = this.getDownload(id);
    if (!download || !download.songData) return;

    const { songData } = download;
    // Ưu tiên lấy duration truyền vào, nếu không có thì lấy từ songData
    const songDuration = duration ?? download.songData.duration;

    let timeoutMs = 120000; // 2 phút mặc định
    let progressDuration = 15000; // 15 giây mặc định
    if (songDuration && songDuration > 1800) {
      // 1800 giây = 30 phút
      timeoutMs = 600000; // 10 phút cho bài hát dài
      progressDuration = 60000;
    }

    try {
      // Bước 1: Khởi tạo tiến trình tải (5%)
      this.updateDownloadProgress(id, 5, 'downloading');

      // Bước 2: Tải file audio (0-70% tiến trình)
      // Tạo promise tải file audio với timeout 2 phút
      const audioDownloadPromise = firstValueFrom(
        this.musicApiService
          .downloadSongAudio(songData.id, true)
          .pipe(timeout(timeoutMs))
      );
      // Tạo hiệu ứng tiến trình từ 5% đến 70%
      const progressPromise = this.animateProgress(id, 5, 70, progressDuration);

      // Đợi cả hai promise hoàn thành (tải file và hiệu ứng tiến trình)
      const [audioBlob] = await Promise.all([
        audioDownloadPromise,
        progressPromise,
      ]);

      if (signal.aborted) return;
      // Đã tải xong file audio

      // Bước 3: Tải thumbnail (70-75% tiến trình) - không bắt buộc
      this.updateDownloadProgress(id, 75, 'downloading');
      let thumbnailBlob: Blob | null = null;
      try {
        // Tải thumbnail, timeout 30 giây
        thumbnailBlob = await firstValueFrom(
          this.musicApiService
            .downloadThumbnail(songData.id)
            .pipe(timeout(30000))
        );
      } catch (thumbError) {
        // Nếu lỗi (CORS, mạng...), chỉ cảnh báo và tiếp tục
        console.warn(
          'Không tải được thumbnail, tiếp tục tải audio:',
          thumbError
        );
      }

      // Bước 4: Lưu file audio vào IndexedDB (75-95% tiến trình)
      this.updateDownloadProgress(id, 85, 'downloading');
      if (signal.aborted) return;

      try {
        // Đảm bảo IndexedDB đã sẵn sàng
        const isReady = await this.indexedDBService.initDB();
        if (!isReady) throw new Error('Không khởi tạo được IndexedDB');

        // Lưu file audio vào IndexedDB
        const audioSaved = await this.indexedDBService.saveAudioFile(
          songData.id,
          audioBlob,
          audioBlob.type || 'audio/mpeg'
        );
        if (!audioSaved)
          throw new Error('Lưu file audio vào IndexedDB thất bại');
      } catch (saveError) {
        // Nếu lưu lỗi, thử lại sau 2 giây
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const retrySuccess = await this.indexedDBService.saveAudioFile(
          songData.id,
          audioBlob,
          audioBlob.type || 'audio/mpeg'
        );
        if (!retrySuccess) {
          throw new Error(
            `Lưu file audio thất bại sau khi thử lại: ${saveError}`
          );
        }
      }

      // Bước 5: Hoàn tất (95-100% tiến trình)
      this.updateDownloadProgress(id, 95, 'downloading');
      await this.animateProgress(id, 95, 100, 500);

      this.updateDownloadProgress(id, 100); // Đảm bảo tiến trình đạt 100%
      await this.completeDownload(id);
    } catch (error) {
      if (signal.aborted) {
        // Nếu người dùng hủy, chỉ log và dừng, không throw lỗi
        console.log('Download đã bị hủy bởi người dùng');
        return;
      }

      // Xử lý lỗi HTTP
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          throw new Error(
            'Lỗi CORS hoặc mạng khi tải. Vui lòng kiểm tra kết nối.'
          );
        } else {
          throw new Error(`Lỗi HTTP ${error.status}: ${error.message}`);
        }
      }

      // Lỗi khác
      throw error;
    }
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

  // === NEW API v3 METHODS ===

  /**
   * NEW: Get song info từ YouTube URL sử dụng API v3
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
   * NEW: Workflow mới - Add song từ YouTube URL với API v3
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
  clearNotificationCache() {
    this.notificationSentCache.clear();
    this.readyNotificationSentCache.clear();
    localStorage.removeItem(this.NOTIFICATION_CACHE_KEY);
    localStorage.removeItem(this.READY_NOTIFICATION_CACHE_KEY);
  }

  /**
   * Check if notification was already sent for a song
   */
  hasNotificationBeenSent(songId: string): boolean {
    return this.notificationSentCache.has(songId);
  }

  /**
   * Check if ready notification was already sent for a song
   */
  hasReadyNotificationBeenSent(songId: string): boolean {
    return this.readyNotificationSentCache.has(songId);
  }

  /**
   * Clear all notification caches and reset polling state
   */
  resetNotificationState() {
    this.clearNotificationCache();
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    this.songStatusMap.clear();
  }

  // === LEGACY METHODS (for backwards compatibility) ===

  // download youtube video (LEGACY - use getSongInfo instead)
  getYoutubeUrlInfo(url: string): Observable<SongsResponse> {
    console.warn('⚠️ getYoutubeUrlInfo is deprecated, use getSongInfo instead');
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
            // Chỉ gửi thông báo "sẵn sàng" một lần cho mỗi bài hát
            if (!this.readyNotificationSentCache.has(songId)) {
              this.readyNotificationSentCache.add(songId);
              this.saveNotificationCache();

              const readyNotification: StatusNotification = {
                songId,
                message: 'Bài hát đã sẵn sàng để tải xuống!',
                type: 'success',
                timestamp: Date.now(),
              };
              this.statusNotificationsSubject.next(readyNotification);
            }
          } else if (status.status === 'failed') {
            console.error('❌ Song processing failed:', status.error_message);
            this.stopStatusPolling(songId);
            // Gửi thông báo lỗi
            const errorNotification: StatusNotification = {
              songId,
              message: `Xử lý thất bại: ${status.error_message}`,
              type: 'error',
              timestamp: Date.now(),
            };
            this.statusNotificationsSubject.next(errorNotification);
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
