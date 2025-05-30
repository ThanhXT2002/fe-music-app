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

    // Update signals when playback state changes
    this.setupSignalUpdates();
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
    // Subscribe to playback state changes and update individual signals
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

  async playSong(song: Song, playlist: Song[] = [], index: number = 0) {
    try {
      this._playbackState.update(state => ({
        ...state,
        currentSong: song,
        currentPlaylist: playlist.length > 0 ? playlist : [song],
        currentIndex: playlist.length > 0 ? index : 0
      }));

      this.audio.src = song.audioUrl;
      await this.audio.load();
      await this.audio.play();

      // Update play count in database
      await this.databaseService.updateSongPlayCount(song.id);

    } catch (error) {
      console.error('Error playing song:', error);
    }
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

  // Alias for seekTo for PlayerPage compatibility
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
      // Random next song
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

    // If we're more than 3 seconds into the song, restart current song
    if (this.audio.currentTime > 3) {
      this.seekTo(0);
      return;
    }

    let prevIndex: number;

    if (state.isShuffled) {
      // Random previous song
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
        // Repeat current song
        this.seekTo(0);
        await this.audio.play();
        break;
      case 'all':
        // Play next song in playlist
        await this.playNext();
        break;
      case 'none':
        // Check if there's a next song
        if (state.currentIndex < state.currentPlaylist.length - 1) {
          await this.playNext();
        } else {
          // Playlist ended
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

  destroy() {
    this.stopTimeUpdate();
    this.audio.pause();
    this.audio.src = '';
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
        // If removing current song, adjust index
        newIndex = Math.min(newIndex, newPlaylist.length - 1);
      }

      this._playbackState.update(prevState => ({
        ...prevState,
        currentPlaylist: newPlaylist,
        currentIndex: newIndex
      }));
    }
  }
}
