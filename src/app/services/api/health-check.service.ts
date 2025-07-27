import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface HealthCheckResponse {
  success: boolean;
  message: string;
  version: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  apiUrl = environment.apiUrl + '/health';
  isHealthy = signal<boolean>(true);

  constructor(private http: HttpClient) {
    // Kiểm tra trạng thái sức khỏe khi khởi tạo service
    this.checkHealth().subscribe({
      next: (response) => {
        this.isHealthy.set(response.success) ;
      },
      error: () => {
         this.isHealthy.set(false) ;
      }
    });
  }

  checkHealth(): Observable<HealthCheckResponse> {
    return this.http.get<HealthCheckResponse>(this.apiUrl);
  }


}


