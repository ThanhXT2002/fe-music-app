import { Injectable, signal } from '@angular/core';
import { Song, PlaybackState } from '../interfaces/song.interface';
import { SavedPlaybackState } from '../interfaces/playback-state.interface';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService {
  private audio: HTMLAudioElement = new Audio();
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
    currentIndex: -1
  });

  public playbackState = this._playbackState.asReadonly();
  private updateInterval?: number;
  private audioCache = new Map<string, string>(); // Cache cho blob URLs
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
    private indexedDBService: IndexedDBService
  ) {
    this.setupAudioEventListeners();
    this.loadSavedSettings();
    this.setupSignalUpdates();
    // Phục hồi trạng thái phát nhạc khi khởi tạo
    this.restorePlaybackState();  }

  // 🆕 Method để load audio với offline support
  private async loadAudioWithBypass(song: Song): Promise<string> {
    try {
      // 🚫 Native platform: Không cho phép streaming khi chưa download
      if (Capacitor.isNativePlatform()) {
        throw new Error('Streaming not allowed on native platform. Song must be downloaded first.');
      }

      // Kiểm tra cache trước (chỉ cho web platform)
      const cacheKey = song.audioUrl;
      if (this.audioCache.has(cacheKey)) {
        return this.audioCache.get(cacheKey)!;
      }

      // Kiểm tra nếu bài hát đã download offline (chỉ cho web platform)
      if (song.isDownloaded) {
        const audioBlob = await this.indexedDBService.getAudioFile(song.id);
        if (audioBlob) {
          const audioObjectUrl = URL.createObjectURL(audioBlob);
          this.audioCache.set(cacheKey, audioObjectUrl);
          return audioObjectUrl;
        } else {
          console.warn('⚠️ Offline audio not found, fallback to streaming:', song.title);
        }
      }

      // 🆕 Retry logic cho streaming (chỉ web platform)
      const maxRetries = 2;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(song.audioUrl, {
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'User-Agent': 'IonicApp/1.0',
              'Accept': 'audio/*,*/*;q=0.9'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const audioBlob = await response.blob();
          const audioObjectUrl = URL.createObjectURL(audioBlob);
          // Cache blob URL
          this.audioCache.set(cacheKey, audioObjectUrl);
          return audioObjectUrl;
        } catch (error) {
          lastError = error;
          console.warn(`❌ Attempt ${attempt} failed:`, error);

          // Nếu không phải lần cuối, đợi một chút trước khi retry
          if (attempt < maxRetries) {
            const delay = attempt * 1000; // 1s, 2s...
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Nếu tất cả attempts đều fail
      throw lastError;

    } catch (error) {
      console.error('❌ All attempts failed for audio loading:', error);
      throw error; // Don't fallback to audioUrl for native platform
    }
  }
  // 🆕 Method để preload audio (optional)
  async preloadAudio(song: Song): Promise<void> {
    try {
      // Chỉ preload nếu chưa có local file
      if (!song.filePath || !song.isDownloaded) {
        if (!this.audioCache.has(song.audioUrl)) {
          await this.loadAudioWithBypass(song);
        }
      }
      // Nếu đã có local file thì không cần preload
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  }
  // 🔄 Modified playSong method
  async playSong(song: Song, playlist: Song[] = [], index: number = 0) {
    try {

      this._playbackState.update(state => ({
        ...state,
        currentSong: song,
        currentPlaylist: playlist.length > 0 ? playlist : [song],
        currentIndex: playlist.length > 0 ? index : 0
      }));      // Kiểm tra xem có local file không (đã download)
      let audioUrl: string;      // Debug: check call stack để xem song được gọi từ đâu
      console.log('🔍 playSong called from:', new Error().stack?.split('\n')[2]);      // Check for downloaded version of the song
      const finalSong = await this.getDownloadedSongVersion(song);

      // 🔍 Check if song can be played on native platform
      const playabilityCheck = await this.checkSongPlayabilityForNative(finalSong);
      if (!playabilityCheck.canPlay && playabilityCheck.message) {
        throw new Error(playabilityCheck.message);
      }

      // Debug song data trước khi check local file
      console.log('🔍 Song debug info:');
      console.log('- Title:', finalSong.title);
      console.log('- filePath:', finalSong.filePath);
      console.log('- isDownloaded:', finalSong.isDownloaded);
      console.log('- audioUrl:', finalSong.audioUrl);if (finalSong.filePath && finalSong.isDownloaded) {
        // Sử dụng local file nếu đã download
        console.log('🎵 Playing from local file:', finalSong.filePath);
        console.log('📱 Platform:', Capacitor.getPlatform());
        console.log('🔧 Is Native:', Capacitor.isNativePlatform());

        if (Capacitor.isNativePlatform()) {
          // Native platform: CHỈ phát local file, không fallback
          audioUrl = await this.tryAllLocalFileApproaches(finalSong.filePath);
          console.log('✅ Local file loaded successfully');
        } else {
          // Web platform: sử dụng file path trực tiếp
          audioUrl = finalSong.filePath;
        }
      } else {
        // Không có local file
        if (Capacitor.isNativePlatform()) {
          // Native platform: YÊU CẦU download trước khi phát
          throw new Error(`Song "${finalSong.title}" chưa được download. Vui lòng download trước khi phát offline.`);
        } else {
          // Web platform: có thể stream từ server
          console.log('🌐 Streaming from URL:', finalSong.audioUrl);
          audioUrl = await this.loadAudioWithBypass(finalSong);
        }
      }// Set audio source và play
      this.audio.src = audioUrl;      try {
        await this.audio.load();
        await this.audio.play();
        console.log('✅ Audio playback started successfully');
      } catch (playError) {
        console.error('❌ Audio playback failed:', playError);

        // Native platform: Không fallback, báo lỗi rõ ràng
        if (Capacitor.isNativePlatform() && finalSong.filePath && finalSong.isDownloaded) {
          throw new Error(`Không thể phát file local: ${finalSong.title}. File có thể bị hỏng hoặc không tương thích.`);
        }

        // Web platform: có thể thử fallback nếu cần
        if (!Capacitor.isNativePlatform() && finalSong.filePath && finalSong.isDownloaded) {
          console.log('🔄 Web platform: Trying fallback to server...');
          try {
            const streamUrl = await this.loadAudioWithBypass(finalSong);
            this.audio.src = streamUrl;
            await this.audio.load();
            await this.audio.play();
            console.log('✅ Fallback streaming successful');
          } catch (fallbackError) {
            console.error('❌ Fallback streaming also failed:', fallbackError);
            throw fallbackError;
          }
        } else {
          throw playError;
        }
      }

      // Preload next song (optional optimization)
      this.preloadNextSong();

    } catch (error) {
      console.error('❌ Error playing song:', error);

      // Show user-friendly error
      this.handlePlaybackError(error, song);
    }  }

  // 🆕 Preload next song for smooth playback
  private async preloadNextSong(): Promise<void> {
    try {
      const state = this._playbackState();
      if (state.currentPlaylist.length > 1) {
        const nextIndex = (state.currentIndex + 1) % state.currentPlaylist.length;
        const nextSong = state.currentPlaylist[nextIndex];

        // Chỉ preload nếu bài tiếp theo chưa có local file và chưa trong cache
        if (nextSong && (!nextSong.filePath || !nextSong.isDownloaded) && !this.audioCache.has(nextSong.audioUrl)) {
          // Preload in background
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

    this._playbackState.update(state => ({
      ...state,
      isPlaying: false,
      isPaused: false
    }));

    // Có thể emit event hoặc show toast notification
    // this.toastService.showError(`Cannot play ${song.title}`);
  }

  // 🆕 Clear cache method
  private clearAudioCache(): void {
    this.audioCache.forEach((blobUrl, originalUrl) => {
      URL.revokeObjectURL(blobUrl);
    });

    this.audioCache.clear();
  }

  // 🔄 Modified destroy method
  destroy() {
    this.stopTimeUpdate();
    this.audio.pause();
    this.audio.src = '';
    this.clearAudioCache(); // Clear cache khi destroy
  }

  private setupAudioEventListeners() {
    this.audio.addEventListener('loadedmetadata', () => {
      this._playbackState.update(state => ({
        ...state,
        duration: this.audio.duration
      }));
    });

    this.audio.addEventListener('timeupdate', () => {
      this._playbackState.update(state => ({
        ...state,
        currentTime: this.audio.currentTime
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
      this.handleSongEnded();
    });

    this.audio.addEventListener('play', () => {
      this._playbackState.update(state => ({
        ...state,
        isPlaying: true,
        isPaused: false
      }));
      this.startTimeUpdate();
    });

    this.audio.addEventListener('pause', () => {
      this._playbackState.update(state => ({
        ...state,
        isPlaying: false,
        isPaused: true
      }));
      this.stopTimeUpdate();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      this._playbackState.update(state => ({
        ...state,
        isPlaying: false,
        isPaused: false
      }));
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
  private setupSignalUpdates() {
    setInterval(() => {
      const state = this._playbackState();
      this.currentSong.set(state.currentSong);
      this.currentTime.set(state.currentTime);
      this.duration.set(state.duration);
      this.isPlayingSignal.set(state.isPlaying);
      this.isShuffling.set(state.isShuffled);
      this.repeatModeSignal.set(state.repeatMode);
      this.queue.set(state.currentPlaylist);
      this.currentIndex.set(state.currentIndex);

      // Update buffer progress more frequently
      this.updateBufferProgress();
    }, 100);
  }

  async pause() {
    if (!this.audio.paused) {
      await this.audio.pause();
    }
  }

  async resume() {
    if (this.audio.paused && this._playbackState().currentSong) {
      await this.audio.play();
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
      this._playbackState.update(state => ({
        ...state,
        currentTime: clampedTime
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
      await new Promise(resolve => setTimeout(resolve, 100));

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
    this._playbackState.update(state => ({
      ...state,
      volume: clampedVolume,
      isMuted: clampedVolume === 0
    }));
    this.saveSettings();
  }

  toggleMute() {
    const currentState = this._playbackState();
    if (currentState.isMuted) {
      this.setVolume(currentState.volume || 0.5);
    } else {
      this.audio.volume = 0;
      this._playbackState.update(state => ({
        ...state,
        isMuted: true
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

    this._playbackState.update(state => ({
      ...state,
      repeatMode: newMode
    }));
    this.saveSettings();
  }

  toggleShuffle() {
    this._playbackState.update(state => ({
      ...state,
      isShuffled: !state.isShuffled
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
          this._playbackState.update(state => ({
            ...state,
            isPlaying: false,
            isPaused: false
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
        this._playbackState.update(state => ({
          ...state,
          currentTime: this.audio.currentTime
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
    localStorage.setItem('audioPlayerSettings', JSON.stringify({
      volume: state.volume,
      isMuted: state.isMuted,
      repeatMode: state.repeatMode,
      isShuffled: state.isShuffled
    }));
  }

  private loadSavedSettings() {
    try {
      const saved = localStorage.getItem('audioPlayerSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this._playbackState.update(state => ({
          ...state,
          volume: settings.volume || 1,
          isMuted: settings.isMuted || false,
          repeatMode: settings.repeatMode || 'none',
          isShuffled: settings.isShuffled || false
        }));

        this.audio.volume = settings.volume || 1;
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }

  async setPlaylist(playlist: Song[], startIndex: number = 0) {
    this._playbackState.update(state => ({
      ...state,
      currentPlaylist: playlist,
      currentIndex: startIndex
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
    this._playbackState.update(state => ({
      ...state,
      currentSong: song
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

      this._playbackState.update(prevState => ({
        ...prevState,
        currentPlaylist: newPlaylist,
        currentIndex: newIndex
      }));
    }
  }

  // 🆕 Additional utility methods
  getCacheSize(): number {
    return this.audioCache.size;
  }

  getCachedUrls(): string[] {
    return Array.from(this.audioCache.keys());
  }

  async clearCache(): Promise<void> {
    this.clearAudioCache();
  }

  // 🆕 Save current playback state to localStorage
  savePlaybackState(): void {
    try {
      const state = this._playbackState();
      const savedState: SavedPlaybackState = {
        currentSong: state.currentSong ? {
          id: state.currentSong.id,
          title: state.currentSong.title,
          artist: state.currentSong.artist,
          url: state.currentSong.audioUrl,
          thumbnail: state.currentSong.thumbnail,
          duration: state.currentSong.duration
        } : null,
        currentTime: state.currentTime,
        isPlaying: false, // Luôn save là false để không tự động play khi restore
        volume: state.volume,
        isShuffling: state.isShuffled,
        repeatMode: state.repeatMode,
        queue: state.currentPlaylist.map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          url: song.audioUrl,
          thumbnail: song.thumbnail,
          duration: song.duration
        })),
        currentIndex: state.currentIndex,
        savedAt: Date.now()
      };

      localStorage.setItem('savedPlaybackState', JSON.stringify(savedState));
    } catch (error) {
      console.error('❌ Error saving playback state:', error);
    }
  }

  // 🆕 Restore playback state from localStorage
  async restorePlaybackState(): Promise<void> {
    try {
      const saved = localStorage.getItem('savedPlaybackState');
      if (!saved) return;

      const savedState: SavedPlaybackState = JSON.parse(saved);

      // Chỉ restore nếu save không quá 7 ngày
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 ngày
      if (Date.now() - savedState.savedAt > maxAge) {
        localStorage.removeItem('savedPlaybackState');
        return;
      }

      if (savedState.currentSong && savedState.queue.length > 0) {        // Convert back to Song objects
        const playlist: Song[] = savedState.queue.map(item => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          audioUrl: item.url,
          thumbnail: item.thumbnail,
          duration: item.duration,
          album: '',
          genre: '',
          isFavorite: false,
          addedDate: new Date(),
          isDownloaded: false
        }));

        // Update state
        this._playbackState.update(state => ({
          ...state,          currentSong: {
            id: savedState.currentSong!.id,
            title: savedState.currentSong!.title,
            artist: savedState.currentSong!.artist,
            audioUrl: savedState.currentSong!.url,
            thumbnail: savedState.currentSong!.thumbnail,
            duration: savedState.currentSong!.duration,
            album: '',
            genre: '',
            isFavorite: false,
            addedDate: new Date(),
            isDownloaded: false
          },
          currentPlaylist: playlist,
          currentIndex: savedState.currentIndex,
          volume: savedState.volume,
          isShuffling: savedState.isShuffling,
          repeatMode: savedState.repeatMode,
          currentTime: savedState.currentTime,
          isPlaying: false // Không tự động play
        }));        // Load audio source nhưng không play
        try {
          // Tạo Song object tạm thời để sử dụng loadAudioWithBypass
          const tempSong: Song = {
            id: savedState.currentSong.id,
            title: savedState.currentSong.title,
            artist: savedState.currentSong.artist,
            audioUrl: savedState.currentSong.url,
            thumbnail: savedState.currentSong.thumbnail,
            duration: savedState.currentSong.duration,
            addedDate: new Date(),
            isFavorite: false
          };

          const audioUrl = await this.loadAudioWithBypass(tempSong);
          this.audio.src = audioUrl;
          await this.audio.load();

          // Seek đến vị trí đã lưu
          if (savedState.currentTime > 0) {
            this.audio.currentTime = savedState.currentTime;
          }
        } catch (error) {
          console.error('❌ Error loading saved audio:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error restoring playback state:', error);
      localStorage.removeItem('savedPlaybackState');
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
   */  private async loadLocalFileAsBlobUrl(filePath: string): Promise<string> {
    try {
      console.log('📂 Loading local file as blob:', filePath);

      // Extract filename from filePath (remove directory prefix if any)
      const fileName = filePath.includes('/') ? filePath.split('/').pop() || '' : filePath;
      const directory = Directory.Cache;

      console.log('📁 Reading file:', `TxtMusic/${fileName}`);

      // First, check if file exists
      try {
        const stat = await Filesystem.stat({
          path: `TxtMusic/${fileName}`,
          directory: directory
        });
        console.log('📊 File stats:', stat);
      } catch (statError) {
        console.error('❌ File does not exist:', statError);
        throw new Error(`File not found: TxtMusic/${fileName}`);
      }

      // Read file as base64
      const fileData = await Filesystem.readFile({
        path: `TxtMusic/${fileName}`,
        directory: directory
      });

      console.log('📄 File read successfully, data type:', typeof fileData.data);

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
        const response = await fetch(`data:${mimeType};base64,${fileData.data}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
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

      const fileName = filePath.includes('/') ? filePath.split('/').pop() || '' : filePath;
      const directory = Directory.Cache;

      // Get the native URI using Filesystem.getUri
      const uriResult = await Filesystem.getUri({
        path: `TxtMusic/${fileName}`,
        directory: directory
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
      { name: 'Native URI', method: () => this.loadLocalFileAsNativeUri(filePath) },
      { name: 'Blob URL', method: () => this.loadLocalFileAsBlobUrl(filePath) }
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

      if (downloadedSong && downloadedSong.isDownloaded && downloadedSong.filePath) {
        console.log('✅ Found downloaded version:', downloadedSong.filePath);
        return downloadedSong;
      }

      // Fallback: search in all songs by title+artist
      const allSongs = await this.databaseService.getAllSongs();
      const matchingSong = allSongs.find(s =>
        s.title === song.title &&
        s.artist === song.artist &&
        s.isDownloaded &&
        s.filePath
      );

      if (matchingSong) {
        console.log('✅ Found downloaded version by title+artist:', matchingSong.filePath);
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
  async checkSongPlayabilityForNative(song: Song): Promise<{ canPlay: boolean; message?: string }> {
    if (!Capacitor.isNativePlatform()) {
      return { canPlay: true }; // Web platform can always try streaming
    }

    // Check if song is downloaded
    const downloadedSong = await this.getDownloadedSongVersion(song);

    if (downloadedSong.filePath && downloadedSong.isDownloaded) {
      // Verify file exists
      try {
        const fileName = downloadedSong.filePath.includes('/') ?
          downloadedSong.filePath.split('/').pop() || '' :
          downloadedSong.filePath;

        await Filesystem.stat({
          path: `TxtMusic/${fileName}`,
          directory: Directory.Cache
        });

        return { canPlay: true };
      } catch (error) {
        return {
          canPlay: false,
          message: `File local đã bị xóa hoặc hỏng. Vui lòng download lại "${song.title}".`
        };
      }
    } else {
      return {
        canPlay: false,
        message: `"${song.title}" chưa được download. Vui lòng download trước khi phát offline.`
      };
    }
  }
}
