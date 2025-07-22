import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Song } from '../interfaces/song.interface';

@Injectable({
  providedIn: 'root'
})
export class YtPlayerService {
  // Playlist hiện tại
  private playlistSubject = new BehaviorSubject<Song[]>([]);
  playlist$ = this.playlistSubject.asObservable();

  // Index bài hát đang phát
  private currentIndexSubject = new BehaviorSubject<number>(0);
  currentIndex$ = this.currentIndexSubject.asObservable();

  // Trạng thái player (playing, paused, stopped)
  private playerStateSubject = new BehaviorSubject<'playing' | 'paused' | 'stopped'>('stopped');
  playerState$ = this.playerStateSubject.asObservable();

  // Lưu playlist mới
  setPlaylist(songs: Song[], startIndex: number = 0) {
    this.playlistSubject.next(songs);
    this.currentIndexSubject.next(startIndex);
    this.playerStateSubject.next('playing');
  }

  // Lấy bài hát hiện tại
  getCurrentSong(): Song | null {
    const playlist = this.playlistSubject.getValue();
    const idx = this.currentIndexSubject.getValue();
    return playlist[idx] || null;
  }

  // Next bài hát
  nextSong() {
    const playlist = this.playlistSubject.getValue();
    let idx = this.currentIndexSubject.getValue();
    if (idx < playlist.length - 1) {
      this.currentIndexSubject.next(idx + 1);
      this.playerStateSubject.next('playing');
    }
  }

  // Previous bài hát
  previousSong() {
    let idx = this.currentIndexSubject.getValue();
    if (idx > 0) {
      this.currentIndexSubject.next(idx - 1);
      this.playerStateSubject.next('playing');
    }
  }

  // Pause
  pause() {
    this.playerStateSubject.next('paused');
  }

  // Play
  play() {
    this.playerStateSubject.next('playing');
  }

  // Stop
  stop() {
    this.playerStateSubject.next('stopped');
  }

  // Chuyển tới bài hát theo index
  goToSong(index: number) {
    const playlist = this.playlistSubject.getValue();
    if (index >= 0 && index < playlist.length) {
      this.currentIndexSubject.next(index);
      this.playerStateSubject.next('playing');
    }
  }
}
