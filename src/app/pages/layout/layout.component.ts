import {
  Component,
  effect,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Subject } from 'rxjs';
import { SearchService } from 'src/app/services/search.service';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonContent,
  IonRouterOutlet,
  IonModal,
  IonNav,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';

import { Platform } from '@ionic/angular';
import { RefreshService } from 'src/app/services/refresh.service';
import { PlayerPage } from '../player/player.page';
import { CurrentPlaylistComponent } from 'src/app/components/current-playlist/current-playlist.component';
import { GlobalPlaylistModalService } from 'src/app/services/global-playlist-modal.service';
import { NavbarBottomComponent } from '../../components/navbar-bottom/navbar-bottom.component';
import { HeaderComponent } from '../../components/header/header.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-layout',
  imports: [
    IonRefresher,
    IonRouterOutlet,
    IonContent,

    CommonModule,

    FormsModule,
    IonModal,
    IonNav,
    IonRefresherContent,
    CurrentPlaylistComponent,
    NavbarBottomComponent,
    HeaderComponent,
  ],
  standalone: true,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  showSearch = false;
  isVisible = false;
  searchQuery = '';
  searchResults: Song[] = [];

  currentSong: Song | null = null;
  isPlaying = false;
  progressPercentage = 0;

  bottomPosition: string =
    this.platform.is('ios') && this.platform.is('pwa')
      ? 'bottom-[75px]'
      : 'bottom-[--h-bottom-tabs]'; // Đặt vị trí footer cho Android
  @ViewChild('navPlayer') private navPlayer!: IonNav;
  @ViewChild('searchModal', { static: false }) searchModal!: IonModal;
  @ViewChild('playerModal', { static: false }) playerModal!: IonModal;
  @ViewChild('playlistModal', { static: false }) playlistModal!: IonModal;
  @ViewChild(IonRefresher) refresher!: IonRefresher;
  @ViewChild(IonContent, { read: ElementRef }) contentEl!: ElementRef;

  refresherEnabled = true;
  topRegionHeight = 100;
  canDismiss = false;

  constructor(
    private audioPlayerService: AudioPlayerService,
    private router: Router,
    private searchService: SearchService,
    private platform: Platform,
    private refreshService: RefreshService,
    private playlistModalService: GlobalPlaylistModalService,
    private breakpointObserver: BreakpointObserver
  ) {
    // Đơn giản hóa - không cần subscribe signals phức tạp nữa
  }

  onWillPresentPlayer() {
    this.navPlayer.setRoot(PlayerPage);
  }

  openPlayerModal() {
    this.breakpointObserver
      .observe([Breakpoints.Tablet, Breakpoints.Web])
      .subscribe((result) => {
        if (result.matches) {
          // Nếu là tablet trở lên
          this.router.navigate(['/player']);
        } else {
          // Nếu là mobile
          this.playerModal.present();
        }
      });
  }

  openPlaylistModal() {
    this.playlistModal.present();
  }

  async handleRefresh(event: CustomEvent) {
    // Tạo loading
    // const loading = await this.loadingCtrl.create({
    //   message: 'Đang làm mới...',
    //   spinner: 'crescent',
    //   duration: 1500
    // });

    // await loading.present();

    setTimeout(() => {
      // Trigger refresh cho tất cả page đang subscribe
      this.refreshService.triggerRefresh();

      // Complete refresher
      (event.target as HTMLIonRefresherElement).complete();
    }, 1500);
  }

  // Move effect to field initializer để tránh lỗi injection context
  private playerStateEffect = effect(() => {
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;

    if (state.duration > 0) {
      this.progressPercentage = (state.currentTime / state.duration) * 100;
    }
  });

  ngAfterViewInit() {
    // Set modal reference để service có thể control
    this.playlistModalService.setModal(this.playlistModal);

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

  async togglePlayPause() {
    await this.audioPlayerService.togglePlayPause();
  }

  async previousSong() {
    await this.audioPlayerService.playPrevious();
  }

  async nextSong() {
    await this.audioPlayerService.playNext();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }
}
