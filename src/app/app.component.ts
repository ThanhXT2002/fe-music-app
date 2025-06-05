import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { PWAService } from './services/pwa.service';
import { ThemeService } from 'src/app/services/theme.service';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [CommonModule, FormsModule, RouterOutlet],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private pwaService = inject(PWAService); // Inject PWA service
  private themeService = inject(ThemeService);



  ngOnInit() {
    // Theme service sẽ tự động apply theme khi khởi tạo

    // Khởi tạo PWA service
    this.pwaService.onNetworkStatusChange();

    // Kiểm tra updates định kỳ (mỗi 30 phút)
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


}
