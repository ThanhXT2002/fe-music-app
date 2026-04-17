import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  YTMusicSearchResponse,
  YTMusicSongResponse,
  YTMusicAlbumResponse,
  YTMusicPlaylistResponse,
  YTMusicArtistResponse,
  YTMusicWatchPlaylistResponse,
  YTMusicRelatedResponse
} from '@core/interfaces/ytmusic.interface';

/**
 * Service API giao tiếp cầu nối proxy lấy dữ liệu của hệ sinh thái YouTube Music.
 *
 * Phụ trách việc gọi Endpoint Backend để trung chuyển bốc cào các khối dữ liệu từ YT.
 * Cung cấp giải pháp tìm kiếm (Search), Playlists, Album, Lyrics cho mảng FE.
 */
@Injectable({
  providedIn: 'root',
})
export class YtMusicService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Root Node của Restful YTMusic Endpoint */
  private apiUrl = environment.apiUrl + '/ytmusic';

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor(private http: HttpClient) {}

  // ─────────────────────────────────────────────────────────
  // DATA FETCHING ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Cào từ khoá tìm kiếm trên Database phân hệ YouTube Music.
   *
   * @param query - Đoạn input văn bản gõ vào khung lưới tìm kiếm (Vd: "Tình thôi xót xa")
   * @param filter - Enum quy luật thu hẹp dạng filter chỉ định loại Item (songs, albums, artists, playlists, community_playlists)
   * @param limit - Số phần tử list Item tối đa trong mảng Query (default: 50)
   * @returns Observable phát ra Object Root kết quả YT List
   */
  search(query: string, filter?: string, limit: number = 50): Observable<YTMusicSearchResponse> {
    let params = new HttpParams().set('query', query).set('limit', limit.toString());
    if (filter) {
      params = params.set('filter', filter);
    }
    return this.http.get<YTMusicSearchResponse>(`${this.apiUrl}/search`, { params });
  }

  /**
   * Lấy cấu trúc chi tiết tường minh một bài Unit Audio Track được định dạng chuẩn của YTMusic.
   *
   * @param songId - Khóa YT ID riêng biệt (Video ID)
   * @returns Observable Detail Info của một Unit Track
   */
  getSong(songId: string): Observable<YTMusicSongResponse> {
    return this.http.get<YTMusicSongResponse>(`${this.apiUrl}/song/${songId}`);
  }

  /**
   * Bốc tách danh sách ca khúc và Meta Profile của Album Music Collection.
   *
   * @param albumId - Hash định danh Record của Album trên GG Media Database
   * @returns Observable trả List Track Array và Metadata Cover
   */
  getAlbum(albumId: string): Observable<YTMusicAlbumResponse> {
    return this.http.get<YTMusicAlbumResponse>(`${this.apiUrl}/album/${albumId}`);
  }

  /**
   * Giải nén Cấu trúc danh sách phát (Playlist) có nhiều Sub-Music Track bên trong.
   *
   * @param playlistId - Dãy chuỗi ngô phân kênh (VD: "RDCLAK5uy...")
   * @returns Observable Array danh sách Item theo chuỗi
   */
  getPlaylist(playlistId: string): Observable<YTMusicPlaylistResponse> {
    return this.http.get<YTMusicPlaylistResponse>(`${this.apiUrl}/playlist/${playlistId}`);
  }

  /**
   * Rút trích khối Profile Overview đặc nhiệm cho Nhạc sĩ và Nghệ sĩ chuyên mục giải trí.
   * Chứa các Singles / Albums và Song Charts của chính User Channel này.
   *
   * @param artistId - Mã Alias Artist
   * @returns Observable cấu trúc Channel của người hát
   */
  getArtist(artistId: string): Observable<YTMusicArtistResponse> {
    return this.http.get<YTMusicArtistResponse>(`${this.apiUrl}/artist/${artistId}`);
  }

  /**
   * Trigger Request trích cào nội dung Lời bài Nhạc (Lyrics) của Track hiện tại.
   * Có thể sẽ ném Lỗi 404 nếu Track trên nền tảng YouTube Music không có sub Lyrics chuẩn đi kèm.
   *
   * @param songId - Mã Track YTMusic Video ID
   * @returns Observable Text Lyrics dạng đoạn / ngắt dòng
   */
  getLyrics(songId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/song/${songId}/lyrics`);
  }

  /**
   * Trừng dụng mảng bảng xếp hạng (Global Top Songs Ranking) để build Home Trending.
   *
   * @param limit - Ràng buộc kết thúc lượng phần tử mảng (Mặc định: Top 25 bản)
   * @param country - Đuôi ISO quy chuẩn Vùng/Khu Vực Localize Ranking (VD: "VN", Global "ZZ")
   * @returns Observable Array danh sách xếp Top
   */
  getTopSongs(limit: number = 25, country: string = 'ZZ'): Observable<any> {
    let params = new HttpParams().set('limit', limit.toString()).set('country', country);
    return this.http.get<any>(`${this.apiUrl}/top-songs`, { params });
  }

  /**
   * Vượt kiểm duyệt CORS lấy data Media Streaming Raw MP4/WebM gốc để gán thẻ Audio Local.
   *
   * Backend đóng vai trò Gateway cấp lại trực tiếp Stream byte của Google cho DOM UI mà không bộc lộ IP Server ẩn.
   *
   * @param songId - Mã Stream Hash (VD: pXioN2L2Y1g)
   * @returns Observable gói cấu trúc Binary stream dạng Blob Audio byte buffer
   */
  streamAudio(songId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/stream/${songId}`, { responseType: 'blob' });
  }

  /**
   * Xin cấp chuỗi Danh Sách Phóng Theo Ngữ Cảnh (Watch Playlist Mixing).
   * Thuật toán Youtube sẽ đánh bóng random cho ra mảng danh sách bài kế hợp logic liên đới Track hiện đang đánh.
   *
   * @param songId - Input mốc seed Song ID kích phát AI random list
   * @returns Observable Watch Playlist Array Generator
   */
  getPlaylistWithSong(songId: string): Observable<YTMusicWatchPlaylistResponse> {
    return this.http.get<YTMusicWatchPlaylistResponse>(`${this.apiUrl}/playlist-with-song/${songId}`);
  }

  /**
   * Thu thập Suggest Data Collection từ Item tham chiều hiện năng.
   *
   * @param browerId - Mã Browser Next Indicator được cung cấp ngầm bởi yt-dlp backend
   * @returns Observable Mảng Items đề nghị (Suggest List)
   */
  getRelated(browerId: string): Observable<YTMusicRelatedResponse> {
    return this.http.get<YTMusicRelatedResponse>(`${this.apiUrl}/related/${browerId}`);
  }

  /**
   * Gợi ý gõ từ khoá tự động qua tính năng Type-Ahead Hint List của Backend.
   *
   * Gọi API Search Sub liên hồi ngay mỗi lúc Input DOM Box bị gõ Text.
   *
   * @param query - Chuỗi Fragment Text
   * @returns Observable List String Hints Array
   */
  searchSuggestions(query: string): Observable<string[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<string[]>(`${this.apiUrl}/search-suggestions`, { params });
  }
}
