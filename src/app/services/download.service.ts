import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { Song, DataSong, YouTubeDownloadResponse, AudioFile, ThumbnailFile } from '../interfaces/song.interface';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { PermissionService } from './permission.service';
import { NetworkService } from './network.service';
import { YouTubeErrorService } from './youtube-error.service';
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
  // Better progress tracking
  progressDetails?: DownloadProgressDetails;
}

export interface DownloadProgressDetails {
  phase: 'initializing' | 'downloading' | 'saving' | 'processing' | 'completing';
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
  private indexedDBInitialized = false;  constructor(
    private http: HttpClient,
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private refreshService: RefreshService,
    private permissionService: PermissionService,
    private networkService: NetworkService,
    private youtubeErrorService: YouTubeErrorService
  ) {
    this.loadDownloadsFromStorage();
    this.initializeIndexedDB();
  }

  /**
   * Initialize IndexedDB for web platform
   */
  private async initializeIndexedDB() {
    try {
      if (Capacitor.getPlatform() === 'web' && !this.indexedDBInitialized) {
        await this.indexedDBService.initDB();
        this.indexedDBInitialized = true;
        console.log('✅ IndexedDB initialized in DownloadService');
      }
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB in DownloadService:', error);
    }
  }

  /**
   * Ensure IndexedDB is initialized before using it
   */
  private async ensureIndexedDBReady(): Promise<void> {
    if (Capacitor.getPlatform() === 'web' && !this.indexedDBInitialized) {
      await this.initializeIndexedDB();
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
    // Check network connectivity first
    const isOnline = await this.networkService.isOnline();
    if (!isOnline) {
      throw new Error('Không có kết nối internet. Vui lòng kiểm tra và thử lại.');
    }

    // Kiểm tra xem bài hát đã được download chưa
    const existingTask = this.currentDownloads.find(d =>
      d.songData?.id === songData.id && d.status === 'completed'
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
      songData: songData
    };

    // Thêm vào danh sách downloads
    const currentDownloads = this.currentDownloads;
    currentDownloads.unshift(downloadTask);
    this.downloadsSubject.next(currentDownloads);

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
    }  }

  // Mark download as completed
  async completeDownload(id: string, filePath?: string, skipSongSave: boolean = false) {
    const download = this.getDownload(id);
    if (!download) return;

    try {
      // Validate file nếu có filePath (native platform)
      if (filePath) {
        const isValid = await this.validateDownloadedFile(filePath);
        if (!isValid) {
          throw new Error('Downloaded file validation failed');
        }
      }

      // Update download status với progress tracking chi tiết
      this.updateDownloadProgressWithDetails(id, 100, 'completed',
        filePath ? 'File saved to device' : 'Saved to browser storage');

      // Lưu bài hát vào database nếu có songData (chỉ khi không skip)
      if (!skipSongSave && download.songData) {
        await this.saveSongToDatabase(download.songData, filePath);
        console.log('✅ Song saved to database:', download.title);
      }

      // Remove from active downloads
      this.activeDownloads.delete(id);

      // Trigger refresh để update UI
      this.refreshService.triggerRefresh();

    } catch (error) {
      console.error('❌ Failed to complete download:', error);
      this.failDownload(id, `Completion failed: ${error}`);
    }
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
  }

  // Clear completed downloads
  clearCompleted() {
    const currentDownloads = this.currentDownloads.filter(d => d.status !== 'completed');
    this.downloadsSubject.next(currentDownloads);
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
  }

  // Get download by ID
  getDownload(id: string): DownloadTask | undefined {
    return this.currentDownloads.find(d => d.id === id);
  }  // Get downloads by status
  getDownloadsByStatus(status: DownloadTask['status']): DownloadTask[] {
    return this.currentDownloads.filter(d => d.status === status);
  }
  /**
   * Kiểm tra xem bài hát đã được download chưa (dựa vào database)
   * @param songId - ID của bài hát
   * @returns boolean
   */
  isSongDownloaded(songId: string): boolean {
    // Kiểm tra trong memory cache trước (nhanh hơn)
    const inProgress = this.currentDownloads.some(d =>
      d.songData?.id === songId && d.status === 'completed'
    );

    if (inProgress) {
      return true;
    }

    // Kiểm tra trong database (sẽ cần async, nhưng để backward compatibility với method sync)
    // Note: Trong tương lai nên chuyển thành async method
    return false; // Tạm thời return false, logic chính sẽ dùng async check
  }

