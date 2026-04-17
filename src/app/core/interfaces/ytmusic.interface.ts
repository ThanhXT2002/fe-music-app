// ─────────────────────────────────────────────────────────
// Cấu trúc Track List hiển thị cho Core YtMusic (Mảng Item)
// ─────────────────────────────────────────────────────────

/**
 * Cấu trúc Interface Data Base căn bản của một Track âm nhạc lấy từ YtMusic proxy.
 * Đây là model thô đút vào quá trình Mapper xử lý của Converter.
 */
export interface YTPlayerTrack {
  videoId: string;
  title: string;
  length?: string;
  thumbnail?: YTMusicThumbnail[];
  feedbackTokens?: any;
  likeStatus?: any;
  inLibrary?: boolean;
  videoType?: string;
  artists?: { name: string; id?: string }[];
  album?: { id: string; name?: string };
  year?: string;
  views?: string;
}

// ─────────────────────────────────────────────────────────
// Cấu trúc Data Trả Về nguyên gốc bóc tách từ Tool Scraper
// ─────────────────────────────────────────────────────────

/**
 * Watch Playlist Flow (Luồng response thực tế từ mỏ neo xem YtMusic)
 */
export interface YTMusicWatchPlaylistResponse {
  tracks: YTPlayerTrack[];
  playlistId?: string;
  lyrics?: string | null;
  /** Browse ID liên đới gợi ý tiếp theo */
  related?: string;
}

/** Tái sử dụng cấu trúc Section gợi ý Related Item List */
export interface YTMusicRelatedResponse {
  title: string;
  contents: YTMusicRelatedItem[];
}

/** Item chung hỗn hợp liên quan (có thể rẽ nhánh Video, Bài Hát, hay Artist...) */
export interface YTMusicRelatedItem {
  title?: string;
  description?: string;
  videoId?: string;
  browseId?: string;
  thumbnails?: YTMusicThumbnail[];
  /** Cú chắp phá Data Dictionary cho các trường mở rộng không biết được Key */
  [key: string]: any;
}

/** Cấu trúc Data Node trích xuất kiểu tham số Tác giả (Artist) */
export interface YTMusicArtist {
  category?: string | null;
  resultType: 'artist';
  artist?: string;
  artists?: { name: string; id?: string }[];
  shuffleId?: string;
  radioId?: string;
  browseId?: string;
  subscribers?: string;
  thumbnails: YTMusicThumbnail[];
}

/** Cấu trúc Data Node trích xuất kiểu tham số Bài Nhạc Rời (Thành phần lá) */
export interface YTMusicSong {
  category?: string | null;
  resultType: 'song';
  title: string;
  album?: { id: string } | null;
  inLibrary?: boolean;
  feedbackTokens?: { remove: string | null };
  videoId: string;
  videoType?: string;
  duration: string;
  year?: string | null;
  artists: YTMusicArtist[];
  duration_seconds: number;
  views?: string;
  isExplicit?: boolean;
  thumbnails: YTMusicThumbnail[];
}

/** Danh sách tĩnh Album phát nhạc */
export interface YTMusicPlaylist {
  category?: string | null;
  resultType: 'playlist';
  title: string;
  itemCount?: string | number;
  author?: string;
  browseId: string;
  thumbnails: YTMusicThumbnail[];
}

/** Node gộp Nhánh phân bố Album CD xuất xưởng */
export interface YTMusicAlbum {
  title: string;
  type?: string;
  thumbnails: YTMusicThumbnail[];
  isExplicit?: boolean;
  description?: string | null;
  artists: YTMusicArtist[];
  year?: string;
  trackCount?: number;
  duration?: string;
  audioPlaylistId?: string;
  likeStatus?: string;
  tracks: YTMusicSong[];
  other_versions?: any[];
  duration_seconds?: number;
}

// ─────────────────────────────────────────────────────────
// Cấu trúc Detail Endpoint Data chuyên sâu (Trang chi tiết)
// ─────────────────────────────────────────────────────────

export interface YTMusicPlaylistDetail {
  owned?: boolean;
  id: string;
  privacy?: string;
  description?: string | null;
  views?: number | string;
  duration?: string;
  trackCount?: number;
  title: string;
  thumbnails: YTMusicThumbnail[];
  artists: YTMusicArtist[];
  year?: string;
  related?: any[];
  tracks: YTMusicSong[];
  duration_seconds?: number;
}

export interface YTMusicArtistDetail {
  description?: string;
  views?: string;
  name: string;
  channelId: string;
  shuffleId?: string;
  radioId?: string;
  subscribers?: string;
  subscribed?: boolean;
  thumbnails: YTMusicThumbnail[];
  songs?: any;
  albums?: any;
  singles?: any;
  videos?: any;
  related?: any;
}

export interface YTMusicSongDetail {
  playabilityStatus?: any;
  streamingData?: any;
  playbackTracking?: any;
  videoDetails?: any;
  microformat?: any;
}

/** Cấu trúc tham số tỷ lệ khung hình cho Image Assets Youtube Music */
export interface YTMusicThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

// ─────────────────────────────────────────────────────────
// Cấu trúc kết nối Pipeline Type Response
// ─────────────────────────────────────────────────────────

/** Union Type bao bọc kết quả Search chung quy về một Type Check */
export type YTMusicSearchResult = YTMusicArtist | YTMusicSong | YTMusicPlaylist;

export type YTMusicSearchResponse = YTMusicSearchResult[];
export type YTMusicAlbumResponse = YTMusicAlbum;
export type YTMusicPlaylistResponse = YTMusicPlaylistDetail;
export type YTMusicArtistResponse = YTMusicArtistDetail;
export type YTMusicSongResponse = YTMusicSongDetail;
