import {
  Component,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonRouterOutlet,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';

import { RefreshService } from 'src/app/services/refresh.service';
import { NavbarBottomComponent } from '../../components/navbar-bottom/navbar-bottom.component';
import { HeaderComponent } from '../../components/header/header.component';
import { MiniPlayerComponent } from "src/app/components/mini-player/mini-player.component";

@Component({
  selector: 'app-layout',
  imports: [
    IonRefresher,
    IonRouterOutlet,
    IonContent,
    CommonModule,
    FormsModule,
    IonRefresherContent,
    NavbarBottomComponent,
    HeaderComponent,
    MiniPlayerComponent
],
  standalone: true,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  isVisible = false;
  searchQuery = '';
  searchResults: Song[] = [];


  @ViewChild(IonRefresher) refresher!: IonRefresher;
  @ViewChild(IonContent, { read: ElementRef }) contentEl!: ElementRef;

  refresherEnabled = true;
  topRegionHeight = 100;
  canDismiss = false;

  constructor(
    private refreshService: RefreshService,

  ) {
    // Đơn giản hóa - không cần subscribe signals phức tạp nữa
  }

  async handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      // Trigger refresh cho tất cả page đang subscribe
      this.refreshService.triggerRefresh();

      // Complete refresher
      (event.target as HTMLIonRefresherElement).complete();
    }, 1500);
  }

  ngAfterViewInit() {
    // Lắng nghe touchstart trên vùng ion-content
    this.contentEl.nativeElement.addEventListener(
      'touchstart',
      (event: TouchEvent) => {
        const startY = event.touches[0].clientY;
        // Chỉ bật refresher nếu vuốt bắt đầu từ vùng top
        if (this.refresher) {
          this.refresher.disabled = startY > this.topRegionHeight;
        }
      }
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
