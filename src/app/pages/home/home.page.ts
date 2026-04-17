import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone';
import { FooterComponent } from '../../components/footer/footer.component';
import { SongSectionComponent } from '../../components/song-section/song-section.component';
import { HomeService } from '@core/api/home.service';
import { Song } from '@core/interfaces/song.interface';
import { PlayerStore } from '../../core/stores/player.store';
import { LibraryStore } from '../../core/stores/library.store';
import { Capacitor } from '@capacitor/core';
import { InternetErrorComponent } from 'src/app/components/internet-error/internet-error.component';
import { HealthCheckService } from '@core/api/health-check.service';
import { Oops505Component } from 'src/app/components/oops-505/oops-505.component';

/**
 * Trang chủ ứng dụng.
 *
 * Chức năng:
 * - Hiển thị danh sách các bài hát theo nhiều chuyên mục khác nhau (Remix, Không Lời, TikTok, Mọi người cùng nghe)
 * - Quản lý trạng thái kết nối mạng của thiết bị
 * - Chừa không gian (padding bottom) tương thích trên các nền tảng khác nhau (PWA, Desktop, Native)
 *
 * Route: /home
 * Phụ thuộc: PlayerStore, LibraryStore, HomeService, HealthCheckService
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    FooterComponent,
    SongSectionComponent,
    InternetErrorComponent,
    Oops505Component,
  ],
})
export class HomePage implements OnInit {
  // ═══ STORES ═══
  /** Store quản lý trạng thái trình phát nhạc */
  readonly player = inject(PlayerStore);
  /** Store quản lý dữ liệu thư viện nhạc cá nhân */
  private readonly library = inject(LibraryStore);
  /** Service gọi API lấy danh sách nhạc trên trang chủ */
  private readonly homeService = inject(HomeService);
  /** Service điều hướng, kiểm tra API health */
  readonly healthCheckService = inject(HealthCheckService);
  /** Nền tảng thiết bị hiện tại cung cấp bởi Ionic */
  private readonly platform = inject(Platform);

  // ═══ STATE ═══
  /** Danh sách bài hát được mọi người nghe nhiều nhất */
  listEveryoneToListens: Song[] = [];
  /** Danh sách bài hát Remix */
  listRemixSongs: Song[] = [];
  /** Danh sách bài hát Không Lời */
  listInstrumentalSongs: Song[] = [];
  /** Danh sách bài hát thịnh hành TikTok */
  listTikTokSongs: Song[] = [];
  
  /** Trạng thái nhận biết có bài hát nào đang được phát hay không */
  isCurrentSong = !!this.player.currentSong();
  /** Padding bottom để nội dung không bị thanh điều khiển bài hát đè lên */
  pbCustom!: string;
  /** Trạng thái kết nối internet của người dùng */
  isOnline: boolean = navigator.onLine;

  /**
   * Lấy trạng thái sức khỏe của hệ thống từ healthCheckService.
   */
  get isHealthyValue() {
    return this.healthCheckService.isHealthy();
  }

  ngOnInit() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.healthCheckService.refreshHealth();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    if (Capacitor.isNativePlatform()) {
      this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
    } else {
      if (this.platform.is('pwa')) {
        this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
      } else if (this.platform.is('desktop')) {
        this.pbCustom = this.isCurrentSong ? 'pb-80' : 'pb-64';
      } else {
        this.pbCustom = this.isCurrentSong ? 'pb-[445px]' : 'pb-96';
      }
    }

    this.loadAllSections();
  }

  // ═══ DATA LOADING — Unified approach ═══
  /** 
   * Tải toàn bộ các chùm danh sách nhạc để hiển thị cho trang chủ.
   * Danh sách sẽ được tự động đồng bộ cờ tải về, yêu thích thông qua library store.
   */
  private loadAllSections() {
    this.loadSection('', (songs) => this.listEveryoneToListens = songs);
    this.loadSection('remix', (songs) => this.listRemixSongs = songs, 25);
    this.loadSection('Không Lời', (songs) => this.listInstrumentalSongs = songs, 25);
    this.loadSection('tik', (songs) => this.listTikTokSongs = songs, 25);
  }

  /**
   * Tải về danh sách bài hát cho từng khu vực cục bộ theo từ khóa.
   *
   * @param keyword - Từ khóa truyền cho API tìm kiếm
   * @param setter - Truyền callback để gán mảng bài hát tương ứng
   * @param limit - Số lượng bài hát muốn giới hạn lấy về
   */
  private loadSection(
    keyword: string,
    setter: (songs: Song[]) => void,
    limit?: number
  ) {
    this.homeService.getHomeData(keyword || undefined, limit).subscribe({
      next: async (res) => {
        if (res?.data && Array.isArray(res.data)) {
          setter(await this.library.syncFavorites(res.data));
        } else {
          setter([]);
        }
      },
      error: () => setter([]),
    });
  }

  // ═══ EVENT HANDLERS ═══
  /**
   * Phát bài hát khi người dùng chọn trong danh sách nhạc.
   *
   * @param event - Sự kiện truyền lên chứa đối tượng bài hát và mảng playlist tương ứng
   */
  onSongClick(event: { song: Song; playlist: Song[] }) {
    this.player.playSongFromList(event.song, event.playlist);
  }

  /**
   * Xử lý khi nhấn nút ba chấm xem lựa chọn phụ của bài hát.
   *
   * @param song - Thông tin bài hát
   */
  onSongOptions(song: Song) {
    // TODO: Hiện modal popup lựa chọn nhạc (Thêm vào DS, Tải về, v.v.)
    console.log('Song options:', song.title);
  }
}
