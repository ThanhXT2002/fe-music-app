import { Injectable, signal } from '@angular/core';
import { Song, PlaybackState } from '../interfaces/song.interface';
import { SavedPlaybackState } from '../interfaces/playback-state.interface';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { OfflineMediaService } from './offline-media.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Subject } from 'rxjs';

// 🆕 Interface for download prompt events
interface DownloadPromptEvent {
  song: Song;
  playlist?: Song[];
  index?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AudioPlayerService {
  private audio: HTMLAudioElement = new Audio();

  // 🆕 Subject for download prompt events
  public downloadPrompt$ = new Subject<DownloadPromptEvent>();

  private _playbackState = signal<PlaybackState>({
    currentSong: null,
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    repeatMode: 'none',
    isShuffled: false,
    currentPlaylist: [],
    currentIndex: -1,
  });

  public playbackState = this._playbackState.asReadonly();
  private updateInterval?: number;
  private blobUrlCache = new Map<string, string>(); // Cache cho blob URLs từ IndexedDB
  // Additional signals for PlayerPage
  currentSong = signal<Song | null>(null);
  currentTime = signal<number>(0);
  duration = signal<number>(0);
  isPlayingSignal = signal<boolean>(false);
  isShuffling = signal<boolean>(false);
  repeatModeSignal = signal<'none' | 'one' | 'all'>('none');
  queue = signal<Song[]>([]);
  currentIndex = signal<number>(-1);
  bufferProgress = signal<number>(0);

  constructor(
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private offlineMediaService: OfflineMediaService
  ) {
    this.setupAudioEventListeners();
    this.loadSavedSettings();
    this.setupSignalUpdates();
    // Phục hồi trạng thái phát nhạc khi khởi tạo (với delay để đảm bảo database đã sẵn sàng)
    setTimeout(() => {
      this.restorePlaybackState();
    }, 1000); // Delay 1 giây
  }
  // 🆕 Method để preload audio (chỉ cho downloaded songs)
  async preloadAudio(song: Song): Promise<void> {
    try {
      // Chỉ preload nếu có trong database và có filePath
      const dbSong = await this.databaseService.getSongById(song.id);
      if (dbSong && dbSong.filePath) {
        console.log('🔄 Preloading downloaded audio:', song.title);
        if (Capacitor.isNativePlatform()) {
          // Native: Kiểm tra file tồn tại
          await this.tryAllLocalFileApproaches(dbSong.filePath);
        } else {
          // Web/PWA: Kiểm tra blob trong IndexedDB
          const audioBlob = await this.indexedDBService.getAudioFile(song.id);
          if (!audioBlob) {
            console.warn('⚠️ Audio blob not found for preload:', song.title);
          }
        }
      }
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  }
  // 🔄 Modified playSong method
  async playSong(song: Song, playlist: Song[] = [], index: number = 0) {
    // Cleanup previous blob URLs to prevent memory leaks
    this.cleanupAllBlobUrls();

    try {
      this._playbackState.update((state) => ({
        ...state,
        currentSong: song,
        currentPlaylist: playlist.length > 0 ? playlist : [song],
        currentIndex: playlist.length > 0 ? index : 0,
      })); // 🔄 Update signals ngay lập tức để UI hiển thị
      this.updateSignalsImmediately(true); // Log when user plays a song

      // 🔄 Force refresh thumbnail để đảm bảo hiển thị đúng
      setTimeout(() => {
        this.refreshCurrentSongThumbnail();
      }, 100); // Kiểm tra xem có local file không (đã download)
      let audioUrl: string; // Debug: check call stack để xem song được gọi từ đâu
      console.log(
        '🔍 playSong called from:',
        new Error().stack?.split('\n')[2]
      ); // 🔍 Check if song exists in database (downloaded)
      console.log('🔍 Checking if song exists in database:', song.title);
      const existsInDb = await this.databaseService.getSongById(song.id);

      if (existsInDb) {
        // 🎵 Bài hát có trong database - CHỈ dùng local file (cả native và web/PWA)
        console.log('🎵 Song found in database, playing from local file');
        console.log('📱 Platform:', Capacitor.getPlatform());
        console.log('🔧 Is Native:', Capacitor.isNativePlatform());

        if (Capacitor.isNativePlatform()) {
          // Native platform: Dùng filesystem
          if (existsInDb.filePath) {
            audioUrl = await this.tryAllLocalFileApproaches(
              existsInDb.filePath
            );
            console.log('✅ Native: Local file loaded from filesystem');
          } else {
            throw new Error(
              `File path not found for song: ${existsInDb.title}`
            );
          }
        } else {
          // Web/PWA platform: Dùng IndexedDB blob
          console.log('🔄 Web/PWA: Loading from IndexedDB...');
          try {
            const audioBlob = await this.indexedDBService.getAudioFile(song.id);
            if (audioBlob) {
              audioUrl = this.trackBlobUrl(URL.createObjectURL(audioBlob));
              console.log('✅ Web/PWA: Local file loaded from IndexedDB');
            } else {
              throw new Error('Audio blob not found in IndexedDB');
            }
          } catch (indexedDbError) {
            throw new Error(
              `Không thể phát file offline: ${existsInDb.title}. File có thể bị hỏng trong IndexedDB.`
            );
          }
        }
      } else {
        // 🚫 Bài hát không có trong database - KHÔNG cho phép phát
        throw new Error(
          `Song "${song.title}" chưa được download. Vui lòng download trước khi phát.`
        );
      } // Set audio source và play
      this.audio.src = audioUrl;
      try {
        await this.audio.load();
        await this.audio.play();
        console.log('✅ Audio playback started successfully');
      } catch (playError) {
        console.error('❌ Audio playback failed:', playError);
        // 🚫 KHÔNG có fallback streaming - chỉ phát từ file offline
        throw new Error(
          `Không thể phát file offline: ${song.title}. File có thể bị hỏng hoặc không tương thích.`
        );
      }

      // Preload next song (optional optimization)
      this.preloadNextSong();
    } catch (error) {
      console.error('❌ Error playing song:', error);

      // Show user-friendly error
      this.handlePlaybackError(error, song);
    }
  }

  // 🆕 Preload next song for smooth playback
  private async preloadNextSong(): Promise<void> {
    try {
      const state = this._playbackState();
      if (state.currentPlaylist.length > 1) {
        const nextIndex =
          (state.currentIndex + 1) % state.currentPlaylist.length;
        const nextSong = state.currentPlaylist[nextIndex]; // Chúng ta không cần preload nữa vì bây giờ chỉ phát từ file đã download
        // Không còn sử dụng streaming URL
        if (nextSong && nextSong.filePath) {
          // Preload từ file system hoặc IndexedDB nếu cần
          setTimeout(() => this.preloadAudio(nextSong), 2000);
        }
      }
    } catch (error) {
      console.error('Error preloading next song:', error);
    }
  }
  // 🆕 Handle playback errors
  private handlePlaybackError(error: any, song: Song): void {
    console.error('Playback error for song:', song.title, error);

    this._playbackState.update((state) => ({
      ...state,
      isPlaying: false,
      isPaused: false,
    }));

    // Check if error is about missing download
    if (error.message && error.message.includes('chưa được download')) {
      console.log('🔔 Emitting download prompt for:', song.title);
      this.downloadPrompt$.next({ song });
    }

    // Could emit other types of errors for UI handling
    // this.toastService.showError(`Cannot play ${song.title}`);
  }

  // 🆕 Clear cache method
  private clearBlobUrlCache(): void {
    this.blobUrlCache.forEach((blobUrl, originalUrl) => {
      URL.revokeObjectURL(blobUrl);
    });

    this.blobUrlCache.clear();
  }
  // 🔄 Modified destroy method
  destroy() {
    this.stopTimeUpdate();
    this.stopSignalUpdates(); // 🆕 Stop signal updates
    this.audio.pause();
    this.audio.src = '';
    this.clearCache(); // Clear cache khi destroy
  }

  private setupAudioEventListeners() {
    this.audio.addEventListener('loadedmetadata', () => {
      this._playbackState.update((state) => ({
        ...state,
        duration: this.audio.duration,
      }));
    });

    this.audio.addEventListener('timeupdate', () => {
      this._playbackState.update((state) => ({
        ...state,
        currentTime: this.audio.currentTime,
      }));
    });

    // Buffer progress tracking
    this.audio.addEventListener('progress', () => {
      this.updateBufferProgress();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.updateBufferProgress();
    });
    this.audio.addEventListener('ended', () => {
      // 🆕 Stop signal updates when song ends
      this.stopSignalUpdates();
      this.handleSongEnded();
    });
    this.audio.addEventListener('play', () => {
      this._playbackState.update((state) => ({
        ...state,
        isPlaying: true,
        isPaused: false,
      }));
      this.startTimeUpdate();
      // 🆕 Start signal updates when playing
      this.startSignalUpdates();
      // 🔄 Update signals immediately when play event fires
      setTimeout(() => {
        this.updateSignalsImmediately(true);
      }, 10);
    });

    this.audio.addEventListener('pause', () => {
      this._playbackState.update((state) => ({
        ...state,
        isPlaying: false,
        isPaused: true,
      }));
      this.stopTimeUpdate();
      // 🆕 Stop signal updates when paused
      this.stopSignalUpdates();
      // 🔄 Update signals immediately when pause event fires
      setTimeout(() => {
        this.updateSignalsImmediately(true);
      }, 10);
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      this._playbackState.update((state) => ({
        ...state,
        isPlaying: false,
        isPaused: false,
      }));
      // 🆕 Stop signal updates on error
      this.stopSignalUpdates();
      // 🔄 Update signals immediately on error
      this.updateSignalsImmediately(true);
    });
  }
  private updateBufferProgress() {
    try {
      if (this.audio.buffered.length > 0 && this.audio.duration > 0) {
        // Get the last buffered range (most relevant)
        const lastBufferIndex = this.audio.buffered.length - 1;
        const bufferedEnd = this.audio.buffered.end(lastBufferIndex);
        const bufferPercent = (bufferedEnd / this.audio.duration) * 100;

        // Only update if there's a meaningful change
        const currentBuffer = this.bufferProgress();
        const newBuffer = Math.min(100, Math.max(0, bufferPercent));

        if (Math.abs(newBuffer - currentBuffer) > 0.5) {
          this.bufferProgress.set(newBuffer);
        }
      } else {
        // Reset buffer if no data
        this.bufferProgress.set(0);
      }
    } catch (error) {
      console.warn('Buffer progress update failed:', error);
    }
  }
  private signalUpdateInterval?: number;

  private setupSignalUpdates() {
    // Không setup interval ngay, chỉ update khi có sự kiện thực sự
    console.log('📡 Signal updates setup - will only update when needed');
  }

  // 🆕 Start signal updates only when playing
  private startSignalUpdates() {
    if (this.signalUpdateInterval) {
      this.stopSignalUpdates(); // Clear existing interval
    }

    console.log('🔄 Starting signal updates (music is playing)');
    this.signalUpdateInterval = window.setInterval(() => {
      // Chỉ update khi thực sự đang phát nhạc
      if (!this.audio.paused && this._playbackState().isPlaying) {
        this.updateSignalsImmediately(); // No log for periodic updates
        this.updateBufferProgress();
      }
    }, 500); // Giảm frequency xuống 500ms để tiết kiệm tài nguyên
  }

  // 🆕 Stop signal updates when paused
  private stopSignalUpdates() {
    if (this.signalUpdateInterval) {
      console.log('⏸️ Stopping signal updates (music paused/stopped)');
      clearInterval(this.signalUpdateInterval);
      this.signalUpdateInterval = undefined;
    }
  }
  async pause() {
    if (!this.audio.paused) {
      await this.audio.pause();
      // 🔄 Update signals immediately after pause
      this.updateSignalsImmediately(true);
      console.log('⏸️ Paused - signals updated immediately');
    }
  }

  async resume() {
    if (this.audio.paused && this._playbackState().currentSong) {
      await this.audio.play();
      // 🔄 Update signals immediately after resume
      this.updateSignalsImmediately(true);
      console.log('▶️ Resumed - signals updated immediately');
    }
  }

  async togglePlayPause() {
    if (this._playbackState().isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }
  seekTo(time: number) {
    if (this.audio.duration) {
      const clampedTime = Math.max(0, Math.min(time, this.audio.duration));
      this.audio.currentTime = clampedTime;

      // Force update state immediately
      this._playbackState.update((state) => ({
        ...state,
        currentTime: clampedTime,
      }));

      // Update signal immediately
      this.currentTime.set(clampedTime);
    }
  }

  async seek(time: number) {
    const wasPlaying = this.isPlayingSignal();

    try {
      // Pause if playing to prevent audio glitches during seek
      if (wasPlaying && !this.audio.paused) {
        await this.audio.pause();
      }

      // Perform seek
      this.seekTo(time);

      // Wait a bit for seek to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Resume if was playing
      if (wasPlaying) {
        try {
          await this.audio.play();
        } catch (playError) {
          console.warn('Failed to resume after seek:', playError);
        }
      }
    } catch (error) {
      console.error('❌ Seek failed:', error);
      throw error;
    }
  }

  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = clampedVolume;
    this._playbackState.update((state) => ({
      ...state,
      volume: clampedVolume,
      isMuted: clampedVolume === 0,
    }));
    this.saveSettings();
  }

  toggleMute() {
    const currentState = this._playbackState();
    if (currentState.isMuted) {
      this.setVolume(currentState.volume || 0.5);
    } else {
      this.audio.volume = 0;
      this._playbackState.update((state) => ({
        ...state,
        isMuted: true,
      }));
    }
    this.saveSettings();
  }

  async playNext() {
    const state = this._playbackState();
    if (state.currentPlaylist.length === 0) return;

    let nextIndex: number;

    if (state.isShuffled) {
      nextIndex = Math.floor(Math.random() * state.currentPlaylist.length);
    } else {
      nextIndex = (state.currentIndex + 1) % state.currentPlaylist.length;
    }

    const nextSong = state.currentPlaylist[nextIndex];
    if (nextSong) {
      await this.playSong(nextSong, state.currentPlaylist, nextIndex);
    }
  }

  async playPrevious() {
    const state = this._playbackState();
    if (state.currentPlaylist.length === 0) return;

    if (this.audio.currentTime > 3) {
      this.seekTo(0);
      return;
    }

    let prevIndex: number;

    if (state.isShuffled) {
      prevIndex = Math.floor(Math.random() * state.currentPlaylist.length);
    } else {
      prevIndex = state.currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = state.currentPlaylist.length - 1;
      }
    }

    const prevSong = state.currentPlaylist[prevIndex];
    if (prevSong) {
      await this.playSong(prevSong, state.currentPlaylist, prevIndex);
    }
  }

  toggleRepeat() {
    const currentMode = this._playbackState().repeatMode;
    let newMode: 'none' | 'one' | 'all';

    switch (currentMode) {
      case 'none':
        newMode = 'one';
        break;
      case 'one':
        newMode = 'all';
        break;
      case 'all':
        newMode = 'none';
        break;
    }

    this._playbackState.update((state) => ({
      ...state,
      repeatMode: newMode,
    }));
    this.saveSettings();
  }

  toggleShuffle() {
    this._playbackState.update((state) => ({
      ...state,
      isShuffled: !state.isShuffled,
    }));
    this.saveSettings();
  }

  private async handleSongEnded() {
    const state = this._playbackState();

    switch (state.repeatMode) {
      case 'one':
        this.seekTo(0);
        await this.audio.play();
        break;
      case 'all':
        await this.playNext();
        break;
      case 'none':
        if (state.currentIndex < state.currentPlaylist.length - 1) {
          await this.playNext();
        } else {
          this._playbackState.update((state) => ({
            ...state,
            isPlaying: false,
            isPaused: false,
          }));
        }
        break;
    }
  }

  private startTimeUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = window.setInterval(() => {
      if (!this.audio.paused) {
        this._playbackState.update((state) => ({
          ...state,
          currentTime: this.audio.currentTime,
        }));

        // Save state mỗi 30 giây khi đang phát nhạc
        if (Math.floor(this.audio.currentTime) % 30 === 0) {
          this.savePlaybackState();
        }
      }
    }, 1000);
  }

