export interface Song {
  // === CORE DATA (từ API) ===
  id: string;
  title: string;
  artist: string;
  duration: number;              // seconds
  duration_formatted: string;   // "03:32"
  keywords: string[];            // từ API để search
  // === MEDIA URLs ===
  audio_url: string;             // URL audio
  thumbnail_url: string;         // URL thumbnail
  // === USER DATA ===
  isFavorite: boolean;
  addedDate: Date;
  lastUpdated?: Date;
  lastPlayedDate?: Date;         // Cho Recently Played
}

export interface Album {
  id: string;
  name: string; // Will be artist name for auto-generated albums
  artist: string; // Same as name for consistency
  thumbnail?: string;
  songs: Song[];
  year?: number;
  genre?: string;
  totalDuration: number;
  // ✨ Simplified album features
  description?: string;
  isUserCreated?: boolean; // false = auto-generated from artist, true = user-created
  isEditable?: boolean;    // whether user can modify this album
  createdDate?: Date;
  updatedDate?: Date;
}

export interface Artist {
  id: string;
  name: string;
  thumbnail?: string;
  albums: Album[];
  totalSongs: number;
  bio?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  songs: Song[];
  isSystemPlaylist: boolean; // for "Recently Played", "Favorites" etc.
  createdDate: Date;
  updatedDate: Date;
}

export interface PlaybackState {
  currentSong: Song | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
  currentPlaylist: Song[];
  currentIndex: number;
}

export interface UserPreferences {
  darkMode: boolean;
  autoPlayNext: boolean;
  audioQuality: 'low' | 'medium' | 'high';
  downloadOverWifiOnly: boolean;
  showLyrics: boolean;
  crossfadeDuration: number;
  equalizerPreset?: string;
}

export interface SearchResult {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export interface YoutubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  viewCount?: string;
  publishedAt: string;
}

export interface DownloadProgress {
  songId: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  url: string;
  isDownloading?: boolean;
  downloadProgress?: number;
}


// === API RESPONSE INTERFACES ===

// Response từ POST /songs/info
export interface YouTubeDownloadResponse {
  success: boolean;
  message: string;
  data: DataSong;
}

// Data bài hát từ API
export interface DataSong {
  id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  duration: number;
  duration_formatted: string;
  keywords: string[];
  original_url: string;
  created_at: string;
  // NOTE: audio_url sẽ được construct từ API endpoint
}

// Response từ GET /songs/status/{song_id}
export interface SongStatusResponse {
  success: boolean;
  message: string;
  data: SongStatus;
}

export interface SongStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0, 0.5, 1
  error_message?: string;
  audio_filename?: string;
  thumbnail_filename?: string;
  updated_at: string;
}

// Response từ GET /songs/completed
export interface CompletedSongsResponse {
  success: boolean;
  data: {
    songs: DataSong[];
    total: number;
  };
}

// === SEARCH HISTORY ===
export interface SearchHistoryItem {
  id?: number;
  songId: string;
  title: string;
  artist: string;
  thumbnail_url: string;        // Lưu trực tiếp từ API response
  duration: number;
  duration_formatted: string;
  keywords: string[];
  searchedAt: Date;
  // NOTE: Không lưu audio_url vì không có trong API response, chỉ construct khi cần
}

// === CONVERSION UTILITIES ===
export class SongConverter {
  private static readonly API_BASE_URL = 'https://api-music.tranxuanthanhtxt.com/api/v3';

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
    return song.audio_url.startsWith('blob://') || song.audio_url.startsWith('blob:');
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

// Interfaces for offline file storage
export interface AudioFile {
  songId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface ThumbnailFile {
  songId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: Date;
}
