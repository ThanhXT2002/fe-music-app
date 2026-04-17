import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  signal,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from '@core/interfaces/song.interface';
import { PlayerStore } from '../../core/stores/player.store';
import { LibraryStore } from '../../core/stores/library.store';
import { ModalService } from '../../core/ui/modal.service';
import { SongItemComponent } from '../../components/song-item/song-item.component';
import { routeAnimation } from '@core/utils/route-animation';
import { BtnCustomComponent } from "../../components/btn-custom/btn-custom.component";
import { MediaCardComponent } from "../../components/media-card/media-card.component";

/**
 * Trang danh sách bài hát cá nhân.
 *
 * Chức năng:
 * - Hiển thị danh sách bài hát theo các tab: Tất cả, Gần đây, Nghệ sĩ, Yêu thích
 * - Cung cấp các thao tác phát nhạc, thả tim từ danh sách
 * - Theo dõi và quản lý dữ liệu thư viện của người dùng
 *
 * Route: /list
 * Phụ thuộc: LibraryStore, PlayerStore, ModalService
 */
@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [CommonModule, SongItemComponent, BtnCustomComponent, MediaCardComponent],
  animations: [routeAnimation]
})
export class ListPage implements OnInit, OnDestroy {
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef;

  // ═══ STORES (3 only) ═══
  /** Store quản lý dữ liệu thư viện nhạc cá nhân */
  readonly library = inject(LibraryStore);
  /** Store quản lý trạng thái trình phát nhạc */
  private readonly player = inject(PlayerStore);
  /** Service quản lý hiển thị các modal toàn cục */
  private readonly modal = inject(ModalService);

  // ═══ TAB CONFIG ═══
  /** Cấu hình danh sách các tab hiển thị ở trang */
  tabs = [
    { id: 'all', icon: 'fas fa-music', title: 'Tất cả bài hát', label: 'Tất cả' },
    { id: 'recent', icon: 'fas fa-clock', title: 'Bài hát gần đây', label: 'Gần đây' },
    { id: 'artists', icon: 'fas fa-user-music', title: 'Danh sách nghệ sĩ', label: 'Nghệ sĩ' },
    { id: 'favorites', icon: 'fas fa-heart', title: 'Bài hát yêu thích', label: 'Yêu thích' },
  ];
  
  /** Tiêu đề của tab đang được chọn */
  tabTitle: string = 'Tất cả bài hát';
  
  /** Signal lưu trữ tên nghệ sĩ đang được active */
  activeArtist = signal<string | null>(null);

  constructor() {
    // Watch current song to track active artist
    effect(() => {
      const song = this.player.currentSong();
      this.activeArtist.set(song?.artist ?? null);
    });
  }

  // ═══ DELEGATES to LibraryStore ═══
  /** Getter lấy giá trị tab đang active từ library store */
  get activeTab() { return this.library.activeTab(); }
  /** Setter cập nhật giá trị tab đang active vào library store */
  set activeTab(value: string) { this.library.setActiveTab(value as any); }

  /** Danh sách tất cả bài hát */
  get allSongs() { return this.library.allSongs(); }
  /** Danh sách bài hát nghe gần đây */
  get recentSongs() { return this.library.recentSongs(); }
  /** Danh sách bài hát được yêu thích */
  get favoriteSongs() { return this.library.favoriteSongs(); }
  /** Danh sách nghệ sĩ */
  get artists() { return this.library.artists(); }

  // ═══ LIFECYCLE ═══
  async ngOnInit() {
    // Restore scroll position
    setTimeout(() => {
      if (this.scrollContainer && this.library.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop = this.library.scrollPosition;
      }
    }, 100);

    await this.library.ensureLoaded();
  }

  ngOnDestroy() {
    if (this.scrollContainer) {
      this.library.scrollPosition = this.scrollContainer.nativeElement.scrollTop;
    }
  }

  // ═══ TAB ACTIONS ═══
  /**
   * Xử lý sự kiện khi đổi tab.
   * Cập nhật tiêu đề và trạng thái tab active.
   *
   * @param tab - Bị kiện tab được chọn
   */
  onTabChange(tab: any) {
    this.activeTab = tab.id;
    this.tabTitle = tab.title;
  }

  getTabClass(tabId: string): string {
    const base = ' flex-shrink-0 px-2 py-1.5 text-sm font-medium transition-colors whitespace-nowrap text-white';
    if (this.activeTab === tabId) {
      return base + ' bg-pink-500/30 bg-purple-500/50';
    }
    return base + ' bg-white bg-opacity-20 text-black text-white border-transparent';
  }

  // ═══ SONG ACTIONS ═══
  /**
   * Phát một bài hát trong danh sách tương ứng với tab.
   *
   * Nếu không có danh sách truyền vào, hàm sẽ tự động lấy danh sách bài hát
   * phân theo tab hiện tại để thiết lập danh sách phát.
   *
   * @param event - Sự kiện do SongItemComponent phát ra
   */
  async playSong(event: { song: Song; playlist: Song[]; index: number }) {
    let playlist = event.playlist.length > 0 ? event.playlist : [];
    let index = event.index;

    if (playlist.length === 0) {
      switch (this.activeTab) {
        case 'all': playlist = this.allSongs; break;
        case 'recent': playlist = this.recentSongs; break;
        case 'favorites': playlist = this.favoriteSongs; break;
        default: playlist = [event.song];
      }
      index = playlist.findIndex(s => s.id === event.song.id);
    }

    await this.player.setPlaylist(playlist, index);
  }

  async toggleFavorite(song: Song) {
    const newStatus = await this.library.toggleFavorite(song.id);

    // If favorites tab and song no longer favorite, the store already removed it.
    // If song became favorite while on favorites tab, the store already reloaded.
  }

  showSongMenu(song: Song) {
    // TODO: Implement song menu
  }

  onOpenPlayer() {
    // Router navigate handled by component
  }

  // ═══ ARTIST ACTIONS ═══
  /**
   * Xử lý phát tất cả bài hát của một nghệ sĩ.
   * Nếu nghệ sĩ đã được active, mở modal danh sách bài hát hiện tại.
   *
   * @param artist - Thông tin nghệ sĩ
   */
  onPlayArtist(artist: any) {
    try {
      if (this.isArtistActive(artist.name)) {
        this.modal.openCurrentPlaylist([0, 0.7, 1], 0.7);
        return;
      }

      const artistSongs = this.library.getSongsByArtist(artist.name);
      if (artistSongs.length === 0) return;

      this.playSong({ song: artistSongs[0], playlist: artistSongs, index: 0 });
    } catch (error) {
      console.error('Error playing artist songs:', error);
    }
  }

  isArtistActive(artistName: string): boolean {
    return this.activeArtist() === artistName;
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
}
