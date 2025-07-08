import { Song } from './song.interface';

/**
 * Extended Playlist interface for system and dynamic playlists
 */
export interface SystemPlaylist extends Playlist {
  type: 'system' | 'dynamic' | 'user';
  autoUpdate: boolean;
  query?: string;
  icon?: string;
  color?: string;
  systemId?: string; // For system playlists like 'favorites', 'downloaded'
}

/**
 * Base Playlist interface (from song.interface.ts)
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  songs: Song[];
  isSystemPlaylist: boolean;
  isUserCreatedArtistPlaylist?: boolean; // ✨ Thêm field để phân biệt artist playlist do user tạo
  createdDate: Date;
  updatedDate: Date;
}

/**
 * Playlist creation request
 */
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  thumbnail?: string;
  type?: 'user' | 'system' | 'dynamic';
  autoUpdate?: boolean;
  songIds?: string[];
}

/**
 * Playlist statistics
 */
export interface PlaylistStats {
  totalPlaylists: number;
  systemPlaylists: number;
  userPlaylists: number;
  totalSongs: number;
  averageSongsPerPlaylist: number;
  mostPopularPlaylist: {
    id: string;
    name: string;
    songCount: number;
  } | null;
}

/**
 * Dynamic playlist configuration
 */
export interface DynamicPlaylistConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  query: {
    type: 'filter' | 'sort' | 'group';
    field: keyof Song;
    operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
    value: any;
  }[];
  limit?: number;
  sortBy?: keyof Song;
  sortOrder?: 'asc' | 'desc';
}

/**
 * System playlist definitions
 */
export const SYSTEM_PLAYLISTS = {
  FAVORITES: {
    id: 'system_favorites',
    name: '❤️ Yêu thích',
    description: 'Các bài hát yêu thích của bạn',
    icon: 'heart',
    color: '#ef4444',
    type: 'system' as const
  },
  DOWNLOADED: {
    id: 'system_downloaded',
    name: '💾 Đã tải xuống',
    description: 'Các bài hát đã tải về máy',
    icon: 'download',
    color: '#10b981',
    type: 'system' as const
  },
  RECENT: {
    id: 'system_recent',
    name: '🕐 Nghe gần đây',
    description: 'Các bài hát nghe gần đây',
    icon: 'clock',
    color: '#3b82f6',
    type: 'system' as const
  },
  POPULAR: {
    id: 'system_popular',
    name: '📊 Phổ biến nhất',
    description: 'Các bài hát được nghe nhiều nhất',
    icon: 'trending-up',
    color: '#f59e0b',
    type: 'system' as const
  },
  ALL_SONGS: {
    id: 'system_all',
    name: '🎵 Tất cả bài hát',
    description: 'Toàn bộ thư viện nhạc',
    icon: 'music',
    color: '#8b5cf6',
    type: 'system' as const
  }
} as const;

/**
 * Dynamic playlist definitions
 */
export const DYNAMIC_PLAYLISTS = {
  BY_ARTIST: {
    id: 'dynamic_by_artist',
    name: '👨‍🎤 Theo nghệ sĩ',
    description: 'Playlist được tạo tự động theo nghệ sĩ',
    type: 'dynamic' as const
  },
  BY_ALBUM: {
    id: 'dynamic_by_album',
    name: '💿 Theo album',
    description: 'Playlist được tạo tự động theo album',
    type: 'dynamic' as const
  },
  BY_GENRE: {
    id: 'dynamic_by_genre',
    name: '🎸 Theo thể loại',
    description: 'Playlist được tạo tự động theo thể loại nhạc',
    type: 'dynamic' as const
  }
} as const;

/**
 * Playlist export/import format
 */
export interface PlaylistExport {
  playlist: Playlist;
  songs: Song[];
  exportDate: string;
  version: string;
}

/**
 * Playlist sharing data
 */
export interface PlaylistShare {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  createdBy?: string;
  shareCode?: string;
  expiresAt?: Date;
}
