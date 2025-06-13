import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshSubject = new Subject<void>();

  // Observable để các component subscribe
  refresh$ = this.refreshSubject.asObservable();

  // Method để trigger refresh
  triggerRefresh() {
    this.refreshSubject.next();
  }
}
