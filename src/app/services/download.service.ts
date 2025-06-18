import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable, interval, takeWhile, switchMap, firstValueFrom } from 'rxjs';
import { Song, DataSong, YouTubeDownloadResponse, AudioFile, ThumbnailFile } from '../interfaces/song.interface';
import { HttpClient, HttpParams, HttpEventType } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { environment } from 'src/environments/environment';

// API V3 Interfaces
export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  duration: number;
  duration_formatted: string;
  keywords: string[];
  original_url: string;
  created_at: string;
}

export interface SongStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
  audio_filename?: string;
  thumbnail_filename?: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Enhanced DownloadTask interface for API V3
export interface DownloadTask {
  id: string;
  title: string;
  artist: string;
  originalUrl: string;
  progress: number;
  status: 'pending' | 'processing' | 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
  addedAt: Date;

  // API V3 specific fields
  songInfo?: SongInfo;
  songStatus?: SongStatus;
  isDownloadingToDevice?: boolean; // Whether user manually triggered download

  // Progress tracking
  progressDetails?: DownloadProgressDetails;
}

export interface DownloadProgressDetails {
  phase: 'fetching_info' | 'processing' | 'downloading_audio' | 'downloading_thumbnail' | 'saving' | 'completed';
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  message: string;
  startTime: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private apiUrl = environment.apiUrl;

  private downloadsSubject = new BehaviorSubject<DownloadTask[]>([]);
  public downloads$ = this.downloadsSubject.asObservable();

