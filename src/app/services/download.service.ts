import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable } from 'rxjs';
import { Song, DataSong, YouTubeDownloadResponse } from '../interfaces/song.interface';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
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
  // Blob support for PWA
  audioBlobId?: string;
  thumbnailBlobId?: string;
  isWebDownload?: boolean;
}



@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private apiUrl = environment.apiUrl;

  private downloadsSubject = new BehaviorSubject<DownloadTask[]>([]);
  public downloads$ = this.downloadsSubject.asObservable();
  private activeDownloads = new Map<string, any>();
  private platform: string;

  constructor(
    private http: HttpClient,
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private platformService: Platform,
    private refreshService: RefreshService
  ) {
    this.platform = this.platformService.is('hybrid') ? 'native' : 'web';
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
   * Download thực tế file audio
   * @param id - ID của download task
   * @param audioUrl - URL của file audio
   * @param signal - AbortSignal để cancel download
   */
  private async realDownload(id: string, audioUrl: string, signal: AbortSignal) {
    try {
      const download = this.getDownload(id);
      if (!download) return;

      console.log('🎵 Starting real download for:', download.title);

      if (Capacitor.getPlatform() === 'web') {
        // Web platform: Không download file, chỉ lưu thông tin vào database
        await this.handleWebDownload(id, signal);
      } else {
        // Native platform: Download file thực tế
        await this.handleNativeDownload(id, audioUrl, signal);
      }

    } catch (error) {
      if (!signal.aborted) {
        console.error('Download error:', error);
        this.failDownload(id, 'Download failed: ' + error);
      }
    }
  }

  /**
   * Xử lý download cho web platform
   * @param id - ID của download task
   * @param signal - AbortSignal
   */
  private async handleWebDownload(id: string, signal: AbortSignal) {
    // Simulate progress cho web
    for (let progress = 0; progress <= 100; progress += 20) {
      if (signal.aborted) return;

      await new Promise(resolve => setTimeout(resolve, 300));
      this.updateDownloadProgress(id, progress);
    }

    // Complete download (không có filePath cho web)
    await this.completeDownload(id);
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
        genre: this.extractGenreFromKeywords(songData.keywords || [])
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

  // === HELPER METHODS ===

  /**
   * Lấy stream URL từ YouTube video ID
   * @param videoId - YouTube video ID
   * @returns Promise<string | null> - Stream URL hoặc null nếu thất bại
   */
  private async getStreamUrl(videoId: string): Promise<string | null> {
    try {
      const response = await this.http.post<any>(`${this.apiUrl}/stream`, {
        videoId: videoId
      }).toPromise();

      if (response && response.streamUrl) {
        return response.streamUrl;
      }

      console.error('No stream URL in response');
      return null;
    } catch (error) {
      console.error('Error getting stream URL:', error);
      return null;
    }
  }

  /**
   * Tạo tên file an toàn cho hệ thống
   * @param title - Tên bài hát
   * @param artist - Tên nghệ sĩ
   * @returns string - Tên file đã được format
   */
  private generateFileName(title: string, artist: string): string {
    const cleanTitle = this.sanitizeFileName(title);
    const cleanArtist = this.sanitizeFileName(artist);
    const fileName = `${cleanArtist} - ${cleanTitle}`;

    // Giới hạn độ dài tên file
    const maxLength = 100;
    const truncated = fileName.length > maxLength
      ? fileName.substring(0, maxLength)
      : fileName;

    return `${truncated}.mp3`;
  }

  /**
   * Làm sạch tên file, loại bỏ ký tự không hợp lệ
   * @param fileName - Tên file gốc
   * @returns string - Tên file đã được làm sạch
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Thay thế ký tự không hợp lệ
      .replace(/\s+/g, ' ') // Thay thế nhiều khoảng trắng thành 1
      .trim();
  }

  /**
   * Chuyển đổi dữ liệu YouTube thành Song object
   * @param data - Dữ liệu từ YouTube API
   * @param filePath - Đường dẫn file hoặc URL
   * @returns Song object
   */
  private youtubeDataToSong(data: DataSong, filePath: string): Song {
    return {
      id: data.id,
      title: data.title,
      artist: data.artist,
      album: undefined,
      duration: data.duration || 0,
      duration_formatted: data.duration_formatted,
      thumbnail: data.thumbnail_url,
      audioUrl: data.audio_url,
      filePath: filePath,
      addedDate: new Date(),
      isFavorite: false,
      genre: this.extractGenreFromKeywords(data.keywords || []),

      // Default values for new fields
      downloadStatus: 'none',
      downloadProgress: 0,
      fileSize: 0,
      isOfflineAvailable: false
    };
  }

  /**
   * Trích xuất genre từ keywords
   * @param keywords - Mảng từ khóa
   * @returns string hoặc undefined
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

    return undefined;
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

  // === CROSS-PLATFORM DOWNLOAD METHODS ===

  /**
   * Download bài hát với hỗ trợ cross-platform (PWA + Native)
   * @param youtubeData - Dữ liệu bài hát từ YouTube API
   * @returns Promise<boolean> - true nếu download thành công
   */
  async downloadSongCrossPlatform(youtubeData: DataSong): Promise<boolean> {
    try {
      console.log('🚀 Starting cross-platform download:', youtubeData.title);

      // Cập nhật trạng thái download trong database
      await this.databaseService.updateSongDownloadStatus(youtubeData.id, 'downloading', 0);

      if (this.platform === 'native') {
        return await this.downloadForNative(youtubeData);
      } else {
        return await this.downloadForWeb(youtubeData);
      }
    } catch (error) {
      console.error('❌ Error in cross-platform download:', error);
      await this.databaseService.updateSongDownloadStatus(youtubeData.id, 'failed', 0);
      return false;
    }
  }

  /**
   * Download cho native platform (iOS/Android)
   * @param youtubeData - Dữ liệu bài hát
   */
  private async downloadForNative(youtubeData: DataSong): Promise<boolean> {
    try {
      console.log('📱 Native download starting...');

      // 1. Lấy stream URL
      const streamUrl = await this.getStreamUrl(youtubeData.id);
      if (!streamUrl) {
        throw new Error('Không thể lấy stream URL');
      }

      // 2. Download audio file
      const fileName = this.generateFileName(youtubeData.title, youtubeData.artist);
      const filePath = await this.downloadFileNative(streamUrl, fileName);

      if (!filePath) {
        throw new Error('Không thể download file');
      }      // 3. Download thumbnail (optional)
      let thumbnailPath: string | undefined;
      if (youtubeData.thumbnail_url) {
        const downloadedPath = await this.downloadThumbnailNative(youtubeData.thumbnail_url, youtubeData.id);
        thumbnailPath = downloadedPath || undefined;
      }

      // 4. Lưu vào database
      const song = this.youtubeDataToSong(youtubeData, filePath);
      song.downloadStatus = 'completed';
      song.isOfflineAvailable = true;
      song.downloadedAt = new Date();

      const success = await this.databaseService.addSong(song);

      if (success) {
        await this.databaseService.updateSongDownloadStatus(youtubeData.id, 'completed', 100);
        console.log('✅ Native download completed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Native download failed:', error);
      return false;
    }
  }

  /**
   * Download cho web platform (PWA)
   * @param youtubeData - Dữ liệu bài hát
   */
  private async downloadForWeb(youtubeData: DataSong): Promise<boolean> {
    try {
      console.log('🌐 Web/PWA download starting...');

      // 1. Lấy stream URL
      const streamUrl = await this.getStreamUrl(youtubeData.id);
      if (!streamUrl) {
        throw new Error('Không thể lấy stream URL');
      }

      // 2. Download audio blob
      const audioBlob = await this.downloadMediaToBlob(streamUrl, youtubeData.id, 'audio');
      if (!audioBlob) {
        throw new Error('Không thể download audio blob');
      }

      // 3. Download thumbnail blob
      let thumbnailBlob: Blob | null = null;
      if (youtubeData.thumbnail_url) {
        thumbnailBlob = await this.downloadMediaToBlob(youtubeData.thumbnail_url, youtubeData.id, 'thumbnail');
      }

      // 4. Lưu blobs vào IndexedDB
      const audioBlobId = await this.saveAudioBlob(audioBlob, youtubeData.id);
      let thumbnailBlobId: string | undefined;

      if (thumbnailBlob) {
        thumbnailBlobId = await this.saveThumbnailBlob(thumbnailBlob, youtubeData.id);
      }

      // 5. Lưu metadata vào database
      const song = this.youtubeDataToSong(youtubeData, streamUrl); // streamUrl as fallback
      song.audioBlobId = audioBlobId;
      song.thumbnailBlobId = thumbnailBlobId;
      song.downloadStatus = 'completed';
      song.isOfflineAvailable = true;
      song.downloadedAt = new Date();
      song.fileSize = audioBlob.size + (thumbnailBlob?.size || 0);

      const success = await this.databaseService.addSong(song);

      if (success) {
        await this.databaseService.updateSongDownloadStatus(youtubeData.id, 'completed', 100);
        await this.databaseService.updateSongBlobIds(youtubeData.id, audioBlobId, thumbnailBlobId);
        console.log('✅ Web/PWA download completed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Web/PWA download failed:', error);
      return false;
    }
  }

  // === NATIVE DOWNLOAD METHODS ===

  /**
   * Download file cho native platform
   * @param url - URL để download
   * @param fileName - Tên file
   * @returns Promise<string | null> - Đường dẫn file hoặc null
   */
  private async downloadFileNative(url: string, fileName: string): Promise<string | null> {
    try {
      // Đảm bảo thư mục Music tồn tại
      await this.ensureMusicDirectoryExists();

      // Download file using fetch (tương thích hơn CapacitorHttp)
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64String = this.arrayBufferToBase64(arrayBuffer);

      // Lưu file vào Documents/Music/
      const result = await Filesystem.writeFile({
        path: `Music/${fileName}`,
        data: base64String,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return result.uri;
    } catch (error) {
      console.error('Error downloading file native:', error);
      return null;
    }
  }

  /**
   * Download thumbnail cho native platform
   * @param thumbnailUrl - URL thumbnail
   * @param songId - ID bài hát
   * @returns Promise<string | null> - Đường dẫn thumbnail
   */
  private async downloadThumbnailNative(thumbnailUrl: string, songId: string): Promise<string | null> {
    try {
      const response = await fetch(thumbnailUrl);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const base64String = this.arrayBufferToBase64(arrayBuffer);

      // Xác định extension từ content-type
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const fileName = `thumbnail_${songId}.${extension}`;

      // Lưu thumbnail
      const result = await Filesystem.writeFile({
        path: `Music/thumbnails/${fileName}`,
        data: base64String,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });

      return result.uri;
    } catch (error) {
      console.error('Error downloading thumbnail native:', error);
      return null;
    }
  }

  /**
   * Đảm bảo thư mục Music tồn tại
   */
  private async ensureMusicDirectoryExists(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: 'Music',
        directory: Directory.Documents,
        recursive: true
      });

      await Filesystem.mkdir({
        path: 'Music/thumbnails',
        directory: Directory.Documents,
        recursive: true
      });    } catch (error: any) {
      // Bỏ qua lỗi nếu thư mục đã tồn tại
      if (!error?.message?.includes('exists')) {
        console.error('Error creating music directory:', error);
      }
    }
  }

  // === WEB/PWA DOWNLOAD METHODS ===

  /**
   * Download media thành blob cho web platform
   * @param url - URL để download
   * @param songId - ID bài hát
   * @param type - Loại media: 'audio' | 'thumbnail'
   * @returns Promise<Blob | null> - Blob data hoặc null
   */
  private async downloadMediaToBlob(url: string, songId: string, type: 'audio' | 'thumbnail'): Promise<Blob | null> {
    try {
      console.log(`📥 Downloading ${type} blob:`, url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log(`✅ ${type} blob downloaded:`, blob.size, 'bytes');

      return blob;
    } catch (error) {
      console.error(`Error downloading ${type} blob:`, error);
      return null;
    }
  }

  /**
   * Lưu audio blob vào IndexedDB
   * @param blob - Audio blob
   * @param songId - ID bài hát
   * @returns Promise<string> - Audio blob ID
   */
  private async saveAudioBlob(blob: Blob, songId: string): Promise<string> {
    const audioBlobId = this.generateBlobId(songId, 'audio');

    const success = await this.indexedDBService.saveBlobToIndexedDB(
      audioBlobId,
      blob,
      'audio',
      songId,
      blob.type || 'audio/mpeg'
    );

    if (!success) {
      throw new Error('Failed to save audio blob');
    }

    console.log(`✅ Audio blob saved with ID: ${audioBlobId}`);
    return audioBlobId;
  }

  /**
   * Lưu thumbnail blob vào IndexedDB
   * @param blob - Thumbnail blob
   * @param songId - ID bài hát
   * @returns Promise<string> - Thumbnail blob ID
   */
  private async saveThumbnailBlob(blob: Blob, songId: string): Promise<string> {
    const thumbnailBlobId = this.generateBlobId(songId, 'thumbnail');

    const success = await this.indexedDBService.saveBlobToIndexedDB(
      thumbnailBlobId,
      blob,
      'thumbnail',
      songId,
      blob.type || 'image/jpeg'
    );

    if (!success) {
      throw new Error('Failed to save thumbnail blob');
    }

    console.log(`✅ Thumbnail blob saved with ID: ${thumbnailBlobId}`);
    return thumbnailBlobId;
  }

  /**
   * Tạo unique blob ID
   * @param songId - ID bài hát
   * @param type - Loại blob
   * @returns string - Blob ID
   */
  private generateBlobId(songId: string, type: 'audio' | 'thumbnail'): string {
    return `${type}_${songId}_${Date.now()}`;
  }

  // === BLOB RETRIEVAL METHODS ===

  /**
   * Lấy audio source cho playback (hỗ trợ cả native file và web blob)
   * @param song - Song object
   * @returns Promise<string> - URL hoặc blob URL để phát nhạc
   */
  async getAudioSource(song: Song): Promise<string> {
    try {
      if (this.platform === 'native') {
        // Trên native, sử dụng file path nếu có
        if (song.filePath && song.isOfflineAvailable) {
          return song.filePath;
        }
        // Fallback to stream URL
        return song.audioUrl;
      } else {
        // Trên web, ưu tiên blob nếu có
        if (song.audioBlobId && song.isOfflineAvailable) {
          const blob = await this.indexedDBService.getBlobFromIndexedDB(song.audioBlobId);
          if (blob) {
            return URL.createObjectURL(blob);
          }
        }
        // Fallback to stream URL
        return song.audioUrl;
      }
    } catch (error) {
      console.error('Error getting audio source:', error);
      return song.audioUrl; // Fallback
    }
  }

  /**
   * Lấy thumbnail source (hỗ trợ cả native file và web blob)
   * @param song - Song object
   * @returns Promise<string> - URL hoặc blob URL cho thumbnail
   */
  async getThumbnailSource(song: Song): Promise<string> {
    try {
      if (this.platform === 'web' && song.thumbnailBlobId && song.isOfflineAvailable) {
        // Trên web, sử dụng blob nếu có
        const blob = await this.indexedDBService.getBlobFromIndexedDB(song.thumbnailBlobId);
        if (blob) {
          return URL.createObjectURL(blob);
        }
      }

      // Fallback to original thumbnail URL
      return song.thumbnail || '/assets/default-thumbnail.png';
    } catch (error) {
      console.error('Error getting thumbnail source:', error);
      return song.thumbnail || '/assets/default-thumbnail.png';
    }
  }

  /**
   * Kiểm tra xem bài hát có sẵn offline không
   * @param song - Song object
   * @returns boolean - true nếu có thể phát offline
   */
  isOfflineAvailable(song: Song): boolean {
    if (this.platform === 'native') {
      return !!(song.filePath && song.isOfflineAvailable);
    } else {
      return !!(song.audioBlobId && song.isOfflineAvailable);
    }
  }

  /**
   * Cleanup blob URLs để tránh memory leak
   * @param blobUrl - Blob URL cần cleanup
   */
  cleanupBlobUrl(blobUrl: string): void {
    if (blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
  }

  // === PROGRESS TRACKING ===
  /**
   * Cập nhật progress download cho database
   * @param songId - ID bài hát
   * @param progress - Progress (0-100)
   */
  async updateDatabaseDownloadProgress(songId: string, progress: number): Promise<void> {
    try {
      await this.databaseService.updateSongDownloadStatus(songId, 'downloading', progress);
      console.log(`📊 Download progress: ${songId} - ${progress}%`);
    } catch (error) {
      console.error('Error updating download progress:', error);
    }
  }

  /**
   * Hoàn thành download
   * @param songId - ID bài hát
   */
  async onDownloadComplete(songId: string): Promise<void> {
    try {
      await this.databaseService.updateSongDownloadStatus(songId, 'completed', 100);
      console.log(`✅ Download completed: ${songId}`);

      // Trigger refresh để UI cập nhật
      this.refreshService.triggerRefresh();
    } catch (error) {
      console.error('Error completing download:', error);
    }
  }

  /**
   * Báo lỗi download
   * @param songId - ID bài hát
   * @param error - Error message
   */
  async onDownloadFailed(songId: string, error: string): Promise<void> {
    try {
      await this.databaseService.updateSongDownloadStatus(songId, 'failed', 0);
      console.error(`❌ Download failed: ${songId} - ${error}`);
    } catch (err) {
      console.error('Error marking download as failed:', err);
    }  }

  /**
   * Chuyển ArrayBuffer thành Base64 string
   * @param buffer - ArrayBuffer
   * @returns string - Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ...existing code...
}
