import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { tap, catchError, map } from "rxjs/operators";
import { Song, SongsResponse, DataSong, SongConverter } from "src/app/interfaces/song.interface";
import { environment } from "src/environments/environment";


@Injectable({
  providedIn: 'root',
})

export class HomeService {

  private apiUrl = environment.apiUrl;
  // Cache theo key để tránh trùng lặp
  private cachedData: Map<string, SongsResponse<Song[]>> = new Map();
  private dataSubjects: Map<string, BehaviorSubject<SongsResponse<Song[]> | null>> = new Map();
  private loadingStates: Map<string, boolean> = new Map();

  constructor(
      private http: HttpClient
    ) {
      // Load data mặc định khi service khởi tạo
      this.loadInitialData();
    }

  private loadInitialData(key: string = '') {
    this.loadData(key, 50);
  }

  private getCacheKey(key: string, limit: number = 50): string {
    return `${key}_${limit}`;
  }

  private isLoading(cacheKey: string): boolean {
    return this.loadingStates.get(cacheKey) || false;
  }

  private setLoading(cacheKey: string, loading: boolean): void {
    this.loadingStates.set(cacheKey, loading);
  }

  private getDataSubject(cacheKey: string): BehaviorSubject<SongsResponse<Song[]> | null> {
    if (!this.dataSubjects.has(cacheKey)) {
      this.dataSubjects.set(cacheKey, new BehaviorSubject<SongsResponse<Song[]> | null>(null));
    }
    return this.dataSubjects.get(cacheKey)!;
  }

  private getHomeDataFromAPI(limit: number = 50,key:string=''): Observable<SongsResponse<Song[]>> {
    const url = `${this.apiUrl}/songs/completed?limit=${limit}&key=${key}`;
    return this.http.get<any>(url).pipe(
      map((response: any) => {
        console.log('API Response:', response);

        // Handle different API response formats
        if (response.success && response.data) {
          // If data is already an array of songs
          if (Array.isArray(response.data)) {
            const songs = response.data.map((item: any) => SongConverter.fromApiData(item));
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          }
          // If data has songs property (nested structure)
          else if (response.data.songs && Array.isArray(response.data.songs)) {
            const songs = response.data.songs.map((item: any) => SongConverter.fromApiData(item));
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          }
          // If data is a single object, wrap in array
          else if (typeof response.data === 'object') {
            const songs = [SongConverter.fromApiData(response.data)];
            return {
              success: response.success,
              message: response.message,
              data: songs
            };
          }
        }

        // Fallback: return empty array
        return {
          success: false,
          message: 'Invalid response format',
          data: []
        };
      })
    );
  }

  // Public method to get cached data or trigger load if not available
  getHomeData(key: string = '', limit: number = 50): Observable<SongsResponse<Song[]> | null> {
    const cacheKey = this.getCacheKey(key, limit);

    // If data is already cached, return it
    if (this.cachedData.has(cacheKey)) {
      return of(this.cachedData.get(cacheKey)!);
    }

    // If data is loading, return the subject
    if (this.isLoading(cacheKey)) {
      return this.getDataSubject(cacheKey).asObservable();
    }

    // If no data and not loading, trigger load
    this.loadData(key, limit);
    return this.getDataSubject(cacheKey).asObservable();
  }

  private loadData(key: string = '', limit: number = 50) {
    const cacheKey = this.getCacheKey(key, limit);

    if (!this.isLoading(cacheKey) && !this.cachedData.has(cacheKey)) {
      this.setLoading(cacheKey, true);
      this.getHomeDataFromAPI(limit, key).subscribe({
        next: (data) => {
          this.cachedData.set(cacheKey, data);
          this.getDataSubject(cacheKey).next(data);
          this.setLoading(cacheKey, false);
          console.log(`Home data cached successfully for key: ${key}, limit: ${limit}`);
        },
        error: (error) => {
          console.error(`Error loading home data for key: ${key}`, error);
          this.setLoading(cacheKey, false);
        }
      });
    }
  }

  // Method to force refresh data if needed
  refreshData(key: string = '', limit: number = 1000): Observable<SongsResponse<Song[]>> {
    const cacheKey = this.getCacheKey(key, limit);

    // Clear cache for this specific key
    this.cachedData.delete(cacheKey);
    this.setLoading(cacheKey, true);

    return this.getHomeDataFromAPI(limit, key).pipe(
      tap(data => {
        this.cachedData.set(cacheKey, data);
        this.getDataSubject(cacheKey).next(data);
        this.setLoading(cacheKey, false);
      }),
      catchError(error => {
        this.setLoading(cacheKey, false);
        throw error;
      })
    );
  }

  // Method to clear all cache
  clearCache(): void {
    this.cachedData.clear();
    this.dataSubjects.clear();
    this.loadingStates.clear();
  }

  // Method to clear cache for specific key
  clearCacheForKey(key: string = '', limit: number = 50): void {
    const cacheKey = this.getCacheKey(key, limit);
    this.cachedData.delete(cacheKey);
    this.dataSubjects.delete(cacheKey);
    this.loadingStates.delete(cacheKey);
  }
}