  /**
   * Kiểm tra async xem bài hát đã được download chưa (dựa vào database)
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async isSongDownloadedAsync(songId: string): Promise<boolean> {
    try {
      const song = await this.databaseService.getSongById(songId);
      return !!song && !!song.filePath;
    } catch (error) {
      console.error('Error checking song download status:', error);
      return false;
    }
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
      this.updateDownloadProgress(id, 10, 'downloading');

      const audioResponse = await fetch(songData.audio_url, { signal });
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }

      const audioBlob = await audioResponse.blob();
      totalProgress = 40;
      this.updateDownloadProgress(id, totalProgress);

      // Step 2: Download thumbnail (20% of total progress)
      const thumbResponse = await fetch(songData.thumbnail_url, { signal });
      if (!thumbResponse.ok) {
        throw new Error(`Failed to fetch thumbnail: ${thumbResponse.status}`);
      }

      const thumbnailBlob = await thumbResponse.blob();
      const thumbnailType = thumbnailBlob.type || 'image/jpeg';
      totalProgress = 60;
      this.updateDownloadProgress(id, totalProgress);

      if (signal.aborted) return;      // Step 3: Ensure IndexedDB is initialized and save audio (10% of total progress)
      let audioSaved = false;
      try {
        // Ensure IndexedDB is ready before saving
        await this.ensureIndexedDBReady();

        audioSaved = await this.indexedDBService.saveAudioFile(
          songData.id,
          audioBlob,
          audioBlob.type || 'audio/mpeg'
        );
      } catch (err: any) {
        console.error('Failed to save audio file to IndexedDB:', err);
        throw new Error('Failed to save audio file to IndexedDB: ' + (err && (err.message || err.toString()) || err));
      }

      if (!audioSaved) {
        throw new Error('Failed to save audio file to IndexedDB');
      }

      totalProgress = 80;
      this.updateDownloadProgress(id, totalProgress);      // Step 4: Save thumbnail to IndexedDB (10% of total progress)
      let thumbnailSaved = false;
      try {
        console.log('🖼️ Saving thumbnail to IndexedDB:', {
          songId: songData.id,
          thumbnailType,
          blobSize: thumbnailBlob.size
        });

        // IndexedDB is already initialized from the previous step
        thumbnailSaved = await this.indexedDBService.saveThumbnailFile(
          songData.id,
          thumbnailBlob,
          thumbnailType
        );

        console.log('✅ Thumbnail saved to IndexedDB:', thumbnailSaved);
      } catch (err: any) {
        console.error('❌ Failed to save thumbnail file to IndexedDB:', err);
        throw new Error('Failed to save thumbnail file to IndexedDB: ' + (err && (err.message || err.toString()) || err));
      }

      if (!thumbnailSaved) {
        throw new Error('Failed to save thumbnail file to IndexedDB');
      }

      totalProgress = 100;
      this.updateDownloadProgress(id, totalProgress);
      // Complete download (filePath sẽ là undefined cho web)
      await this.completeDownload(id, undefined);

    } catch (error: any) {
      if (!signal.aborted) {
        let msg = error?.message || error?.toString() || 'Unknown error';
        if (msg.includes('QuotaExceededError')) {
          msg = 'Bộ nhớ trình duyệt đã đầy, không thể lưu thêm bài hát.';
        }
        this.failDownload(id, 'Web download error: ' + msg);
        console.error('Web download error:', error);
      }
    }
  }
  /**
   * Xử lý download cho native platform
   * @param id - ID của download task
   * @param audioUrl - URL của file audio
   * @param signal - AbortSignal
   */  private async handleNativeDownload(id: string, audioUrl: string, signal: AbortSignal) {
    const download = this.getDownload(id);
    if (!download) return;

    try {
      // Bước 1: Kiểm tra storage permissions
      this.updateDownloadProgressWithDetails(id, 5, 'downloading', 'Kiểm tra quyền truy cập...');
      const hasStoragePermission = await this.checkStoragePermissions();

      if (!hasStoragePermission) {
        throw new Error('Storage permission denied. Please enable storage access in app settings.');
      }

      // Bước 2: Đảm bảo thư mục tồn tại
      await this.ensureMusicDirectoryExists();
      this.updateDownloadProgressWithDetails(id, 10, 'downloading', 'Chuẩn bị thư mục...');

      // Bước 3: Download file từ URL
      this.updateDownloadProgressWithDetails(id, 15, 'downloading', 'Bắt đầu tải file...');
      const response = await fetch(audioUrl, { signal });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }      const total = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Unable to read response body');
      }

