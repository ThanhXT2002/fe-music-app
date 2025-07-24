import { Injectable, signal, effect } from '@angular/core';
import { YTPlayerTrack } from '../interfaces/ytmusic.interface';

@Injectable({
  providedIn: 'root'
})
export class YtPlayerService {
  currentPlaylist = signal<YTPlayerTrack[] | null>(this.loadFromStorage<YTPlayerTrack[]>('yt-tracks'));
  playlistId = signal<string | null>(this.loadFromStorage<string>('yt-playlistId'));
  ralated = signal<string | null>(this.loadFromStorage<string>('yt-related'));

  constructor() {
    // Auto-save to localStorage on signal change using effect
    effect(() => {
      this.saveToStorage('yt-tracks', this.currentPlaylist());
      this.saveToStorage('yt-playlistId', this.playlistId());
      this.saveToStorage('yt-related', this.ralated());
    });
  }

  private loadFromStorage<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private saveToStorage(key: string, value: any) {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {}
  }


  currentIndex = signal<number>(0);
  currentSong = signal<YTPlayerTrack | null>(null);
  isPlaying = signal<boolean>(true);
  isShuffling = signal<boolean>(false);
  songTitle = signal<string>('');
  songArtist = signal<string>('');
  songThumbnail = signal<string>('');
  songDuration = signal<string>('');
}
