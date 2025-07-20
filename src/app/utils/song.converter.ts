import { environment } from "src/environments/environment";
import { DataSong, SearchHistoryItem, Song } from "../interfaces/song.interface";

// === CONVERSION UTILITIES ===
export class SongConverter {
  private static readonly API_BASE_URL = environment.apiUrl;

  /**
   * Convert API DataSong to unified Song format
   */
  static fromApiData(data: DataSong): Song {
    return {
      id: data.id,
      title: data.title,
      artist: data.artist,
      duration: data.duration,
      duration_formatted: data.duration_formatted,
      thumbnail_url: data.thumbnail_url,
      audio_url: `${this.API_BASE_URL}/songs/download/${data.id}`,
      keywords: data.keywords,

      // User data defaults
      isFavorite: false,
      addedDate: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Convert Song to SearchHistoryItem
   */
  static toSearchHistory(song: Song): SearchHistoryItem {
    return {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: song.thumbnail_url,
      duration: song.duration,
      duration_formatted: song.duration_formatted,
      keywords: song.keywords,
      searchedAt: new Date()
    };
  }

  /**
   * Convert DataSong to SearchHistoryItem (for immediate search results)
   */
  static apiDataToSearchHistory(data: DataSong): SearchHistoryItem {
    return {
      songId: data.id,
      title: data.title,
      artist: data.artist,
      thumbnail_url: data.thumbnail_url,
      duration: data.duration,
      duration_formatted: data.duration_formatted,
      keywords: data.keywords,
      searchedAt: new Date()
    };
  }

  /**
   * Update Song với offline URLs sau khi download
   */
  static markAsDownloaded(song: Song, audioBlobUrl: string): Song {
    return {
      ...song,
      audio_url: audioBlobUrl,
      lastUpdated: new Date()
    };
  }

  /**
   * Check if Song is downloaded (offline) by URL pattern
   */
  static isDownloaded(song: Song): boolean {
    return song.audio_url.startsWith('blob:');
  }

  /**
   * Fake progress based on status for IndexedDB
   */
  static getProgressFromStatus(status: string): number {
    switch (status.toLowerCase()) {
      case 'pending': return 0;
      case 'processing': return 50;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  }

  /**
   * Check if song is ready for download based on status
   */
  static isReadyForDownload(status: string): boolean {
    return status.toLowerCase() === 'completed';
  }

  /**
   * Get download URL with download=true parameter
   */
  static getDownloadUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/download/${songId}?download=true`;
  }

  /**
   * Get thumbnail download URL
   */
  static getThumbnailDownloadUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/thumbnail/${songId}`;
  }

  /**
   * Get streaming URL (without download parameter)
   */
  static getStreamingUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/download/${songId}`;
  }
}