      // Initialize detailed progress tracking
      this.initializeProgressDetails(id, total);

      const chunks: Uint8Array[] = [];
      let received = 0;

      // Đọc file theo chunks với detailed progress tracking
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (signal.aborted) {
          reader.cancel();
          return;
        }

        chunks.push(value);
        received += value.length;        // Update progress với speed calculation (15% -> 80%)
        if (total > 0) {
          this.updateProgressWithSpeed(id, received, total, 'downloading');
        }
      }      // Bước 4: Combine chunks và lưu file (80% -> 85%)
      this.updateDownloadProgressWithDetails(id, 80, 'downloading', 'Đang lưu file...', { phase: 'saving' });
      const blob = new Blob(chunks);
      const filePath = await this.saveFileToDevice(download, blob);

      // Bước 4.5: Verify file integrity (85% -> 87%)
      this.updateDownloadProgressWithDetails(id, 85, 'downloading', 'Kiểm tra file...', { phase: 'saving' });
      const isValid = await this.verifyAudioFileIntegrity(filePath);
      if (!isValid) {
        throw new Error('Downloaded file is corrupted or invalid');
      }
      console.log('✅ Audio file verification passed');

      // Bước 5: Lưu song vào database TRƯỚC (87% -> 90%)
      this.updateDownloadProgressWithDetails(id, 87, 'downloading', 'Lưu vào database...', { phase: 'processing' });
      if (download.songData) {
        await this.saveSongToDatabase(download.songData, filePath);
        console.log('✅ Song saved to database:', download.title);
      }

      // Bước 6: Download thumbnail SAU KHI song đã có trong DB (90% -> 95%)
      this.updateDownloadProgressWithDetails(id, 90, 'downloading', 'Tải thumbnail...', { phase: 'processing' });
      await this.downloadThumbnailForNative(download);

      // Bước 7: Complete download (95% -> 100%)
      this.updateDownloadProgressWithDetails(id, 95, 'downloading', 'Hoàn thành...', { phase: 'completing' });

      // Update download status
      this.updateDownloadProgressWithDetails(id, 100, 'completed', 'Hoàn thành!');

      // Remove from active downloads
      this.activeDownloads.delete(id);

      // Trigger refresh để update UI
      this.refreshService.triggerRefresh();

    } catch (error) {
      if (!signal.aborted) {
        console.error('❌ Native download failed:', error);
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

    try {
      // Đảm bảo thư mục music tồn tại
      await this.ensureMusicDirectoryExists();

      // Chuyển blob thành base64
      const base64Data = await this.blobToBase64(blob);      // Lưu file vào thư mục phù hợp theo platform
      const result = await Filesystem.writeFile({
        path: `TxtMusic/${fileName}`,
        data: base64Data,
        directory: Directory.Cache, // Luôn dùng Cache cho consistency
        // Bỏ encoding vì đây là binary data (base64)
      });

      console.log('✅ File saved to:', result.uri);
      return result.uri;

    } catch (error) {
      console.error('❌ Failed to save file to device:', error);
      throw new Error(`Failed to save audio file: ${error}`);
    }
  }
  /**
   * Download và lưu thumbnail cho native platform
   * @param download - Download task
   */
  private async downloadThumbnailForNative(download: DownloadTask) {
    if (!download.thumbnail || !download.songData) return;

    try {
      console.log('🖼️ Starting thumbnail download for native:', {
        songId: download.songData.id,
        title: download.title,
        thumbnailUrl: download.thumbnail
      });

      const response = await fetch(download.thumbnail);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const thumbnailBlob = await response.blob();
      console.log('📷 Thumbnail downloaded:', {
        size: thumbnailBlob.size,
        type: thumbnailBlob.type
      });

      // Lưu vào SQLite
      const saved = await this.databaseService.saveThumbnailFile(
        download.songData.id,
        thumbnailBlob,
        thumbnailBlob.type || 'image/jpeg'
      );

      if (saved) {
        console.log('✅ Thumbnail saved to SQLite for:', download.title);
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
    try {      // Chuyển đổi DataSong thành Song object
    const song: Song = {
        id: songData.id,
        title: songData.title,
        artist: songData.artist,
        album: undefined,
        duration: songData.duration || 0,
        duration_formatted: songData.duration_formatted,
        // 🔄 Không lưu server URL, chỉ lưu metadata và file path
        thumbnail: '', // Thumbnail sẽ được lưu riêng và load theo cách khác
        audioUrl: '', // Không lưu URL streaming, chỉ phụ thuộc vào file đã tải về
        filePath: filePath,
        addedDate: new Date(),
        isFavorite: false,
        genre: this.extractGenreFromKeywords(songData.keywords || [])
      };
      console.log('💾 Saving song to database:');
      console.log('- Platform:', Capacitor.getPlatform());
      console.log('- filePath:', song.filePath);
      console.log('- Using streaming URL:', false);

      // Lưu vào database
      const success = await this.databaseService.addSong(song);

      if (success) {
        // Đánh dấu đã download trong search history
        await this.databaseService.markAsDownloaded(songData.id);
        this.refreshService.triggerRefresh();
        console.log('✅ Song saved to database successfully');
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

  /**
   * Đảm bảo thư mục TxtMusic tồn tại
   */
  private async ensureMusicDirectoryExists(): Promise<void> {
    try {
      const directory = Capacitor.getPlatform() === 'android' ? Directory.Cache : Directory.Documents;

      // Kiểm tra xem thư mục có tồn tại không
      try {
        await Filesystem.stat({
          path: 'TxtMusic',
          directory: directory
        });
        console.log('✅ TxtMusic directory exists');
      } catch (error) {
        // Thư mục không tồn tại, tạo mới
        console.log('📁 Creating TxtMusic directory...');
        await Filesystem.mkdir({
          path: 'TxtMusic',
          directory: directory,
          recursive: true
        });
        console.log('✅ TxtMusic directory created');
      }
    } catch (error) {
      console.error('❌ Failed to ensure music directory exists:', error);
      throw new Error(`Failed to create music directory: ${error}`);
    }
  }
  /**
   * Lấy thông tin về storage và permissions
   */
  private async getStorageInfo(): Promise<{
    hasPermission: boolean;
    directory: Directory;
    path: string;
  }> {
    const platform = Capacitor.getPlatform();

    if (platform === 'android') {
      // Trên Android, sử dụng Cache directory (không cần permission)
      return {
        hasPermission: true,
        directory: Directory.Cache,
        path: 'TxtMusic'
      };
    } else if (platform === 'ios') {
      // Trên iOS, sử dụng Documents
      return {
        hasPermission: true,
        directory: Directory.Documents,
        path: 'TxtMusic'
      };
    } else {
      // Web fallback (không sử dụng filesystem)
      throw new Error('Filesystem not supported on web platform');
    }
  }  /**
   * Kiểm tra và yêu cầu storage permissions
   */
  private async checkStoragePermissions(): Promise<boolean> {
    try {
      // Với Directory.Cache trên Android, không cần permission check
      if (Capacitor.getPlatform() === 'android') {
        console.log('✅ Using Directory.Cache on Android - no permissions needed');
        return true;
      }      // Cho iOS và các platform khác
      const permissionResult = await this.permissionService.checkStoragePermissions();

      if (!permissionResult.granted) {
        console.error('❌ Storage permission denied:', permissionResult.message);
        return false;
      }

      // Test write một file nhỏ để đảm bảo filesystem hoạt động
      try {
        const storageInfo = await this.getStorageInfo();

        // Test write một file nhỏ
        const testResult = await Filesystem.writeFile({
          path: 'TxtMusic/.test',
          data: 'test',
          directory: storageInfo.directory,
          encoding: Encoding.UTF8
        });

        // Xóa file test
        await Filesystem.deleteFile({
          path: 'TxtMusic/.test',
          directory: storageInfo.directory
        });

        console.log('✅ Storage test write successful');
        return true;

      } catch (writeError) {
        console.error('❌ Storage test write failed:', writeError);
        return false;
      }

    } catch (error) {
      console.error('❌ Error checking storage permissions:', error);
      return false;
    }
  }  // download youtube video
  getYoutubeUrlInfo(url: string): Observable<YouTubeDownloadResponse> {
    // Check network connectivity
    return new Observable(observer => {
      this.networkService.isOnline().then(isOnline => {
        if (!isOnline) {
          observer.error(new Error('Không có kết nối internet. Vui lòng kiểm tra và thử lại.'));
          return;
        }        const params = new HttpParams().set('url', url);

        // Platform-specific configuration
        const isNative = Capacitor.isNativePlatform();
        const platform = Capacitor.getPlatform();

        let headers: any = {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };

        // Add native-specific headers for better server communication
        if (isNative) {
          headers = {
            ...headers,
            'X-Platform': platform,
            'X-Request-Type': 'youtube-download',
            'X-Client-Version': '1.0.0',
            // Signal server that this is a native request that may need longer processing
            'X-Timeout-Extended': 'true'
          };
        }

        this.http
          .post<YouTubeDownloadResponse>(`${this.apiUrl}/songs/download`, null, {
            params,
            headers
          })
          .pipe(            catchError((error) => {
              console.error('Error downloading from YouTube:', error);

              // Sử dụng YouTube Error Service để phân tích lỗi
              const errorMessage = this.youtubeErrorService.formatUserMessage(error);

              // Log chi tiết cho debug
              const analysis = this.youtubeErrorService.analyzeYouTubeError(error);
              console.error('YouTube Error Analysis:', {
                status: error.status,
                message: analysis.message,
                suggestions: analysis.suggestions,
                canRetry: analysis.canRetry,
                severity: analysis.severity
              });

              throw new Error(errorMessage);
            })
          )
          .subscribe(observer);
      }).catch(error => {
        observer.error(error);
      });
    });
  }

    validateYoutubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }
  /**
   * Cải thiện progress tracking với thông tin chi tiết
   */
  private updateDownloadProgressWithDetails(
    id: string,
    progress: number,
    status?: DownloadTask['status'],
    details?: string,
    progressDetails?: Partial<DownloadProgressDetails>
  ) {
    const downloads = this.currentDownloads;
    const downloadIndex = downloads.findIndex(d => d.id === id);

    if (downloadIndex !== -1) {
      const currentDownload = downloads[downloadIndex];

      downloads[downloadIndex] = {
        ...currentDownload,
        progress: Math.min(Math.max(progress, 0), 100), // Clamp between 0-100
        status: status || currentDownload.status,
        error: status === 'error' ? details : undefined,        progressDetails: progressDetails ? {
          phase: progressDetails.phase || currentDownload.progressDetails?.phase || 'downloading',
          downloadedBytes: progressDetails.downloadedBytes ?? currentDownload.progressDetails?.downloadedBytes ?? 0,
          totalBytes: progressDetails.totalBytes ?? currentDownload.progressDetails?.totalBytes ?? 0,
          speed: progressDetails.speed ?? currentDownload.progressDetails?.speed ?? 0,
          timeRemaining: progressDetails.timeRemaining ?? currentDownload.progressDetails?.timeRemaining ?? 0,
          message: details || progressDetails.message || currentDownload.progressDetails?.message || '',
          startTime: progressDetails.startTime || currentDownload.progressDetails?.startTime || new Date()
        } : currentDownload.progressDetails
      };

      this.downloadsSubject.next([...downloads]);

      // Log progress cho debugging
      if (progress % 10 === 0 || status === 'completed' || status === 'error') {
        console.log(`📊 Download ${id}: ${progress}% ${status ? `(${status})` : ''} ${details ? `- ${details}` : ''}`);
      }
    }
  }

  /**
   * Khởi tạo progress details cho download mới
   */
  private initializeProgressDetails(id: string, totalBytes: number = 0) {
    const details: DownloadProgressDetails = {
      phase: 'initializing',
      downloadedBytes: 0,
      totalBytes,
      speed: 0,
      timeRemaining: 0,
      message: 'Khởi tạo download...',
      startTime: new Date()
    };

    this.updateDownloadProgressWithDetails(id, 0, 'downloading', undefined, details);
  }

  /**
   * Cập nhật progress với tính toán speed và time remaining
   */
  private updateProgressWithSpeed(
    id: string,
    downloadedBytes: number,
    totalBytes: number,
    phase: DownloadProgressDetails['phase'] = 'downloading'
  ) {
    const download = this.getDownload(id);
    if (!download?.progressDetails) return;

    const now = new Date();
    const elapsed = (now.getTime() - download.progressDetails.startTime.getTime()) / 1000; // seconds
    const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
    const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

    let timeRemaining = 0;
    if (speed > 0 && totalBytes > downloadedBytes) {
      timeRemaining = (totalBytes - downloadedBytes) / speed;
    }

    const progressDetails: Partial<DownloadProgressDetails> = {
      phase,
      downloadedBytes,
      totalBytes,
      speed,
      timeRemaining,
      message: this.getPhaseMessage(phase, progress, speed, timeRemaining)
    };

    this.updateDownloadProgressWithDetails(id, progress, 'downloading', undefined, progressDetails);
  }

  /**
   * Tạo message phù hợp cho từng phase
   */
  private getPhaseMessage(
    phase: DownloadProgressDetails['phase'],
    progress: number,
    speed: number,
    timeRemaining: number
  ): string {
    switch (phase) {
      case 'initializing':
        return 'Đang khởi tạo...';
      case 'downloading':
        const speedMB = speed / (1024 * 1024);
        const timeStr = this.formatTime(timeRemaining);
        return `${progress}% - ${speedMB.toFixed(1)} MB/s - ${timeStr} còn lại`;
      case 'saving':
        return 'Đang lưu file...';
      case 'processing':
        return 'Đang xử lý...';
      case 'completing':
        return 'Hoàn thành...';
      default:
        return '';
    }
  }

  /**
   * Format thời gian còn lại
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  /**
   * Lấy thông tin chi tiết về file đã lưu
   */
  private async getFileInfo(filePath: string): Promise<{
    size: number;
    exists: boolean;
    uri: string;
  }> {
    try {
      // Extract path và directory từ URI
      const storageInfo = await this.getStorageInfo();
      const fileName = filePath.split('/').pop() || '';

      const stat = await Filesystem.stat({
        path: `${storageInfo.path}/${fileName}`,
        directory: storageInfo.directory
      });

      return {
        size: stat.size,
        exists: true,
        uri: filePath
      };
    } catch (error) {
      console.warn('⚠️ Failed to get file info:', error);
      return {
        size: 0,
        exists: false,
        uri: filePath
      };
    }
  }

  /**
   * Validate downloaded file
   */
  private async validateDownloadedFile(filePath: string, expectedSize?: number): Promise<boolean> {
    try {
      const fileInfo = await this.getFileInfo(filePath);

      if (!fileInfo.exists) {
        console.error('❌ Downloaded file does not exist');
        return false;
      }

      if (expectedSize && fileInfo.size < expectedSize * 0.9) { // Allow 10% tolerance
        console.error('❌ Downloaded file size mismatch:', fileInfo.size, 'expected:', expectedSize);
        return false;
      }

      console.log('✅ Downloaded file validated:', fileInfo);
      return true;
    } catch (error) {
      console.error('❌ Failed to validate downloaded file:', error);
      return false;
    }
  }

  /**
   * Debug method để kiểm tra local files
   */
  async debugLocalFiles(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('🌐 Web platform - files stored in IndexedDB');
      return;
    }

    try {
      const directory = Capacitor.getPlatform() === 'android' ? Directory.Cache : Directory.Documents;

      console.log('📂 Checking TxtMusic directory...');

      // List files in TxtMusic directory
      const files = await Filesystem.readdir({
        path: 'TxtMusic',
        directory: directory
      });

      console.log('📁 Files in TxtMusic directory:', files.files.length);

      files.files.forEach((file, index) => {
        console.log(`📄 ${index + 1}. ${file.name} (${file.type}) - ${file.size || 'unknown size'} bytes`);
      });

      if (files.files.length === 0) {
        console.log('❌ No files found in TxtMusic directory');

        // Try to create a test file to verify write permissions
        try {
          const testResult = await Filesystem.writeFile({
            path: 'TxtMusic/test.txt',
            data: 'test file content',
            directory: directory,
            encoding: Encoding.UTF8
          });

          console.log('✅ Test file created successfully:', testResult.uri);

          // Delete test file
          await Filesystem.deleteFile({
            path: 'TxtMusic/test.txt',
            directory: directory
          });

          console.log('🗑️ Test file deleted');

        } catch (testError) {
          console.error('❌ Failed to create test file:', testError);
        }
      }

    } catch (error) {
      console.error('❌ Error checking local files:', error);
    }
  }

  /**
   * Verify if a downloaded song file actually exists
   */  async verifyDownloadedFile(song: Song): Promise<{
    exists: boolean;
    fileSize?: number;
    filePath?: string;
    error?: string;
  }> {
    // Kiểm tra bài hát có trong database không
    const dbSong = await this.databaseService.getSongById(song.id);
    if (!dbSong || !dbSong.filePath) {
      return { exists: false, error: 'Song not found in database or no file path' };
    }

    if (!Capacitor.isNativePlatform()) {      // For web, check IndexedDB (simplified check)
      try {
        // Assume exists if found in database for web platform
        return { exists: true, filePath: 'IndexedDB' };
      } catch (error) {
        return { exists: false, error: `IndexedDB error: ${error}` };
      }    }

    try {
      // Extract filename from filePath URI
      const uriParts = dbSong.filePath.split('/');
      const fileName = uriParts[uriParts.length - 1];
      const directory = Capacitor.getPlatform() === 'android' ? Directory.Cache : Directory.Documents;

      // Check if file exists
      const stat = await Filesystem.stat({
        path: `TxtMusic/${fileName}`,
        directory: directory
      });

      return {
        exists: true,
        fileSize: stat.size,
        filePath: dbSong.filePath
      };

    } catch (error) {
      console.error('❌ File verification failed:', error);
      return {
        exists: false,
        filePath: dbSong.filePath,
        error: `File verification failed: ${error}`
      };
    }
  }

  /**
   * Verify downloaded audio file integrity
   * @param filePath - Local file path
   * @returns Promise<boolean>
   */
  private async verifyAudioFileIntegrity(filePath: string): Promise<boolean> {
    try {
      const fileName = filePath.includes('/') ? filePath.split('/').pop() || '' : filePath;

      console.log('🔍 Verifying audio file integrity:', fileName);

      // Check if file exists and get stats
      const stat = await Filesystem.stat({
        path: `TxtMusic/${fileName}`,
        directory: Directory.Cache
      });

      console.log('📊 File stats:', stat);

      // Check file size (should be > 0)
      if (stat.size === 0) {
        console.error('❌ File is empty');
        return false;
      }

      // Try to read a small portion of the file to ensure it's readable
      const testRead = await Filesystem.readFile({
        path: `TxtMusic/${fileName}`,
        directory: Directory.Cache
      });

      if (!testRead.data) {
        console.error('❌ File data is empty');
        return false;
      }

      console.log('✅ File integrity check passed');
      return true;

    } catch (error) {
      console.error('❌ File integrity check failed:', error);
      return false;
    }
  }

}