  private activeDownloads = new Map<string, any>();
  private statusPollingInterval = 2000; // 2 seconds
  private maxPollingAttempts = 150; // 5 minutes total

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
   * API V3: Get song info and start background processing
   * @param youtubeUrl - YouTube URL
   * @returns Promise<SongInfo> - Song info
   */  async getSongInfo(youtubeUrl: string): Promise<SongInfo> {
    try {
      const body = { youtube_url: youtubeUrl };
      const result = await firstValueFrom(this.http.post<ApiResponse<SongInfo>>(
        `${this.apiUrl}/songs/info`,
        body
      ));

      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to get song info');
      }

      return result.data;
    } catch (error) {
      console.error('❌ Error getting song info:', error);
      throw error;
    }
  }
  /**
   * API V3: Check song processing status
   * @param songId - Song ID
   * @returns Promise<SongStatus>
   */  async getSongStatus(songId: string): Promise<SongStatus> {
    try {
      const result = await firstValueFrom(this.http.get<ApiResponse<SongStatus>>(
        `${this.apiUrl}/songs/status/${songId}`
      ));

      if (!result || !result.success) {
        throw new Error(result?.message || 'Failed to get song status');
      }

      return result.data;
    } catch (error) {
      console.error('❌ Error getting song status:', error);
      throw error;
    }
  }/**
   * API V3: Download audio file with chunks (unified for all platforms)
   * @param songId - Song ID
   * @param onProgress - Progress callback
   * @returns Promise<Blob>
   */
  async downloadAudioFile(songId: string, onProgress?: (progress: number) => void): Promise<Blob> {
    try {
      // Use HttpClient with progress tracking
      return new Promise((resolve, reject) => {
        this.http.get(`${this.apiUrl}/songs/download/${songId}`, {
          reportProgress: true,
          observe: 'events',
          responseType: 'blob'
        }).subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress) {
              if (event.total && onProgress) {
                const progress = (event.loaded / event.total) * 100;
                onProgress(progress);
              }
            } else if (event.type === HttpEventType.Response) {
              resolve(event.body as Blob);
            }
          },
          error: (error) => {
            console.error('❌ Error downloading audio file:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error downloading audio file:', error);
      throw error;
    }
  }
  /**
   * API V3: Download thumbnail (optional, can use thumbnail_url instead)
   * @param songId - Song ID
   * @returns Promise<Blob>
   */  async downloadThumbnailFile(songId: string): Promise<Blob> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiUrl}/songs/thumbnail/${songId}`, {
        responseType: 'blob'
      }));

      if (!blob) {
        throw new Error('No thumbnail data received');
      }

      return blob;
    } catch (error) {
      console.error('❌ Error downloading thumbnail file:', error);
      throw error;
    }
  }

  /**
   * Main workflow: Add YouTube URL and start processing
   * @param youtubeUrl - YouTube URL
   * @returns Promise<string> - Task ID
   */
  async addFromYouTubeUrl(youtubeUrl: string): Promise<string> {
    try {
      // Step 1: Get song info immediately
      const songInfo = await this.getSongInfo(youtubeUrl);

      // Step 2: Create download task
      const downloadTask: DownloadTask = {
        id: songInfo.id,
        title: songInfo.title,
        artist: songInfo.artist,
        originalUrl: youtubeUrl,
        progress: 0,
        status: 'pending',
        addedAt: new Date(),
        songInfo: songInfo,
        progressDetails: {
          phase: 'fetching_info',
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          timeRemaining: 0,
          message: 'Đã lấy thông tin bài hát',
          startTime: new Date()
        }
      };

      // Step 3: Add to downloads list
      const currentDownloads = this.currentDownloads;
      const existingIndex = currentDownloads.findIndex(d => d.id === songInfo.id);

      if (existingIndex >= 0) {
        // Update existing task
        currentDownloads[existingIndex] = downloadTask;
      } else {
        // Add new task
        currentDownloads.unshift(downloadTask);
      }

      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToStorage();

      // Step 4: Start status polling
      this.startStatusPolling(songInfo.id);

      return songInfo.id;
    } catch (error) {
      console.error('❌ Error adding from YouTube URL:', error);
      throw error;
    }
  }

  /**
   * Start polling song status until completed or failed
   * @param songId - Song ID
   */
  private startStatusPolling(songId: string): void {
    let attempts = 0;

    const pollSubscription = interval(this.statusPollingInterval)
      .pipe(
        takeWhile(() => attempts < this.maxPollingAttempts),
        switchMap(async () => {
          attempts++;
          return await this.getSongStatus(songId);
        }),
        takeWhile((status: SongStatus) =>
          status.status === 'pending' || status.status === 'processing', true
        )
      )
      .subscribe({
        next: (status: SongStatus) => {
          this.updateTaskStatus(songId, status);

          if (status.status === 'completed' || status.status === 'failed') {
            pollSubscription.unsubscribe();
          }
        },
        error: (error) => {
          console.error('❌ Status polling error:', error);
          this.updateTaskError(songId, `Polling error: ${error.message}`);
          pollSubscription.unsubscribe();
        },
        complete: () => {
          if (attempts >= this.maxPollingAttempts) {
            this.updateTaskError(songId, 'Timeout: Processing took too long');
          }
        }
      });

    // Store subscription for potential cancellation
    this.activeDownloads.set(songId, {
      subscription: pollSubscription,
      type: 'polling'
    });
  }

  /**
   * Update task status from API V3 response
   * @param songId - Song ID
   * @param status - Song status from API
   */
  private updateTaskStatus(songId: string, status: SongStatus): void {
    const currentDownloads = this.currentDownloads;
    const taskIndex = currentDownloads.findIndex(d => d.id === songId);

    if (taskIndex === -1) return;

    const task = currentDownloads[taskIndex];

    // Update task based on status
    task.songStatus = status;
    task.progress = Math.round(status.progress * 100);

    if (status.status === 'pending') {
      task.status = 'pending';
      task.progressDetails = {
        ...task.progressDetails!,
        phase: 'processing',
        message: 'Đang chờ xử lý...'
      };
    } else if (status.status === 'processing') {
      task.status = 'processing';
      task.progressDetails = {
        ...task.progressDetails!,
        phase: 'processing',
        message: 'Đang xử lý file audio...'
      };
    } else if (status.status === 'completed') {
      task.status = 'completed';
      task.progress = 100;
      task.progressDetails = {
        ...task.progressDetails!,
        phase: 'completed',
        message: 'Sẵn sàng tải về'
      };
    } else if (status.status === 'failed') {
      task.status = 'error';
      task.error = status.error_message || 'Unknown error';
      task.progressDetails = {
        ...task.progressDetails!,
        phase: 'completed',
        message: `Lỗi: ${task.error}`
      };
    }

    currentDownloads[taskIndex] = task;
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();
  }

  /**
   * Update task with error
   * @param songId - Song ID
   * @param error - Error message
   */
  private updateTaskError(songId: string, error: string): void {
    const currentDownloads = this.currentDownloads;
    const taskIndex = currentDownloads.findIndex(d => d.id === songId);

    if (taskIndex === -1) return;

    currentDownloads[taskIndex].status = 'error';
    currentDownloads[taskIndex].error = error;
    currentDownloads[taskIndex].progressDetails = {
      ...currentDownloads[taskIndex].progressDetails!,
      message: `Lỗi: ${error}`
    };

    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();
  }

  /**
   * Manually download audio and thumbnail to IndexedDB (for offline use)
   * @param songId - Song ID
   * @returns Promise<boolean>
   */
  async downloadToDevice(songId: string): Promise<boolean> {
    const task = this.getDownload(songId);
    if (!task || !task.songInfo) {
      throw new Error('Task or song info not found');
    }

    if (task.songStatus?.status !== 'completed') {
      throw new Error('Song is not ready for download');
    }

    try {
      // Mark as downloading
      this.updateDownloadProgress(songId, 0, 'downloading');
      this.updateTaskProgress(songId, 'downloading_audio', 'Đang tải audio...');

      // Download audio file
      const audioBlob = await this.downloadAudioFile(songId, (progress) => {
        this.updateDownloadProgress(songId, Math.round(progress * 0.7)); // 70% for audio
      });

      // Save audio to IndexedDB
      await this.indexedDBService.saveAudioFile(songId, audioBlob, 'audio/mpeg');

      this.updateDownloadProgress(songId, 70);
      this.updateTaskProgress(songId, 'downloading_thumbnail', 'Đang tải thumbnail...');      // Download thumbnail (from original URL is usually faster than API endpoint)
      let thumbnailBlob: Blob;
      if (task.songInfo.thumbnail_url) {        try {
          thumbnailBlob = await firstValueFrom(this.http.get(task.songInfo.thumbnail_url, {
            responseType: 'blob'
          }));
        } catch (thumbError) {
          console.warn('Failed to download thumbnail from URL, using API endpoint');
          // Fallback to API endpoint
          thumbnailBlob = await this.downloadThumbnailFile(songId);
        }
      } else {
        thumbnailBlob = await this.downloadThumbnailFile(songId);
      }

      this.updateDownloadProgress(songId, 90);
      this.updateTaskProgress(songId, 'saving', 'Đang lưu vào database...');

      // Save thumbnail to IndexedDB
      await this.indexedDBService.saveThumbnailFile(songId, thumbnailBlob, thumbnailBlob.type);

      // Convert to Song interface and save to database
      const song: Song = {
        id: songId,
        title: task.songInfo.title,
        artist: task.songInfo.artist,
        duration: task.songInfo.duration,
        duration_formatted: task.songInfo.duration_formatted,
        thumbnail: task.songInfo.thumbnail_url,
        audioUrl: `indexeddb://${songId}`, // Special URL to indicate IndexedDB storage
        addedDate: new Date(),
        isFavorite: false
      };

      await this.databaseService.addSong(song);

      this.updateDownloadProgress(songId, 100, 'completed');
      this.updateTaskProgress(songId, 'completed', 'Đã lưu thành công');

      // Mark as downloaded to device
      const currentDownloads = this.currentDownloads;
      const taskIndex = currentDownloads.findIndex(d => d.id === songId);
      if (taskIndex >= 0) {
        currentDownloads[taskIndex].isDownloadingToDevice = true;
      }
      this.downloadsSubject.next(currentDownloads);
      this.saveDownloadsToStorage();

      this.refreshService.triggerRefresh();
      return true;

    } catch (error) {
      console.error('❌ Error downloading to device:', error);
      this.updateDownloadProgress(songId, 0, 'error');
      this.updateTaskError(songId, `Download failed: ${error}`);
      return false;
    }
  }

  /**
   * Update task progress details
   * @param songId - Song ID
   * @param phase - Current phase
   * @param message - Progress message
   */
  private updateTaskProgress(songId: string, phase: DownloadProgressDetails['phase'], message: string): void {
    const currentDownloads = this.currentDownloads;
    const taskIndex = currentDownloads.findIndex(d => d.id === songId);

    if (taskIndex === -1) return;

    const task = currentDownloads[taskIndex];
    if (task.progressDetails) {
      task.progressDetails.phase = phase;
      task.progressDetails.message = message;
    }

    this.downloadsSubject.next(currentDownloads);
  }

  /**
   * Update download progress
   * @param id - Task ID
   * @param progress - Progress percentage (0-100)
   * @param status - Optional status update
   */
  updateDownloadProgress(id: string, progress: number, status?: DownloadTask['status']): void {
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

  /**
   * Get download task by ID
   * @param id - Task ID
   * @returns DownloadTask or undefined
   */
  getDownload(id: string): DownloadTask | undefined {
    return this.currentDownloads.find(d => d.id === id);
  }

  /**
   * Remove download task
   * @param id - Task ID
   */
  removeDownload(id: string): void {
    // Cancel any active operations
    const activeDownload = this.activeDownloads.get(id);
    if (activeDownload) {
      if (activeDownload.subscription) {
        activeDownload.subscription.unsubscribe();
      }
      this.activeDownloads.delete(id);
    }

    // Remove from downloads list
    const currentDownloads = this.currentDownloads.filter(d => d.id !== id);
    this.downloadsSubject.next(currentDownloads);
    this.saveDownloadsToStorage();
  }

  /**
   * Clear all downloads
   */
  clearAllDownloads(): void {
    // Cancel all active operations
    this.activeDownloads.forEach(activeDownload => {
      if (activeDownload.subscription) {
        activeDownload.subscription.unsubscribe();
      }
    });
    this.activeDownloads.clear();

    // Clear downloads list
    this.downloadsSubject.next([]);
    this.saveDownloadsToStorage();
  }

  /**
   * Retry failed download
   * @param id - Task ID
   */
  retryDownload(id: string): void {
    const task = this.getDownload(id);
    if (!task || !task.originalUrl) return;

    // Remove current task and restart
    this.removeDownload(id);
    this.addFromYouTubeUrl(task.originalUrl);
  }

  /**
   * Save downloads to localStorage
   */
  private saveDownloadsToStorage(): void {
    try {
      const downloads = this.currentDownloads.map(d => ({
        ...d,
        // Don't save heavy objects
        progressDetails: undefined
      }));
      localStorage.setItem('txt_music_downloads_v3', JSON.stringify(downloads));
    } catch (error) {
      console.error('❌ Error saving downloads to storage:', error);
    }
  }

  /**
   * Load downloads from localStorage
   */
  private loadDownloadsFromStorage(): void {
    try {
      const stored = localStorage.getItem('txt_music_downloads_v3');
      if (stored) {
        const downloads: DownloadTask[] = JSON.parse(stored);
        // Restore basic progress details for UI
        downloads.forEach(d => {
          if (!d.progressDetails) {
            d.progressDetails = {
              phase: d.status === 'completed' ? 'completed' : 'processing',
              downloadedBytes: 0,
              totalBytes: 0,
              speed: 0,
              timeRemaining: 0,
              message: d.status === 'completed' ? 'Sẵn sàng tải về' : 'Đang xử lý...',
              startTime: d.addedAt
            };
          }
        });
        this.downloadsSubject.next(downloads);
      }
    } catch (error) {
      console.error('❌ Error loading downloads from storage:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Legacy methods for backward compatibility
  addDownload(task: Omit<DownloadTask, 'id' | 'progress' | 'status' | 'addedAt'>): string {
    // Convert to new API
    if (task.originalUrl) {
      this.addFromYouTubeUrl(task.originalUrl);
      return task.title; // Return something for compatibility
    }
    return '';
  }

  // ===== COMPATIBILITY METHODS FOR EXISTING CODE =====

  /**
   * Validate YouTube URL
   * @param url - URL to validate
   * @returns boolean
   */
  validateYoutubeUrl(url: string): boolean {
    if (!url) return false;

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url.trim());
  }

  /**
   * Get YouTube URL info (wrapper for getSongInfo)
   * @param url - YouTube URL
   * @returns Observable<ApiResponse<SongInfo>>
   */
  getYoutubeUrlInfo(url: string): Observable<ApiResponse<SongInfo>> {
    return new Observable(observer => {
      this.getSongInfo(url)
        .then(songInfo => {
          observer.next({
            success: true,
            message: 'Song info retrieved successfully',
            data: songInfo
          });
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Check if song is downloaded
   * @param songId - Song ID
   * @returns boolean
   */
  isSongDownloaded(songId: string): boolean {
    const task = this.getDownload(songId);
    return task?.isDownloadingToDevice === true && task?.status === 'completed';
  }

  /**
   * Download song (wrapper for addFromYouTubeUrl + downloadToDevice)
   * @param songData - DataSong (converted from SongInfo)
   * @returns Promise<string>
   */
  async downloadSong(songData: DataSong): Promise<string> {
    // Convert DataSong to YouTube URL (if available) or use songData.id
    let youtubeUrl = '';
    if (songData.audio_url && songData.audio_url.includes('youtube')) {
      youtubeUrl = songData.audio_url;
    } else if (songData.id) {
      youtubeUrl = `https://youtu.be/${songData.id}`;
    }

    if (!youtubeUrl) {
      throw new Error('Cannot determine YouTube URL from song data');
    }

    // Add task and wait for completion
    const taskId = await this.addFromYouTubeUrl(youtubeUrl);

    // Wait for processing to complete before downloading
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const task = this.getDownload(taskId);
        if (!task) {
          reject(new Error('Task not found'));
          return;
        }

        if (task.status === 'completed') {
          // Auto-download to device
          this.downloadToDevice(taskId)
            .then(() => resolve(taskId))
            .catch(reject);
        } else if (task.status === 'error') {
          reject(new Error(task.error || 'Download failed'));
        } else {
          // Continue polling
          setTimeout(checkStatus, 1000);
        }
      };

      checkStatus();
    });
  }

  /**
   * Get download by song ID
   * @param songId - Song ID
   * @returns DownloadTask or undefined
   */
  getDownloadBySongId(songId: string): DownloadTask | undefined {
    return this.getDownload(songId);
  }

  /**
   * Cancel download (alias for removeDownload)
   * @param id - Task ID
   */
  cancelDownload(id: string): void {
    this.removeDownload(id);
  }

  /**
   * Pause download (not supported in V3, just log)
   * @param id - Task ID
   */
  pauseDownload(id: string): void {
    console.warn('pauseDownload not supported in API V3. Use cancelDownload instead.');
    // Could implement by cancelling and storing progress for later resume
  }

  /**
   * Resume download (alias for retryDownload)
   * @param id - Task ID
   */
  resumeDownload(id: string): void {
    this.retryDownload(id);
  }
}
