import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// Success response data
export interface SongIdentifySuccessData {
  title: string;
  artist: string;
  album: string;
  release_date: string;
  score: number;
  external_ids: {
    isrc?: string;
    upc?: string;
  };
  external_metadata?: {
    youtube?: {
      vid?: string;
    };
    deezer?: {
      album?: { name?: string; id?: string };
      track?: { name?: string; id?: string };
      artists?: Array<{ name?: string; id?: string }>;
    };
    spotify?: {
      album?: { name?: string; id?: string };
      track?: { name?: string; id?: string };
      artists?: Array<{ name?: string; id?: string }>;
    };
  };
}

// Error response data
export interface SongIdentifyErrorData {
  status: {
    msg: string;
    code: number;
    version?: string;
  };
}

export type IdentifySongResponse =
  | {
      success: true;
      message: string;
      data: SongIdentifySuccessData;
    }
  | {
      success: false;
      message: string;
      data: SongIdentifyErrorData;
    };

@Injectable({ providedIn: 'root' })
export class SongIdentifyApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Nhận diện bài hát từ file audio hoặc video
   * @param file File hoặc Blob
   */
  identifySongByFile(file: File | Blob): Observable<IdentifySongResponse> {
    const formData = new FormData();
    formData.append('file', file); // Đúng tên trường backend yêu cầu
    return this.http.post<IdentifySongResponse>(`${this.apiUrl}/songs/identify`, formData);
  }
}
