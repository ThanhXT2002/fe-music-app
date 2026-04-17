/**
 * Core Interfaces — Điểm tập trung định nghĩa các Schema Typing, cấu trúc Type/Interface dùng chung.
 *
 * NOTE: Cả `song.interface` và `playlist.interface` đều có khai báo Type trùng tên `Playlist`.
 * Tại đây ta alias cấu trúc Playlist của file `song.interface` thành `SongPlaylist` để tránh đụng độ xung đột Type.
 * Từ nay reference sử dụng `Playlist` mặc định trên dự án là lấy từ `playlist.interface`.
 */
export {
  Song, Album, Artist,
  Playlist as SongPlaylist,
  PlaybackState,
  UserPreferences,
  SearchResult, YoutubeSearchResult,
  DownloadProgress, SearchResultItem,
  SongsResponse, DataSong,
  SongStatusResponse, SongStatus,
  CompletedSongsResponse, SearchHistoryItem,
  AudioFile,
} from './song.interface';

export * from './playlist.interface';
export * from './ytmusic.interface';
export * from './playback-state.interface';
