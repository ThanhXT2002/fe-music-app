import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tabs',
  template: `
    <div class="tabs-container flex flex-col h-full">
      <!-- Tab Content -->
      <div class="flex-1 overflow-hidden">
        <router-outlet></router-outlet>
      </div>

      <!-- Bottom Tabs -->
      <div class="bottom-tabs bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-2 py-1">
        <div class="flex justify-around items-center">
          <!-- List Tab -->
          <a
            routerLink="/tabs/list"
            routerLinkActive="active"
            class="tab-item flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200">
            <i class="fas fa-list text-lg mb-1"></i>
            <span class="text-xs font-medium">Danh sách</span>
          </a>

          <!-- Albums Tab -->
          <a
            routerLink="/tabs/albums"
            routerLinkActive="active"
            class="tab-item flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200">
            <i class="fas fa-compact-disc text-lg mb-1"></i>
            <span class="text-xs font-medium">Album</span>
          </a>

          <!-- Search Tab -->
          <a
            routerLink="/tabs/search"
            routerLinkActive="active"
            class="tab-item flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200">
            <i class="fas fa-download text-lg mb-1"></i>
            <span class="text-xs font-medium">Tải về</span>
          </a>

          <!-- Settings Tab -->
          <a
            routerLink="/tabs/settings"
            routerLinkActive="active"
            class="tab-item flex flex-col items-center py-2 px-4 rounded-lg transition-all duration-200">
            <i class="fas fa-cog text-lg mb-1"></i>
            <span class="text-xs font-medium">Cài đặt</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tabs-container {
      height: calc(100vh - 140px); /* Adjust based on header and mini-player height */
    }

    .tab-item {
      @apply text-gray-500 dark:text-gray-400;
      min-width: 70px;
    }

    .tab-item.active {
      @apply text-purple-500 bg-purple-50 dark:bg-purple-900/20;
    }

    .tab-item:hover {
      @apply text-purple-400 bg-gray-50 dark:bg-gray-700;
    }

    .bottom-tabs {
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    }
  `],
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  standalone: true
})
export class TabsPage {}
