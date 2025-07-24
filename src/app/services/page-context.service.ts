
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PageContextService {
  private currentPage = signal<string | null>(null);

  setCurrentPage(page: string) {
    this.currentPage.set(page);
  }

  getCurrentPage() {
    return this.currentPage;
  }
}
