// ─────────────────────────────────────────────────────────
// Domain Song Data - Object chuẩn hóa chung toàn Frontend
// ─────────────────────────────────────────────────────────

/**
 * Model cốt lõi đại diện cho một bài hát trên lớp Client.
 * Mọi component và UI đều phải cắm Interface này để hiển thị thay vì Raw Data từ Backend.
 */
export interface Song {
  // === CORE DATA (Thông số lõi mapping từ Server API) ===
  id: string;
  title: string;
  artist: string;
  /** Độ dài tính theo mốc tổng số giây */
  duration: number;              
  /** Định dạng String đã convert theo chuỗi text (vd: "03:32") để hiển thị UI thẳng khỏi tính lại */
  duration_formatted: string;   
  /** Tag array dùng tra cứu dữ liệu text Filter */
  keywords: string[];            

  // === MEDIA URLs ===
  /** Link path tĩnh trỏ tới file stream Audio */
  audio_url: string;             
  /** Link path tĩnh trỏ tới Cover Thumbnail hình ảnh */
  thumbnail_url: string;         

  // === USER DATA (Thông số Context do người dùng tự thao tác State tại Local) ===
  isFavorite: boolean;
  addedDate: Date;
  lastUpdated?: Date;
  /** Cột mốc timestamp phục vụ tính năng "Nghe gần đây" (Recently Played) */
  lastPlayedDate?: Date;         
}

/**
 * Thông tin cho Collection Album của bài hát - Có thể coi là một Playlist auto.
 */
export interface Album {
  id: string;
  /** Tên playlist (Lưu ý: với Album sinh tự động, sẽ gán trùng tên tác giả) */
  name: string; 
  /** Field dư thừa để gán trùng nghệ sĩ nhất quán Search */
  artist: string; 
  thumbnail?: string;
  songs: Song[];
  year?: number;
  genre?: string;
  totalDuration: number;
  
  // ✨ Các tính năng mở rộng Simplified
  description?: string;
  /** Cờ cho biến Album này do máy Gen ra từ thuật toán (false) hay là do User tự nhóm tạo (true) */
  isUserCreated?: boolean; 
  isEditable?: boolean;
  createdDate?: Date;
  updatedDate?: Date;
}

/**
 * Thông tin Metadata tác giả nghệ sĩ tổng quát.
 */
export interface Artist {
  id: string;
  name: string;
  thumbnail?: string;
  /** NOTE: Biến 'playlists' dùng chung Array nhóm Album để nhất quán cấu trúc cây lồng */
  playlists: Album[]; 
  totalSongs: number;
  bio?: string;
}

/**
 * Lịch sử tìm duyệt bài được lưu trữ tại thiết lập hệ DB Local.
 */
export interface SearchHistoryItem {
  id?: number;
  songId: string;
  title: string;
  artist: string;
  /** Thumbnail path lưu trực tiếp chép từ API res */
  thumbnail_url: string;        
  duration: number;
  duration_formatted: string;
  keywords: string[];
  searchedAt: Date;
  // NOTE: HACK: Đã chủ động loại bỏ việc lưu 'audio_url' thẳng vào History Cache,
  // do link này không có trực tiếp trong API response và URL path backend có thẻ expire. 
  // Chỉ Build construct lại chuỗi string AudioUrl khi User bấm Click.
}

// ─────────────────────────────────────────────────────────
// Cấu trúc Data Transfer API Network (Dữ liệu chưa convert)
// ─────────────────────────────────────────────────────────

/** Response Base bọc Header tổng quan trả về chung khi request `/songs/info` */
export interface SongsResponse<T = DataSong> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Cấu trúc Raw nguyên thủy đổ từ API Get Data. 
 * NOTE: Giao thức này chỉ có các field cơ bản, thiếu sót URL Audio, buộc Mapper qua Converter để thành model Song chuẩn.
 */
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
}

/** Wrapper Response cho tiến trình trạng thái convert tải nhạc Server (Polling status) */
export interface SongStatusResponse {
  success: boolean;
  message: string;
  data: SongStatus;
}

/** Cấu trúc Payload phân tích tỉ lệ phần trăm thanh trạng thái xử lý Data Node. */
export interface SongStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Float number quy chiếu phần trăm từ 0 -> 1 */
  progress: number; 
  error_message?: string;
  audio_filename?: string;
  thumbnail_filename?: string;
  updated_at: string;
}

/** Request cấu hình Payload chứa mảng các File đã hoàn thiện Server. */
export interface CompletedSongsResponse {
  success: boolean;
  data: {
    songs: DataSong[];
    total: number;
  };
}

// ─────────────────────────────────────────────────────────
// Cấu trúc UI Client State (Trạng thái Frontend)
// ─────────────────────────────────────────────────────────

/** Giao diện danh sách Interface cấu trúc cũ (Cần Deprecate) */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  songs: Song[];
  isSystemPlaylist: boolean; // VD: "Recently Played"
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

// ─────────────────────────────────────────────────────────
// Cấu trúc Search Box Layer (Kết quả liên kết tìm kiếm hỗn hợp)
// ─────────────────────────────────────────────────────────

export interface SearchResult {
  songs: Song[];
  artists: Artist[];
  /** NOTE: Artist playlists được render thành Playlists mục đích để đồng nhất phân loại */
  playlists: Album[]; 
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

// ─────────────────────────────────────────────────────────
// Storage System Offline (IndexedDB Layer Interface)
// ─────────────────────────────────────────────────────────

export interface DownloadProgress {
  songId: string;
  progress: number; // Tỉ lệ 0 -> 100
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface AudioFile {
  songId: string;
  /** Tệp nhị phân blob raw audio để cache vào local database IndexedDB */
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: Date;
}
