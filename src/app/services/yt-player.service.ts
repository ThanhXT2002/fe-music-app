import { Injectable, signal } from '@angular/core';
import { YTPlayerTrack } from '../interfaces/ytmusic.interface';

@Injectable({
  providedIn: 'root'
})
export class YtPlayerService {
  currentPlaylist = signal<YTPlayerTrack[] | null>(null);
  playlistId = signal<string | null>(null);
  ralated = signal<string | null>(null);
}
