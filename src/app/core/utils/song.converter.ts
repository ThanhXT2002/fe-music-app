import { environment } from "src/environments/environment";
import { DataSong, SearchHistoryItem, Song } from "@core/interfaces/song.interface";

// ─────────────────────────────────────────────────────────
// Trạm chuyển đổi cấu trúc Model (Model Converter Utility)
// ─────────────────────────────────────────────────────────

/**
 * Cung cấp các thao tác Static Functions làm nhiệm vụ đúc rút Object.
 * Bóc tách và chuyển loại qua lại giữa các Interface Domain tĩnh và DTO Data transfer.
 */
export class SongConverter {
  private static readonly API_BASE_URL = environment.apiUrl;

  /**
   * Biên dịch mô hình `DataSong` thô truyền từ API thành thực thể `Song` chuẩn của App.
   * Tiến hành đính kèm URL Streaming nhạc cụ thể dựa vảo endpoint server.
   * Các State User (ưu thích, lịch sử thêm...) sẽ auto cấp mặc định.
   */
  static fromApiData(data: DataSong): Song {
    return {
      id: data.id,
      title: data.title,
      artist: data.artist,
      duration: data.duration,
      duration_formatted: data.duration_formatted,
      thumbnail_url: data.thumbnail_url,
      // NOTE: Chủ động nối chuỗi trực tiếp Audio Download path proxy vào URL Stream
      audio_url: `${this.API_BASE_URL}/songs/download/${data.id}`,
      keywords: data.keywords,

      // Tham số User data mặc định chưa tracking
      isFavorite: false,
      addedDate: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Chuyển đổi Model gốc lưu History (Lưu lịch sử Cache).
   * Lấy cấu trúc `Song` và bóc gọn thành `SearchHistoryItem`.
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
   * Bẻ cấu trúc nhanh từ API DataSong sang Model lưu trữ History thẳng.
   * Áp dụng khi User nhấn thẳng tìm ngay từ kết quả chưa bấm play.
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
   * Trái phiếu đính kèm URI blob offline sau khi Download.
   * Lấy thực thể `Song` có mạng, thế chân `audio_url` bằng Blob URI Storage trên Disk.
   */
  static markAsDownloaded(song: Song, audioBlobUrl: string): Song {
    return {
      ...song,
      audio_url: audioBlobUrl,
      lastUpdated: new Date()
    };
  }

  /**
   * Trigger Check nhanh xem bài hát này hiện đang phát nhạc bằng file Cục Bộ (Offline Object) 
   * hay là đang cào bằng Stream Network.
   */
  static isDownloaded(song: Song): boolean {
    return song.audio_url.startsWith('blob:');
  }

  /**
   * Translate Fake Tỷ lệ tiến độ % dựa theo Status phân mảnh của IndexedDB
   * Do Server tiến trình rời rạc không báo % trực tiếp thời gian thực khi download.
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
   * Trả lời Cờ hiệu liệu Nhạc đã hoàn thành buffer chưa để hiển thị nút Tải Xuống.
   */
  static isReadyForDownload(status: string): boolean {
    return status.toLowerCase() === 'completed';
  }

  /**
   * Lắp ráp tham số Query string cưỡng chế tải nhị phân Audio file (download=true) 
   * phục vụ trình lưu Disk Memory.
   */
  static getDownloadUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/download/${songId}?download=true`;
  }

  /**
   * Ráp endpoint link gọi hình bìa Thumbnail nhạc gốc từ Engine Node Proxy.
   */
  static getThumbnailDownloadUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/thumbnail/${songId}`;
  }

  /**
   * Ráp url chạy trình Streaming qua Audio Element HLS chuẩn (không cắm mỏ neo download).
   */
  static getStreamingUrl(songId: string): string {
    return `${this.API_BASE_URL}/songs/download/${songId}`;
  }
}
