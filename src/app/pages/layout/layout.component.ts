import { Component, effect, OnDestroy, inject, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
  IonToolbar,
  IonFooter,
  IonModal,
  IonNav,
  IonRefresher,
  IonRefresherContent,
  IonLabel,
} from '@ionic/angular/standalone';
import { SearchComponent } from 'src/app/components/search(trash)/search.component';
import { Platform } from '@ionic/angular';
import { RefreshService } from 'src/app/services/refresh.service';
import { PlayerPage } from '../player/player.page';
import { CurrentPlaylistComponent } from 'src/app/components/current-playlist/current-playlist.component';
import { GlobalPlaylistModalService } from 'src/app/services/global-playlist-modal.service';

@Component({
  selector: 'app-layout',
  imports: [
    IonRefresher,
    IonFooter,
    IonToolbar,
    IonRouterOutlet,
    IonContent,
    IonHeader,
    CommonModule,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    IonModal,
    IonNav,
    IonRefresherContent,
    CurrentPlaylistComponent,
  ],
  standalone: true,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private platform = inject(Platform);
  private refreshService = inject(RefreshService);
  private playlistModalService = inject(GlobalPlaylistModalService);

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

  hTookbar: string =
    this.platform.is('ios') && this.platform.is('pwa') ? 'h-[75px]' : '';  @ViewChild('navSearch') private navSearch!: IonNav;
  @ViewChild('navPlayer') private navPlayer!: IonNav;
  @ViewChild('searchModal', { static: false }) searchModal!: IonModal;
  @ViewChild('playerModal', { static: false }) playerModal!: IonModal;
  @ViewChild('playlistModal', { static: false }) playlistModal!: IonModal;

  onPlaylistDragActive(active: boolean) {
    // Không làm gì cả - chỉ để component con có thể emit mà không lỗi
  }

  onWillPresentSearch() {
    this.navSearch.setRoot(SearchComponent);
  }

  onWillPresentPlayer() {
    this.navPlayer.setRoot(PlayerPage);
  }

  openSearchModal() {
    this.searchModal.present();
  }

  openPlayerModal() {
    this.playerModal.present();
  }  openPlaylistModal() {
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

  openFullPlayer() {
    this.router.navigate(['/player']);
  }

  toggleSearch() {
    if (!this.showSearch) {
      // Mở: cho hiện luôn và áp hiệu ứng
      this.isVisible = true;
      setTimeout(() => {
        this.showSearch = true;
      }, 10); // delay nhỏ để áp class `slide-down`
    } else {
      // Đóng: áp hiệu ứng trước rồi ẩn hẳn
      this.showSearch = false;
      setTimeout(() => {
        this.isVisible = false;
      }, 300); // chờ hiệu ứng `slide-up` xong rồi mới ẩn
    }
  }

  async onSearchInput() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    const results = await this.searchService.searchAll(this.searchQuery);
    this.searchResults = results.songs.slice(0, 5); // Show top 5 results
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
  }

  async selectSearchResult(song: Song) {
    await this.audioPlayerService.playSong(song);
    this.clearSearch();
    this.showSearch = false;
  }
  constructor() {
    // Đơn giản hóa - không cần subscribe signals phức tạp nữa
  }
}
