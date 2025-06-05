export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  thumbnail?: string;
  audioUrl: string;
  filePath?: string; // local file path
  youtubeId?: string;
  youtubeUrl?: string; // YouTube source URL
  addedDate: Date;
  playCount: number;
  isFavorite: boolean;
  lyrics?: string;
  genre?: string;
  year?: number;
  quality?: 'low' | 'medium' | 'high';
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
  isDownloading?: boolean;
  downloadProgress?: number;
}


// dowload youtube song
export interface YouTubeDownloadResponse {
  success: boolean;
  message: string;
  song: YouTubeSong;
  download_path: string;
}

export interface YouTubeSong {
  title: string;
  artist: string;
  artists: string | null;
  album: string | null;
  duration: number;
  genre: string | null;
  release_date: string;
  thumbnail_url: string;
  audio_url: string;
  lyrics: string | null;
  has_lyrics: boolean;
  keywords: string[];
  source: string;
  source_url: string;
  bitrate: string | null;
  language: string | null;
  id: string;
  is_downloaded: boolean;
  downloaded_at: string;
  local_path: string;
  is_favorite: boolean;
  play_count: number;
  last_played_at: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}
