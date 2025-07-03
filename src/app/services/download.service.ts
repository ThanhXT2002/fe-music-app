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
  SongConverter,
} from '../interfaces/song.interface';
import {
  HttpClient,
  HttpParams,
  HttpErrorResponse,
} from '@angular/common/http';
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
    private refreshService: RefreshService,
    private musicApiService: MusicApiService
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
      url: this.musicApiService.getDownloadUrl(songData.id),
      progress: 0,
      status: 'pending',
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

    try {
      // Step 1: Start with initial progress
      this.updateDownloadProgress(id, 5, 'downloading');

      // Step 2: Download audio file (0-70% of total progress)
      console.log('🎵 Downloading audio for song ID:', songData.id);

      // Start audio download with progress simulation
      const audioDownloadPromise = firstValueFrom(
        this.musicApiService.downloadSongAudio(songData.id, true).pipe(
          timeout(120000) // 2 minutes timeout for mobile
        )
      );

      // Animate progress from 5% to 70% over 15 seconds while downloading
      // This provides better UX while waiting for actual download
      const progressPromise = this.animateProgress(id, 5, 70, 15000);

      // Wait for both audio download and progress animation
      const [audioBlob] = await Promise.all([audioDownloadPromise, progressPromise]);

      if (signal.aborted) return;
      console.log('✅ Audio downloaded successfully');

      // Step 3: Download thumbnail (70-75% of total progress) - optional
      this.updateDownloadProgress(id, 75, 'downloading');

      let thumbnailBlob: Blob | null = null;
      try {
        console.log('🖼️ Downloading thumbnail for song ID:', songData.id);
        // Use MusicApiService for consistent API calls
        thumbnailBlob = await firstValueFrom(
          this.musicApiService.downloadThumbnail(songData.id).pipe(
            timeout(30000) // 30 seconds timeout for thumbnail
          )
        );
        console.log('✅ Thumbnail downloaded successfully');
      } catch (thumbError) {
        console.warn(
          '⚠️ Thumbnail download failed (CORS or network error), continuing without thumbnail:',
          thumbError
        );
        // Continue without thumbnail - this is not critical
      }

      // Step 4: Save audio to IndexedDB (75-95% of total progress)
      this.updateDownloadProgress(id, 85, 'downloading');

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
        console.log('✅ Audio saved to IndexedDB successfully');
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

        console.log('✅ Audio file saved successfully on retry');
        // Audio file saved successfully on retry
      }

      // Step 5: Final steps (95-100% of total progress)
      this.updateDownloadProgress(id, 95, 'downloading');
      await this.animateProgress(id, 95, 100, 500);

      // Note: Thumbnail is now converted to base64 and saved directly in song table
      // No longer saving to separate thumbnailFiles store
      console.log('✅ Download workflow completed (thumbnail handled by caller)');

      this.updateDownloadProgress(id, 100); // Ensure hits 100%
      await this.completeDownload(id);
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
        const easedProgress = progress < 0.5
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
   * @returns Observable<YouTubeDownloadResponse>
   */
  getSongInfo(url: string): Observable<YouTubeDownloadResponse> {
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
  async addSongFromUrl(url: string): Promise<string> {
    try {
      // Step 1: Get song info từ API
      console.log('🔍 Getting song info from URL:', url);
      const response = await firstValueFrom(this.getSongInfo(url));

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to get song info');
      }

      const songData = response.data;
      console.log('✅ Song info received:', songData);

      // Step 2: Save song info ngay lập tức vào database
      await this.saveSongToDatabase(songData);

      // Step 3: Create download task để track progress
      const downloadId = await this.downloadSong(songData);

      return songData.id;
    } catch (error) {
      console.error('❌ Error adding song from URL:', error);
      throw error;
    }
  }

  /**
   * NEW: Poll song status và tự động download khi ready
   * @param songId - ID của bài hát
   * @param maxAttempts - Số lần poll tối đa
   * @returns Promise<boolean> - Success status
   */
  async pollAndDownload(songId: string, maxAttempts: number = 30): Promise<boolean> {
    console.log(`🔄 Starting status polling for song: ${songId}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statusResponse = await firstValueFrom(this.getSongStatus(songId));

        if (!statusResponse.success) {
          console.warn(`⚠️ Status check failed (${attempt}/${maxAttempts}):`, statusResponse.message);
          continue;
        }

        const status = statusResponse.data;
        console.log(`📊 Status check (${attempt}/${maxAttempts}):`, status);

        if (this.musicApiService.isSongReadyForDownload(status)) {
          console.log('✅ Song is ready for download!');

          // Find the download task and trigger actual download
          const downloadTask = this.getDownloadBySongId(songId);
          if (downloadTask) {
            this.startDownload(downloadTask.id);
            return true;
          } else {
            console.warn('⚠️ Download task not found for song:', songId);
            return false;
          }
        } else if (status.status === 'failed') {
          console.error('❌ Song processing failed:', status.error_message);
          return false;
        }

        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error polling status (${attempt}/${maxAttempts}):`, error);

        if (attempt === maxAttempts) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.warn('⚠️ Max polling attempts reached, song may not be ready');
    return false;
  }

  // === LEGACY METHODS (for backwards compatibility) ===

  // download youtube video (LEGACY - use getSongInfo instead)
  getYoutubeUrlInfo(url: string): Observable<YouTubeDownloadResponse> {
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
}
