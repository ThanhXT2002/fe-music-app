import { Song } from './song.interface';

// ─────────────────────────────────────────────────────────
// Cấu trúc Playlist tĩnh và hệ thống
// ─────────────────────────────────────────────────────────

/**
 * Interface cấu trúc gốc của một danh sách phát (Playlist base).
 * Tham chiếu dùng chung để biểu diễn Metadata cho tất các dạng list collection nhạc.
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  songs: Song[];
  isSystemPlaylist: boolean;
  // ✨ HACK: Thêm field `isUserCreatedArtistPlaylist` để phân tách danh sách List do 
  // User chủ động tổng hợp tự gom khác với List auto-gen chạy thuật toán của Artist tạo sẵn
  isUserCreatedArtistPlaylist?: boolean; 
  createdDate: Date;
  updatedDate: Date;
}

/**
 * Bản mở rộng cấu trúc SystemPlaylist cho các List cố định sẵn có trên App.
 * Các List này hoạt động khác List User (tự cập nhật Realtime "nghe gần đây", phân query...).
 */
export interface SystemPlaylist extends Playlist {
  type: 'system' | 'dynamic' | 'user';
  autoUpdate: boolean;
  query?: string;
  icon?: string;
  color?: string;
  /** Label hằng định danh nội sinh để móc nối logic cho system list cụ thể (VD 'favorites', 'downloaded') */
  systemId?: string; 
}

/**
 * Params payload cấu trúc dùng để bắn Request tạo Playlist mới.
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
 * Thông số thống kê đếm tổng lược về kho Playlists.
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

// ─────────────────────────────────────────────────────────
// Cấu trúc Playlist động (Dynamic Smart List)
// ─────────────────────────────────────────────────────────

/**
 * Cấu hình cấu trúc sinh List tự động bằng cách Filter và Query (Database ảo Filter rules).
 * Danh sách này không chứa Index Array Data nhạc trực tiếp, mà map query logic lọc tại Local.
 */
export interface DynamicPlaylistConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  /** Mảng logic các điều kiện bộ lọc */
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

// ─────────────────────────────────────────────────────────
// Định nghĩa các biến Enum/Constant Hằng số danh sách cố định
// ─────────────────────────────────────────────────────────

/**
 * Constant khai báo tĩnh các List Hệ thống mặc định (Static definitions).
 * Dữ liệu này không nằm trên Backend, là các Tab list gắn cố định trên giao diện UI cho trải nghiệm người dùng.
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
 * Constant Label cho Playlist Smart Generator.
 */
export const DYNAMIC_PLAYLISTS = {
  BY_ARTIST: {
    id: 'dynamic_by_artist',
    name: '👨‍🎤 Theo nghệ sĩ',
    description: 'Playlist được tạo tự động nhóm theo nghệ sĩ',
    type: 'dynamic' as const
  },
  BY_ALBUM: {
    id: 'dynamic_by_album',
    name: '💿 Theo album',
    description: 'Playlist được tạo tự động nhóm theo album',
    type: 'dynamic' as const
  },
  BY_GENRE: {
    id: 'dynamic_by_genre',
    name: '🎸 Theo thể loại',
    description: 'Playlist được tạo tự động phân bố theo thể loại nhạc',
    type: 'dynamic' as const
  }
} as const;

// ─────────────────────────────────────────────────────────
// Cấu trúc Data Transfer Share/Export
// ─────────────────────────────────────────────────────────

/**
 * Cấu trúc đóng gói dạng JSON Backup để trích xuất hoặc đẩy Playlist lên tệp sao lưu máy.
 */
export interface PlaylistExport {
  // Toàn bộ Info Playlist
  playlist: Playlist;
  // Cây dữ liệu bài nhạc
  songs: Song[];
  exportDate: string;
  version: string;
}

/**
 * Cấu trúc link Share cho chức năng phát tán/chia sẻ Playlist cho người dùng khác.
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
