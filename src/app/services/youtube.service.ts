import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  YoutubeSearchResult,
  Song,
  YouTubeDownloadResponse,
} from '../interfaces/song.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  searchYoutubeVideo(url: string): Observable<YoutubeSearchResult> {
    return this.http
      .post<YoutubeSearchResult>(`${this.apiUrl}/youtube/search`, { url })
      .pipe(
        catchError((error) => {
          console.error('Error searching YouTube video:', error);
          throw error;
        })
      );
  }

  downloadFromYoutube(
    url: string,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Observable<Song> {
    return this.http
      .post<any>(`${this.apiUrl}/youtube/download`, { url, quality })
      .pipe(
        map((response) => this.mapApiResponseToSong(response)),
        catchError((error) => {
          console.error('Error downloading from YouTube:', error);
          throw error;
        })
      );
  }

  getVideoInfo(videoId: string): Observable<YoutubeSearchResult> {
    return this.http
      .get<YoutubeSearchResult>(`${this.apiUrl}/youtube/info/${videoId}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting video info:', error);
          throw error;
        })
      );
  }

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  validateYoutubeUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  private mapApiResponseToSong(response: any): Song {
    return {
      id: this.generateSongId(),
      title: response.title || 'Unknown Title',
      artist: response.artist || response.channelTitle || 'Unknown Artist',
      album: response.album || undefined,
      duration: this.parseDuration(response.duration) || 0,
      thumbnail: response.thumbnail || undefined,
      audioUrl: response.audioUrl,
      filePath: response.filePath || undefined,
      addedDate: new Date(),
      isFavorite: false,
      genre: response.genre || undefined,
    };
  }

  private generateSongId(): string {
    return `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseDuration(duration: string | number): number {
    if (typeof duration === 'number') {
      return duration;
    }

    if (typeof duration === 'string') {
      // Parse duration in format "MM:SS" or "HH:MM:SS"
      const parts = duration.split(':').map(Number);

      if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }

    return 0;
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // download youtube video
  getYoutubeUrlInfo(url: string): Observable<YouTubeDownloadResponse> {
    const params = new HttpParams().set('url', url);
    return this.http
      .post<YouTubeDownloadResponse>(`${this.apiUrl}/songs/info`, null, {
        params,
      })
      .pipe(
        catchError((error) => {
          console.error('Error downloading from YouTube:', error);
          throw error;
        })
      );
  }
}
