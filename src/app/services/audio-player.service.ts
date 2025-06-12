import { Injectable, signal } from '@angular/core';
import { Song, PlaybackState } from '../interfaces/song.interface';
import { DatabaseService } from './database.service';

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

  constructor(private databaseService: DatabaseService) {
    this.setupAudioEventListeners();
    this.loadSavedSettings();
    this.setupSignalUpdates();
  }

  // 🆕 Method để load audio với ngrok bypass
  private async loadAudioWithBypass(audioUrl: string): Promise<string> {
    try {
      // Kiểm tra cache trước
      if (this.audioCache.has(audioUrl)) {
        console.log('🎵 Using cached audio:', audioUrl);
        return this.audioCache.get(audioUrl)!;
      }

      console.log('🔄 Loading audio with bypass headers:', audioUrl);

      // 🆕 Retry logic
      const maxRetries = 2;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${maxRetries} for:`, audioUrl);

          const response = await fetch(audioUrl, {
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
          this.audioCache.set(audioUrl, audioObjectUrl);

          console.log('✅ Audio loaded successfully:', {
            originalUrl: audioUrl,
            blobUrl: audioObjectUrl,
            size: `${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`,
            attempt: attempt
          });

          return audioObjectUrl;

        } catch (error) {
          lastError = error;
          console.warn(`❌ Attempt ${attempt} failed:`, error);

          // Nếu không phải lần cuối, đợi một chút trước khi retry
          if (attempt < maxRetries) {
            const delay = attempt * 1000; // 1s, 2s...
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Nếu tất cả attempts đều fail
      throw lastError;

    } catch (error) {
      console.error('❌ All attempts failed for audio loading:', error);

      // Fallback: thử load trực tiếp
      console.log('🔄 Fallback: trying direct load...');
      return audioUrl;
    }
  }

  // 🆕 Method để preload audio (optional)
  async preloadAudio(song: Song): Promise<void> {
    try {
      if (!this.audioCache.has(song.audioUrl)) {
        await this.loadAudioWithBypass(song.audioUrl);
        console.log('🎵 Preloaded:', song.title);
      }
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  }

  // 🔄 Modified playSong method
  async playSong(song: Song, playlist: Song[] = [], index: number = 0) {
    try {
      console.log('🎵 Playing song:', song.title);

      this._playbackState.update(state => ({
        ...state,
        currentSong: song,
        currentPlaylist: playlist.length > 0 ? playlist : [song],
        currentIndex: playlist.length > 0 ? index : 0
      }));

      // Load audio với bypass headers
      const audioUrl = await this.loadAudioWithBypass(song.audioUrl);

      // Set audio source và play
      this.audio.src = audioUrl;
      await this.audio.load();
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

        if (nextSong && !this.audioCache.has(nextSong.audioUrl)) {
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
    console.log('🧹 Clearing audio cache...');

    this.audioCache.forEach((blobUrl, originalUrl) => {
      URL.revokeObjectURL(blobUrl);
      console.log('🗑️ Revoked:', originalUrl);
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

  // Rest of the methods remain the same...
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
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
    }
  }

  async seek(time: number) {
    this.seekTo(time);
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
}
