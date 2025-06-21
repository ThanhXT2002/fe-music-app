export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  duration_formatted?: string; // in seconds
  thumbnail?: string;
  audioUrl: string;
  filePath?: string | null; // local file path
  addedDate: Date;
  isFavorite: boolean;
  genre?: string;
  isDownloaded?: boolean; // Đã download file về máy chưa
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


// dowload youtube song
export interface YouTubeDownloadResponse {
  success: boolean;
  message: string;
  data: DataSong;
}

export interface DataSong {
  id:string;
  title: string;
  artist: string;
  duration?: number;
  duration_formatted: string;
  thumbnail_url: string;
  audio_url: string;
  keywords?: string[];
}

export interface SearchHistoryItem {
  id?: number;
  songId: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  audio_url: string;
  duration: number;
  duration_formatted: string;
  keywords: string[];
  searchedAt: Date;
  isDownloaded: boolean; // Đã download về máy chưa
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
