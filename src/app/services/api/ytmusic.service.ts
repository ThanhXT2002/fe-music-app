import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
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
} from '../../interfaces/ytmusic.interface';


/**
 * Service để giao tiếp với Music API
 */
@Injectable({
  providedIn: 'root',
})
export class YtMusicService {
  private apiUrl = environment.apiUrl + '/ytmusic';

  constructor(private http: HttpClient) {}

  /**
   * Tìm kiếm bài hát, album, playlist, nghệ sĩ
   */
  search(query: string, filter?: string, limit: number = 50): Observable<YTMusicSearchResponse> {
    let params = new HttpParams().set('query', query).set('limit', limit.toString());
    if (filter) params = params.set('filter', filter);
    return this.http.get<YTMusicSearchResponse>(`${this.apiUrl}/search`, { params });
  }

  /**
   * Lấy thông tin chi tiết một bài hát
   */
  getSong(songId: string): Observable<YTMusicSongResponse> {
    return this.http.get<YTMusicSongResponse>(`${this.apiUrl}/song/${songId}`);
  }

  /**
   * Lấy thông tin album và danh sách bài hát trong album
   */
  getAlbum(albumId: string): Observable<YTMusicAlbumResponse> {
    return this.http.get<YTMusicAlbumResponse>(`${this.apiUrl}/album/${albumId}`);
  }

  /**
   * Lấy thông tin playlist và danh sách bài hát trong playlist
   */
  getPlaylist(playlistId: string): Observable<YTMusicPlaylistResponse> {
    return this.http.get<YTMusicPlaylistResponse>(`${this.apiUrl}/playlist/${playlistId}`);
  }

  /**
   * Lấy thông tin nghệ sĩ, các album, bài hát, video nổi bật
   */
  getArtist(artistId: string): Observable<YTMusicArtistResponse> {
    return this.http.get<YTMusicArtistResponse>(`${this.apiUrl}/artist/${artistId}`);
  }

  /**
   * Lấy lyrics của bài hát
   */
  getLyrics(songId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/song/${songId}/lyrics`);
  }

  /**
   * Lấy danh sách các bài hát thịnh hành (top songs) theo quốc gia
   */
  getTopSongs(limit: number = 25, country: string = 'ZZ'): Observable<any> {
    let params = new HttpParams().set('limit', limit.toString()).set('country', country);
    return this.http.get<any>(`${this.apiUrl}/top-songs`, { params });
  }

  /**
   * Proxy stream audio cho FE từ song_id (trả về audio/mp4)
   * Trả về Observable<HttpEvent<Blob>> để FE có thể xử lý stream
   */
  streamAudio(songId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/stream/${songId}`, { responseType: 'blob' });
  }


  /**
   * Lấy watch playlist liên quan đến bài hát
   */
  getPlaylistWithSong(songId: string): Observable<YTMusicWatchPlaylistResponse> {
    return this.http.get<YTMusicWatchPlaylistResponse>(`${this.apiUrl}/playlist-with-song/${songId}`);
  }

  getRelated(browerId: string): Observable<YTMusicRelatedResponse> {
    return this.http.get<YTMusicRelatedResponse>(`${this.apiUrl}/related/${browerId}`);
  }

  /**
   * Lấy gợi ý tìm kiếm (autocomplete)
   */
  searchSuggestions(query: string): Observable<string[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<string[]>(`${this.apiUrl}/search-suggestions`, { params });
  }
}
