export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  duration_formatted?: string;
  thumbnail?: string;
  audioUrl: string;  filePath?: string | null; // local file path
  addedDate: Date;
  isFavorite: boolean;
  genre?: string;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  thumbnail?: string;
  songs: Song[];
  year?: number;
  genre?: string;
  totalDuration: number;
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
  thumbnail_url: string;  audio_url: string;
  duration: number;
  duration_formatted: string;
  keywords: string[];
  searchedAt: Date;
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



