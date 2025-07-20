import { environment } from "src/environments/environment";

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
  name: string; // Tên playlist (với auto-generated sẽ là tên artist)
  artist: string; // Giống với name để nhất quán
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
  playlists: Album[]; // Đổi từ albums sang playlists để nhất quán
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
  artists: Artist[];
  playlists: Album[]; // Artist playlists được hiển thị dưới dạng playlists
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
export interface SongsResponse<T = DataSong> {
  success: boolean;
  message: string;
  data: T;
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
  original_url?: string;
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



// Interfaces for offline file storage
export interface AudioFile {
  songId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: Date;
}

