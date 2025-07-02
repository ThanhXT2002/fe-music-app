import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Song, YouTubeDownloadResponse } from "src/app/interfaces/song.interface";
import { environment } from "src/environments/environment";


@Injectable({
  providedIn: 'root',
})

export class HomeService {

  private apiUrl = environment.apiUrl;
  private cachedData: YouTubeDownloadResponse | null = null;
  private dataSubject = new BehaviorSubject<YouTubeDownloadResponse | null>(null);
  private isLoading = false;

  constructor(
      private http: HttpClient
    ) {
      // Load data once when service is created (app startup)
      this.loadInitialData();
    }

  private loadInitialData() {
    if (!this.isLoading && !this.cachedData) {
      this.isLoading = true;
      this.getHomeDataFromAPI().subscribe({
        next: (data) => {
          this.cachedData = data;
          this.dataSubject.next(data);
          this.isLoading = false;
          console.log('Home data cached successfully');
        },
        error: (error) => {
          console.error('Error loading initial home data:', error);
          this.isLoading = false;
        }
      });
    }
  }

  private getHomeDataFromAPI(numberOfSongs: number = 1000): Observable<YouTubeDownloadResponse> {
    const url = `${this.apiUrl}/songs/recent-downloads?limit=${numberOfSongs}`;
    return this.http.get<YouTubeDownloadResponse>(url);
  }

  // Public method to get cached data or trigger load if not available
  getHomeData(): Observable<YouTubeDownloadResponse | null> {
    // If data is already cached, return it
    if (this.cachedData) {
      return of(this.cachedData);
    }

    // If data is loading, return the subject
    if (this.isLoading) {
      return this.dataSubject.asObservable();
    }

    // If no data and not loading, trigger load
    this.loadInitialData();
    return this.dataSubject.asObservable();
  }

  // Method to force refresh data if needed
  refreshData(numberOfSongs: number = 1000): Observable<YouTubeDownloadResponse> {
    this.cachedData = null;
    this.isLoading = true;

    return this.getHomeDataFromAPI(numberOfSongs).pipe(
      tap(data => {
        this.cachedData = data;
        this.dataSubject.next(data);
        this.isLoading = false;
      }),
      catchError(error => {
        this.isLoading = false;
        throw error;
      })
    );
  }


}
