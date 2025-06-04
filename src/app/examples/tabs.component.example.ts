import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';
import { DownloadService } from '../services/download.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],template: `
    <div class="tabs-container">
      <div class="content">
        <router-outlet></router-outlet>
      </div>
      <nav class="bottom-nav">
        <button
          class="tab-button"
          [class.active]="appState.currentMainTab === 'list'"
          (click)="setActiveTab('list')">
          <i class="fas fa-list"></i>
          <span>Danh sách</span>
        </button>
        <button
          class="tab-button"
          [class.active]="appState.currentMainTab === 'albums'"
          (click)="setActiveTab('albums')">
          <i class="fas fa-album-collection"></i>
          <span>Albums</span>
        </button>
        <button
          class="tab-button"
          [class.active]="appState.currentMainTab === 'search'"
          (click)="setActiveTab('search')">
          <i class="fas fa-search"></i>
          <span>Tìm kiếm</span>
        </button>
        <button
          class="tab-button"
          [class.active]="appState.currentMainTab === 'download'"
          (click)="setActiveTab('download')">
          <i class="fas fa-download"></i>
          <span>Tải về</span>
          <span
            *ngIf="activeDownloadsCount > 0"
            class="badge">
            {{ activeDownloadsCount }}
          </span>
        </button>
      </nav>
    </div>
  `,
  styles: [`
    .tabs-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .content {
      flex: 1;
      overflow: auto;
    }
    .bottom-nav {
      display: flex;
      justify-content: space-around;
      padding: 8px;
      background: white;
      border-top: 1px solid #eee;
    }
    .tab-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      border: none;
      background: transparent;
      color: #666;
      font-size: 12px;
    }
    .tab-button.active {
      color: var(--ion-color-primary);
    }
    .tab-button i {
      font-size: 20px;
      margin-bottom: 4px;
    }
    .badge {
      position: absolute;
      top: 0;
      right: 0;
      background: var(--ion-color-primary);
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 10px;
    }
  `],
})
export class TabsComponent implements OnInit {
  activeDownloadsCount = 0;
  constructor(
    public appState: AppStateService,
    private downloadService: DownloadService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to download service to show active downloads count
    this.downloadService.downloads$.subscribe(downloads => {
      this.activeDownloadsCount = downloads.filter(d =>
        d.status === 'downloading' || d.status === 'pending'
      ).length;
    });
  }
  setActiveTab(tab: string) {
    this.appState.setActiveMainTab(tab);
    // Navigate to the corresponding route
    this.router.navigate([`/tabs/${tab}`]);
  }
}