  private stopTimeUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private saveSettings() {
    const state = this._playbackState();
    localStorage.setItem(
      'audioPlayerSettings',
      JSON.stringify({
        volume: state.volume,
        isMuted: state.isMuted,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
      })
    );
  }

  private loadSavedSettings() {
    try {
      const saved = localStorage.getItem('audioPlayerSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this._playbackState.update((state) => ({
          ...state,
          volume: settings.volume || 1,
          isMuted: settings.isMuted || false,
          repeatMode: settings.repeatMode || 'none',
          isShuffled: settings.isShuffled || false,
        }));

        this.audio.volume = settings.volume || 1;
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }

  async setPlaylist(playlist: Song[], startIndex: number = 0) {
    this._playbackState.update((state) => ({
      ...state,
      currentPlaylist: playlist,
      currentIndex: startIndex,
    }));

    if (playlist.length > 0 && playlist[startIndex]) {
      await this.playSong(playlist[startIndex], playlist, startIndex);
    }
  }

  getCurrentSong(): Song | null {
    return this._playbackState().currentSong;
  }

  isPlaying(): boolean {
    return this._playbackState().isPlaying;
  }

  getCurrentTime(): number {
    return this._playbackState().currentTime;
  }

  getDuration(): number {
    return this._playbackState().duration;
  }

  getVolume(): number {
    return this._playbackState().volume;
  }

  updateCurrentSong(song: Song) {
    this._playbackState.update((state) => ({
      ...state,
      currentSong: song,
    }));
    this.currentSong.set(song);
  }

  async playFromQueue(index: number) {
    const playlist = this._playbackState().currentPlaylist;
    if (index >= 0 && index < playlist.length) {
      await this.playSong(playlist[index], playlist, index);
    }
  }

  removeFromQueue(index: number) {
    const state = this._playbackState();
    const newPlaylist = [...state.currentPlaylist];

    if (index >= 0 && index < newPlaylist.length) {
      newPlaylist.splice(index, 1);

      let newIndex = state.currentIndex;
      if (index < state.currentIndex) {
        newIndex = state.currentIndex - 1;
      } else if (index === state.currentIndex) {
        newIndex = Math.min(newIndex, newPlaylist.length - 1);
      }

      this._playbackState.update((prevState) => ({
        ...prevState,
        currentPlaylist: newPlaylist,
        currentIndex: newIndex,
      }));
    }
  }

  // 🆕 Additional utility methods
  getCacheSize(): number {
    return this.blobUrlCache.size;
  }

  getCachedUrls(): string[] {
    return Array.from(this.blobUrlCache.keys());
  }

  async clearCache(): Promise<void> {
    this.clearBlobUrlCache();
  }

  // 🆕 Save current playback state to localStorage
  savePlaybackState(): void {
    try {
      const state = this._playbackState();
      const savedState: SavedPlaybackState = {
        currentSong: state.currentSong
          ? {
              id: state.currentSong.id,
              title: state.currentSong.title,
              artist: state.currentSong.artist,
              url: '', // Không lưu URL streaming
              thumbnail: state.currentSong.thumbnail,
              duration: state.currentSong.duration,
            }
          : null,
        currentTime: state.currentTime,
        isPlaying: false, // Luôn save là false để không tự động play khi restore
        volume: state.volume,
        isShuffling: state.isShuffled,
        repeatMode: state.repeatMode,
        queue: state.currentPlaylist.map((song) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          url: '', // Không lưu URL streaming
          thumbnail: song.thumbnail,
          duration: song.duration,
        })),
        currentIndex: state.currentIndex,
        savedAt: Date.now(),
      };

      localStorage.setItem('savedPlaybackState', JSON.stringify(savedState));
    } catch (error) {
      console.error('❌ Error saving playback state:', error);
    }
  }

  // 🆕 Restore playback state from localStorage
  async restorePlaybackState(): Promise<void> {
    console.log('🔄 restorePlaybackState: Starting...');

    try {
      const saved = localStorage.getItem('savedPlaybackState');
      console.log(
        '💾 Saved state from localStorage:',
        saved ? 'Found' : 'Not found'
      );

      if (!saved) {
        console.log('❌ No saved state found');
        return;
      }

      const savedState: SavedPlaybackState = JSON.parse(saved);
      console.log('📝 Parsed saved state:', {
        currentSong: savedState.currentSong?.title,
        queueLength: savedState.queue.length,
        savedAt: new Date(savedState.savedAt),
      });

      // Chỉ restore nếu save không quá 7 ngày
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 ngày
      const age = Date.now() - savedState.savedAt;
      console.log('⏰ State age (hours):', age / (60 * 60 * 1000));

      if (age > maxAge) {
        console.log('🗑️ State too old, removing...');
        localStorage.removeItem('savedPlaybackState');
        return;
      }

      if (savedState.currentSong && savedState.queue.length > 0) {
        console.log('🔄 Restoring playback state...');
        console.log('📱 Platform:', Capacitor.getPlatform());
        console.log('🔧 Is Native:', Capacitor.isNativePlatform()); // Convert back to Song objects and check database
        const playlist: Song[] = [];
        for (const item of savedState.queue) {
          // Check if song exists in database
          const dbSong = await this.databaseService.getSongById(item.id);
          if (dbSong) {
            playlist.push(dbSong);
          } else {            // Create song object even if not in database
            playlist.push({
              id: item.id,
              title: item.title,
              artist: item.artist,
              audioUrl: '', // Không sử dụng URL streaming
              thumbnail: item.thumbnail,
              duration: item.duration,
              album: '',
              genre: '',
              isFavorite: false,
              addedDate: new Date(),
              filePath: undefined,
              duration_formatted: '',
            });
          }
        }        // Check current song in database
        const currentSong = (await this.databaseService.getSongById(
          savedState.currentSong!.id
        )) || {
          id: savedState.currentSong!.id,
          title: savedState.currentSong!.title,
          artist: savedState.currentSong!.artist,
          audioUrl: '', // Không sử dụng URL streaming
          thumbnail: savedState.currentSong!.thumbnail,
          duration: savedState.currentSong!.duration,
          album: '',
          genre: '',
          isFavorite: false,
          addedDate: new Date(),
          filePath: undefined,
          duration_formatted: '',
        };

        console.log(
          '✅ Current song exists in database:',
          !!(await this.databaseService.getSongById(savedState.currentSong!.id))
        );
        console.log('📁 Current song file path:', currentSong.filePath);
        console.log('🎵 Current song title:', currentSong.title);

        // Update state
        this._playbackState.update((state) => ({
          ...state,
          currentSong: currentSong,
          currentPlaylist: playlist,
          currentIndex: savedState.currentIndex,
          volume: savedState.volume,
          isShuffling: savedState.isShuffling,
          repeatMode: savedState.repeatMode,
          currentTime: savedState.currentTime,
          isPlaying: false, // Không tự động play
        }));

        console.log(
          '📊 _playbackState updated with currentSong:',
          this._playbackState().currentSong?.title
        ); // 🔄 Immediate update của signals để UI có thể hiển thị ngay
        this.updateSignalsImmediately(true); // Log when restoring state

        console.log(
          '📊 currentSong signal after update:',
          this.currentSong()?.title
        );

        // 🔍 Debug currentSong state after restore
        this.debugCurrentSongState();

        // 🔄 Force refresh thumbnail để đảm bảo hiển thị đúng
        setTimeout(() => {
          this.refreshCurrentSongThumbnail();
        }, 200);

        console.log('✅ Playback state restored:');
        console.log('- currentSong:', this.currentSong()?.title);
        console.log('- filePath:', this.currentSong()?.filePath);
        console.log('- thumbnail:', this.currentSong()?.thumbnail); // Load audio source nhưng không play (chỉ nếu có trong database)
        const dbSong = await this.databaseService.getSongById(currentSong.id);
        if (Capacitor.isNativePlatform()) {
          // Native: chỉ load nếu có trong database và có filePath
          if (dbSong && dbSong.filePath) {
            try {
              console.log('🔄 Restoring audio source from local file...');
              const audioUrl = await this.tryAllLocalFileApproaches(
                dbSong.filePath
              );
              this.audio.src = audioUrl;
              await this.audio.load();
              console.log('✅ Audio source restored from local file');
            } catch (error) {
              console.error(
                '❌ Failed to restore audio from local file:',
                error
              );
            }
          } else {
            console.log(
              '⚠️ Song not in database, skipping audio restore for native platform'
            );
          }
        } else {
          // Web/PWA: chỉ restore nếu có trong database
          if (dbSong) {
            try {
              console.log('🔄 Web/PWA: Restoring audio from IndexedDB...');
              const audioBlob = await this.indexedDBService.getAudioFile(
                currentSong.id
              );
              if (audioBlob) {
                const audioUrl = this.trackBlobUrl(
                  URL.createObjectURL(audioBlob)
                );
                this.audio.src = audioUrl;
                await this.audio.load();
                console.log('✅ Audio source restored for web/PWA platform');
              } else {
                console.log('⚠️ Audio blob not found in IndexedDB');
              }
            } catch (error) {
              console.error(
                '❌ Error loading saved audio from IndexedDB:',
                error
              );
            }
          } else {
            console.log(
              '⚠️ Song not in database, skipping audio restore for web/PWA platform'
            );
          }
        }

        // Seek đến vị trí đã lưu
        if (savedState.currentTime > 0) {
          this.audio.currentTime = savedState.currentTime;
        }
      }
    } catch (error) {
      console.error('❌ Error restoring playback state:', error);
      localStorage.removeItem('savedPlaybackState');
    }
  }
  // 🆕 Method để update signals ngay lập tức
  private updateSignalsImmediately(logUpdate: boolean = false): void {
    const state = this._playbackState();
    this.currentSong.set(state.currentSong);
    this.currentTime.set(state.currentTime);
    this.duration.set(state.duration);
    this.isPlayingSignal.set(state.isPlaying);
    this.isShuffling.set(state.isShuffled);
    this.repeatModeSignal.set(state.repeatMode);
    this.queue.set(state.currentPlaylist);
    this.currentIndex.set(state.currentIndex);

    // Chỉ log khi được yêu cầu (để tránh spam log)
    if (logUpdate) {
      console.log(
        '✅ Signals updated immediately - currentSong:',
        state.currentSong?.title
      );
    }
  }

  // 🆕 Clear saved state
  clearSavedState(): void {
    localStorage.removeItem('savedPlaybackState');
  }

  /**
   * Debug method để test file path conversion
   */
  async debugFileConversion(filePath: string): Promise<void> {
    console.log('🔍 DEBUG: File conversion test');
    console.log('📂 Original path:', filePath);

    if (Capacitor.isNativePlatform()) {
      const convertedPath = Capacitor.convertFileSrc(filePath);
      console.log('🔗 Converted path:', convertedPath);

      // Test if converted URL is accessible
      try {
        const response = await fetch(convertedPath, { method: 'HEAD' });
        console.log('✅ File accessible:', response.status);
      } catch (error) {
        console.error('❌ File not accessible:', error);
      }
    } else {
      console.log('🌐 Web platform - no conversion needed');
    }
  }

  /**
   * Load local file as blob URL for HTML5 audio
   */ private async loadLocalFileAsBlobUrl(filePath: string): Promise<string> {
    try {
      console.log('📂 Loading local file as blob:', filePath);

      // Extract filename from filePath (remove directory prefix if any)
      const fileName = filePath.includes('/')
        ? filePath.split('/').pop() || ''
        : filePath;
      const directory = Directory.Cache;

      console.log('📁 Reading file:', `TxtMusic/${fileName}`);

      // First, check if file exists
      try {
        const stat = await Filesystem.stat({
          path: `TxtMusic/${fileName}`,
          directory: directory,
        });
        console.log('📊 File stats:', stat);
      } catch (statError) {
        console.error('❌ File does not exist:', statError);
        throw new Error(`File not found: TxtMusic/${fileName}`);
      }

      // Read file as base64
      const fileData = await Filesystem.readFile({
        path: `TxtMusic/${fileName}`,
        directory: directory,
      });

      console.log(
        '📄 File read successfully, data type:',
        typeof fileData.data
      );

      // Detect MIME type from filename extension
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      let mimeType = 'audio/mp3'; // default

      switch (extension) {
        case 'mp3':
          mimeType = 'audio/mpeg';
          break;
        case 'm4a':
        case 'mp4':
          mimeType = 'audio/mp4';
          break;
        case 'webm':
          mimeType = 'audio/webm';
          break;
        case 'ogg':
          mimeType = 'audio/ogg';
          break;
        case 'wav':
          mimeType = 'audio/wav';
          break;
        default:
          mimeType = 'audio/mpeg';
      }

      console.log('🎵 Detected MIME type:', mimeType);

      // Try multiple approaches for creating playable URL

      // Method 1: Blob URL (preferred for smaller files)
      try {
        const response = await fetch(
          `data:${mimeType};base64,${fileData.data}`
        );
        const blob = await response.blob();
        const blobUrl = this.trackBlobUrl(URL.createObjectURL(blob));
        console.log('✅ Blob URL created:', blobUrl);

        // Test if blob URL is valid by creating a test audio element
        const testAudio = new Audio();
        testAudio.src = blobUrl;

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            testAudio.remove();
            reject(new Error('Blob URL test timeout'));
          }, 3000);

          testAudio.addEventListener('canplaythrough', () => {
            clearTimeout(timeout);
            testAudio.remove();
            console.log('✅ Blob URL test passed');
            resolve(blobUrl);
          });

          testAudio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            testAudio.remove();
            console.error('❌ Blob URL test failed:', e);
            reject(new Error('Blob URL not playable'));
          });

          testAudio.load();
        });
      } catch (blobError) {
        console.error('❌ Blob URL approach failed:', blobError);

        // Method 2: Data URI directly (fallback)
        console.log('🔄 Trying direct data URI...');
        const dataUri = `data:${mimeType};base64,${fileData.data}`;
        console.log('📝 Data URI created, length:', dataUri.length);
        return dataUri;
      }
    } catch (error) {
      console.error('❌ Failed to load local file as blob:', error);
      throw error;
    }
  }

  // 🆕 Alternative method: Use native file URI with Capacitor convertFileSrc
  private async loadLocalFileAsNativeUri(filePath: string): Promise<string> {
    try {
      console.log('📂 Loading local file as native URI:', filePath);

      const fileName = filePath.includes('/')
        ? filePath.split('/').pop() || ''
        : filePath;
      const directory = Directory.Cache;

      // Get the native URI using Filesystem.getUri
      const uriResult = await Filesystem.getUri({
        path: `TxtMusic/${fileName}`,
        directory: directory,
      });

      console.log('📍 Native URI:', uriResult.uri);

      // Convert to web-accessible URL
      const webUrl = Capacitor.convertFileSrc(uriResult.uri);
      console.log('🌐 Web URL:', webUrl);

      // Validate that the conversion worked
      if (webUrl === uriResult.uri) {
        console.warn('⚠️ convertFileSrc did not convert the URI!');
      }

      return webUrl;
    } catch (error) {
      console.error('❌ Failed to load local file as native URI:', error);
      throw error;
    }
  }

  // 🆕 Method to try all local file loading approaches
  private async tryAllLocalFileApproaches(filePath: string): Promise<string> {
    const approaches = [
      {
        name: 'Native URI',
        method: () => this.loadLocalFileAsNativeUri(filePath),
      },
      { name: 'Blob URL', method: () => this.loadLocalFileAsBlobUrl(filePath) },
    ];

    let lastError: any;

    for (const approach of approaches) {
      try {
        console.log(`🔄 Trying approach: ${approach.name}`);
        const result = await approach.method();
        console.log(`✅ ${approach.name} succeeded:`, result);
        return result;
      } catch (error) {
        console.error(`❌ ${approach.name} failed:`, error);
        lastError = error;
      }
    }

    throw lastError || new Error('All local file approaches failed');
  }

  // 🆕 Method to get downloaded version of a song
  private async getDownloadedSongVersion(song: Song): Promise<Song> {
    try {
      // Tìm song trong database bằng songId
      const downloadedSong = await this.databaseService.getSongById(song.id);
      if (downloadedSong && downloadedSong.filePath) {
        console.log('✅ Found downloaded version:', downloadedSong.filePath);
        return downloadedSong;
      }

      // Fallback: search in all songs by title+artist
      const allSongs = await this.databaseService.getAllSongs();
      const matchingSong = allSongs.find(
        (s) => s.title === song.title && s.artist === song.artist && s.filePath
      );

      if (matchingSong) {
        console.log(
          '✅ Found downloaded version by title+artist:',
          matchingSong.filePath
        );
        return matchingSong;
      }

      console.log('❌ No downloaded version found');
      return song;
    } catch (error) {
      console.error('❌ Error getting downloaded song version:', error);
      return song;
    }
  }

  // 🆕 Method to check if song requires download for native playback
  async checkSongPlayabilityForNative(
    song: Song
  ): Promise<{ canPlay: boolean; message?: string }> {
    if (!Capacitor.isNativePlatform()) {
      return { canPlay: true }; // Web platform can always try streaming
    }

    // Check if song is downloaded
    const downloadedSong = await this.getDownloadedSongVersion(song);
    if (downloadedSong.filePath) {
      // Verify file exists
      try {
        const fileName = downloadedSong.filePath.includes('/')
          ? downloadedSong.filePath.split('/').pop() || ''
          : downloadedSong.filePath;

        await Filesystem.stat({
          path: `TxtMusic/${fileName}`,
          directory: Directory.Cache,
        });

        return { canPlay: true };
      } catch (error) {
        return {
          canPlay: false,
          message: `File local đã bị xóa hoặc hỏng. Vui lòng download lại "${song.title}".`,
        };
      }
    } else {
      return {
        canPlay: false,
        message: `"${song.title}" chưa được download. Vui lòng download trước khi phát offline.`,
      };
    }
  }
  // 🆕 Method to check if song can be played (exists in database)
  async checkAndPromptDownload(
    song: Song
  ): Promise<{ canPlay: boolean; needsDownload: boolean }> {
    const existsInDb = await this.databaseService.getSongById(song.id);

    if (existsInDb) {
      return { canPlay: true, needsDownload: false };
    } else {
      return { canPlay: false, needsDownload: true };
    }
  }

  // 🆕 Enhanced playSong with download prompt
  async playSongWithDownloadCheck(
    song: Song,
    playlist: Song[] = [],
    index: number = 0
  ): Promise<void> {
    const check = await this.checkAndPromptDownload(song);

    if (check.canPlay) {
      // Song is downloaded, play normally
      await this.playSong(song, playlist, index);
    } else {
      // Song not downloaded, throw specific error for UI to handle
      throw new Error(`DOWNLOAD_REQUIRED:${song.title}`);
    }
  }

  // 🆕 Blob URL cleanup management
  private blobUrls = new Set<string>();

  private cleanupBlobUrl(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
      console.log('🗑️ Cleaned up blob URL:', url);
    }
  }

  private trackBlobUrl(url: string): string {
    if (url.startsWith('blob:')) {
      this.blobUrls.add(url);
    }
    return url;
  }

  private cleanupAllBlobUrls(): void {
    this.blobUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
    console.log('🗑️ Cleaned up all blob URLs');
  }

  // Cleanup on destroy
  ngOnDestroy(): void {
    this.cleanupAllBlobUrls();
    this.stopTimeUpdate();
  }

  // 🆕 Method để get current song với thumbnail URL đã resolved
  async getCurrentSongWithThumbnail(): Promise<Song | null> {
    const currentSong = this.currentSong();
    if (!currentSong) return null;
    try {
      // Get thumbnail URL for the current song
      const thumbnailUrl = await this.offlineMediaService.getThumbnailUrl(
        currentSong.id,
        currentSong.thumbnail || ''
      );

      // Return song với thumbnail URL đã resolved
      return {
        ...currentSong,
        thumbnail: thumbnailUrl,
      };
    } catch (error) {
      console.error('❌ Error getting thumbnail for current song:', error);
      return currentSong;
    }
  }

  // 🆕 Method để debug currentSong state
  debugCurrentSongState(): void {
    console.log('🔍 DEBUG: Current song state check');
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('🏠 Is Native:', Capacitor.isNativePlatform());

    const playbackState = this._playbackState();
    const signalSong = this.currentSong();

    console.log(
      '🎵 _playbackState.currentSong:',
      playbackState.currentSong?.title || 'null'
    );
    console.log('🎵 currentSong signal:', signalSong?.title || 'null');
    console.log('📂 filePath:', signalSong?.filePath || 'null');
    console.log('🖼️ thumbnail:', signalSong?.thumbnail || 'null');
    console.log('🎵 audioUrl:', signalSong?.audioUrl || 'null');

    if (playbackState.currentSong !== signalSong) {
      console.warn('⚠️ Signal mismatch detected!');
    }
  }

  // 🆕 Manual restore for testing
  async manualRestorePlaybackState(): Promise<void> {
    console.log('🔧 Manual restore triggered');
    await this.restorePlaybackState();
  }

  // 🆕 Debug method to check current signals
  debugCurrentSignals(): void {
    console.log('🔍 Current signals state:');
    console.log('- currentSong:', this.currentSong()?.title || 'null');
    console.log('- isPlaying:', this.isPlayingSignal());
    console.log('- currentTime:', this.currentTime());
    console.log('- duration:', this.duration());
    console.log(
      '- _playbackState.currentSong:',
      this._playbackState().currentSong?.title || 'null'
    );
  }

  // 🆕 Method để force refresh thumbnail (useful when switching between songs)
  async refreshCurrentSongThumbnail(): Promise<void> {
    const currentSong = this.currentSong();
    if (currentSong) {
      console.log('🔄 Force refreshing thumbnail for:', currentSong.title); // Get fresh thumbnail URL
      const updatedThumbnail = await this.offlineMediaService.getThumbnailUrl(
        currentSong.id,
        currentSong.thumbnail || ''
      );

      // Update song with refreshed thumbnail
      const updatedSong = { ...currentSong, thumbnail: updatedThumbnail };
      this.currentSong.set(updatedSong);

      // Also update in playback state
      this._playbackState.update((state) => ({
        ...state,
        currentSong: updatedSong,
      }));

      console.log('✅ Thumbnail refreshed:', updatedThumbnail);
    }
  }
}
