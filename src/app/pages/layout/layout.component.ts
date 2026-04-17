import {
  Component,
  effect,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Song } from '@core/interfaces/song.interface';
import { PlayerStore } from '../../core/stores/player.store';
import { LibraryStore } from '../../core/stores/library.store';
import { Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonRouterOutlet,
  IonModal,
  IonNav,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';

import { ModalController } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { PlayerPage } from '../player/player.page';
import { CurrentPlaylistComponent } from 'src/app/components/current-playlist/current-playlist.component';
import { ModalService } from '@core/ui/modal.service';
import { NavbarBottomComponent } from '../../components/navbar-bottom/navbar-bottom.component';
import { HeaderComponent } from '../../components/header/header.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

/**
 * Layout chính bao bọc toàn bộ ứng dụng.
 *
 * Chức năng:
 * - Chứa router outlet để render các trang con
 * - Quản lý thanh điều hướng dưới (Navbar) và Header
 * - Hiển thị trình phát nhạc thu nhỏ và điều khiển trạng thái các modal (Player, Playlist)
 * - Hỗ trợ thao tác kéo để làm mới (pull-to-refresh)
 *
 * Phụ thuộc: PlayerStore, LibraryStore, ModalService, BreakpointObserver
 */
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
  // ═══ STORES ═══
  /** Store quản lý trạng thái phát nhạc */
  private readonly player = inject(PlayerStore);
  /** Store quản lý dữ liệu danh sách nhạc và bài hát */
  private readonly library = inject(LibraryStore);
  /** Chuẩn định tuyến của Angular */
  private readonly router = inject(Router);
  /** Service của Ionic để nhận diện thiết bị */
  private readonly platform = inject(Platform);
  /** Service điều khiển modal toàn cục */
  private readonly modalService = inject(ModalService);
  /** Service phát hiện thiết bị dựa trên breakpoint màn hình */
  private readonly breakpointObserver = inject(BreakpointObserver);

  /** Tham chiếu Subject hỗ trợ huỷ subscription khi destroy component */
  private destroy$ = new Subject<void>();
  
  /** Trạng thái hiển thị form tìm kiếm nhanh */
  showSearch = false;
  /** Trạng thái cờ hiển thị chung */
  isVisible = false;
  /** Từ khóa tìm kiếm hiện tại */
  searchQuery = '';
  /** Danh sách kết quả bài hát tìm được */
  searchResults: Song[] = [];

  /** Thông tin bài hát hiện tại đang phát */
  currentSong: Song | null = null;
  /** Trạng thái nhạc có đang play hay không */
  isPlaying = false;
  /** Phần trăm tiến trình phát nhạc */
  progressPercentage = 0;

  /** Tính toán khoảng cách chừa không gian ở bottom cho PWA trên iOS */
  bottomPosition: string =
    this.platform.is('ios') && this.platform.is('pwa')
      ? 'bottom-[75px]'
      : 'bottom-[--h-bottom-tabs]';

  @ViewChild('navPlayer') private navPlayer!: IonNav;
  @ViewChild('searchModal', { static: false }) searchModal!: IonModal;
  @ViewChild('playerModal', { static: false }) playerModal!: IonModal;
  @ViewChild('playlistModal', { static: false }) playlistModal!: IonModal;
  @ViewChild(IonRefresher) refresher!: IonRefresher;
  @ViewChild(IonContent, { read: ElementRef }) contentEl!: ElementRef;

  /** Có kích hoạt khả năng pull-to-refresh hay không */
  refresherEnabled = true;
  /** Giới hạn chiều cao vuốt để pull-to-refresh */
  topRegionHeight = 100;
  /** Cho phép tắt modal hay không */
  canDismiss = false;

  // ═══ REACTIVE STATE ═══
  private playerStateEffect = effect(() => {
    const state = this.player.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;

    if (state.duration > 0) {
      this.progressPercentage = (state.currentTime / state.duration) * 100;
    }
  });

  /** Đặt component PlayerPage là component gốc cho navigation trong modal */
  onWillPresentPlayer() {
    this.navPlayer.setRoot(PlayerPage);
  }

  /**
   * Mở modal hoặc chuyển trang hiển thị trình phát nhạc.
   * Nếu đang là máy tính bảng hoặc desktop thì chuyển đến route /player,
   * còn lại thì mở modal bật lên từ bên dưới.
   */
  openPlayerModal() {
    this.breakpointObserver
      .observe([Breakpoints.Tablet, Breakpoints.Web])
      .subscribe((result) => {
        if (result.matches) {
          this.router.navigate(['/player']);
        } else {
          this.playerModal.present();
        }
      });
  }

  /** Mở modal danh sách phát hiện tại */
  openPlaylistModal() {
    this.playlistModal.present();
  }

  async handleRefresh(event: CustomEvent) {
    setTimeout(() => {
      this.library.refresh();
      (event.target as HTMLIonRefresherElement).complete();
    }, 1500);
  }

  ngAfterViewInit() {
    this.modalService.setGlobalModal(this.playlistModal);
    this.contentEl.nativeElement.addEventListener(
      'touchstart',
      (event: TouchEvent) => {
        const startY = event.touches[0].clientY;
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
    await this.player.togglePlayPause();
  }

  async previousSong() {
    await this.player.playPrevious();
  }

  async nextSong() {
    await this.player.playNext();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }
}
