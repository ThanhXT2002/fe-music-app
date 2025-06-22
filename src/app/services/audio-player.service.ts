import { Injectable, signal } from '@angular/core';
import { Song, PlaybackState } from '../interfaces/song.interface';
import { SavedPlaybackState } from '../interfaces/playback-state.interface';
import { DatabaseService } from './database.service';
import { IndexedDBService } from './indexeddb.service';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
    private indexedDBService: IndexedDBService,
    private http: HttpClient
  ) {
    this.setupAudioEventListeners();
    this.loadSavedSettings();
    this.setupSignalUpdates();
    // Phục hồi trạng thái phát nhạc khi khởi tạo
    this.restorePlaybackState();
  }  // 🆕 Method để load audio, chỉ từ IndexedDB để đảm bảo offline
  private async loadAudioWithBypass(song: Song): Promise<string> {
    try {
      // 1. Kiểm tra cache trước (sử dụng ID bài hát làm key)
      const cacheKey = song.id.toString();
      if (this.audioCache.has(cacheKey)) {
        return this.audioCache.get(cacheKey)!;
      }

      // 2. Luôn tải từ IndexedDB
      console.log('🔍 Loading audio from IndexedDB for:', song.title);
      const audioBlob = await this.indexedDBService.getAudioFile(song.id);

      if (audioBlob) {
        const audioObjectUrl = URL.createObjectURL(audioBlob);
        this.audioCache.set(cacheKey, audioObjectUrl); // Cache lại blob URL
        console.log('✅ Audio loaded from IndexedDB:', song.title);
        return audioObjectUrl;
      } else {
        // 3. Nếu không tìm thấy trong DB, báo lỗi -> không fallback
        console.error('❌ Audio not found in IndexedDB for song:', song.title);
        throw new Error(`Audio for '${song.title}' not found offline.`);
      }
    } catch (error) {
      console.error('❌ Failed to load audio from database:', error);
      // Ném lại lỗi để playSong có thể xử lý
      throw error;
    }
  }

  // 🆕 Method để preload audio (optional)
  async preloadAudio(song: Song): Promise<void> {
    try {
      const cacheKey = song.id.toString();
      if (!this.audioCache.has(cacheKey)) {
        await this.loadAudioWithBypass(song);
      }
    } catch (error) {
      // Lỗi preload không cần hiển thị cho người dùng, chỉ log
      console.log(`Preload failed for ${song.title}: ${error}`);
    }
  }
  // 🔄 Modified playSong method
  async playSong(song: Song, playlist: Song[] = [], index: number = 0) {
    try {
      // Pause current audio and reset
      this.audio.pause();
      this.audio.currentTime = 0;

      this._playbackState.update(state => ({
        ...state,
        currentSong: song,
        currentPlaylist: playlist.length > 0 ? playlist : [song],
        currentIndex: playlist.length > 0 ? index : 0,
        isPlaying: false
      }));

      // Load audio với bypass headers
      const audioUrl = await this.loadAudioWithBypass(song);

      // Set audio source và wait for load
      this.audio.src = audioUrl;

      // Wait for audio to be ready before playing
      await new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
          this.audio.removeEventListener('canplay', handleCanPlay);
          this.audio.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = (event: Event) => {
          this.audio.removeEventListener('canplay', handleCanPlay);
          this.audio.removeEventListener('error', handleError);
          reject(new Error('Failed to load audio'));
        };

        this.audio.addEventListener('canplay', handleCanPlay);
        this.audio.addEventListener('error', handleError);

        this.audio.load();
      });

      // Now safely play the audio
      await this.audio.play();

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
        const nextIndex = (state.currentIndex + 1) % state.currentPlaylist.length;
        const nextSong = state.currentPlaylist[nextIndex];

        if (nextSong) {
          // Preload in background, the cache check is inside preloadAudio
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

    // Don't handle AbortError as it's expected during reload
    if (error?.name === 'AbortError' || error?.message?.includes('interrupted by a new load request')) {
      console.log('⚠️ Play request was aborted (expected during reload)');
      return;
    }

    this._playbackState.update(state => ({
      ...state,
      isPlaying: false,
      isPaused: false
    }));

    // For other errors, show user notification
    console.warn(`⚠️ Cannot play ${song.title}:`, error?.message || error);
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
    });    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);

      // Handle different types of audio errors
      const error = this.audio.error;
      if (error) {
        console.error('Audio error details:', {
          code: error.code,
          message: error.message
        });

        // Don't update state for abort errors (these are expected during reload)
        if (error.code !== MediaError.MEDIA_ERR_ABORTED) {
          this._playbackState.update(state => ({
            ...state,
            isPlaying: false,
            isPaused: false
          }));
        }
      }
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
    try {
      if (this.audio.paused && this._playbackState().currentSong) {
        // Check if audio source is valid before playing
        if (!this.audio.src || this.audio.src === '') {
          console.warn('⚠️ No audio source, reloading current song...');
          const currentSong = this._playbackState().currentSong;
          if (currentSong) {
            await this.playSong(currentSong, this._playbackState().currentPlaylist, this._playbackState().currentIndex);
            return;
          }
        }

        await this.audio.play();
      }
    } catch (error) {
      console.error('❌ Error resuming audio:', error);

      // If resume fails, try to reload current song
      const currentSong = this._playbackState().currentSong;
      if (currentSong) {
        console.log('🔄 Attempting to reload current song...');
        await this.playSong(currentSong, this._playbackState().currentPlaylist, this._playbackState().currentIndex);
      }
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

  // 🆕 Get audio element for equalizer
  getAudioElement(): HTMLAudioElement {
    return this.audio;
  }
}
