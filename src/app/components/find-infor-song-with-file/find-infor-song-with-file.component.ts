import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import { SongIdentifyApiService, IdentifySongResponse } from '@core/api/song-identify-api.service';
import { ToastService } from '@core/ui/toast.service';

/**
 * Component Tra cứu và Nhận diện Định danh Âm thanh theo file Audio Tải lên (ACR Cloud / Shazam Clone).
 *
 * Chức năng:
 * - Hiển thị Input chọn File MP3, M4A và Submit upload mảng Byte lên Cloud Identify.
 * - Giải mã chuỗi Byte Data ra các Meta Data (SongID, Name, Artist).
 * - Sử dụng cờ Online/Offline Web API check để cảnh báo UX cúp mạng.
 */
@Component({
  selector: 'app-find-infor-song-with-file',
  imports: [IonicModule, CommonModule],
  templateUrl: './find-infor-song-with-file.component.html',
  styleUrls: ['./find-infor-song-with-file.component.scss'],
})
export class FindInforSongWithFileComponent implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────
  // Network & Dom Referrals
  // ─────────────────────────────────────────────────────────
  /** Check trạng thái Native Connection API */
  isOnline = navigator.onLine;
  
  /** Handler Delegate */
  private onlineListener = () => this.setOnlineStatus(true);
  private offlineListener = () => this.setOnlineStatus(false);
  
  /** Bắt Element Nút Chọn File Input HTML ẩn bị che */
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

  // ─────────────────────────────────────────────────────────
  // Local Working States
  // ─────────────────────────────────────────────────────────
  /** Bộ chọn lưu trữ con trỏ trỏ tới File vật lý đã pick */
  selectedFile: File | null = null;
  /** Cờ cho UX Load quay vòng */
  loading = false;
  /** Result Parse ra JSON Match Object ID */
  result: IdentifySongResponse | null = null;
  /** Label Cảnh báo Error Log Box */
  error: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private songIdentifyApi: SongIdentifyApiService,
    private toastService: ToastService,
    private breakpointObserver: BreakpointObserver,
    private location: Location
  ) {}

  // ─────────────────────────────────────────────────────────
  // Lifecycle Handlers
  // ─────────────────────────────────────────────────────────
  ngOnInit() {
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
    if (!this.isOnline) {
      this.showOfflineToast();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener('offline', this.offlineListener);
  }

  // ─────────────────────────────────────────────────────────
  // Helper Connection Controls
  // ─────────────────────────────────────────────────────────
  setOnlineStatus(status: boolean) {
    this.isOnline = status;
    if (!status) {
      this.showOfflineToast();
    }
  }

  showOfflineToast() {
    this.toastService.info('Vui lòng kết nối mạng để thực hiện chức năng này.', 3500);
  }

  // ─────────────────────────────────────────────────────────
  // Native File Readers
  // ─────────────────────────────────────────────────────────
  /**
   * Kích nổ Box Folder Device Pick OS thay vì click cứng vô Input Ẩn.
   */
  triggerFileInput() {
    if (!navigator.onLine) {
      this.showOfflineToast();
      return;
    }
    this.fileInputRef.nativeElement.click();
  }

  /**
   * Theo dõi sự biến đổi Value gán Data Input File Target HTML và tự Submit lôi Data qua nhận diện.
   */
  onFileChange(event: Event) {
    if (!navigator.onLine) {
      this.showOfflineToast();
      return;
    }
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.result = null;
      this.error = null;
      // Tự động gửi đến API khi chọn file
      this.identifySong();
    }
  }

  // ─────────────────────────────────────────────────────────
  // API Caller Execute
  // ─────────────────────────────────────────────────────────
  /**
   * Đóng gói Buffer Array FormData Post Http Client lên Backend AI Cloud.
   */
  identifySong() {
    if (!this.selectedFile) return;
    this.loading = true;
    this.result = null;
    this.error = null;
    this.songIdentifyApi.identifySongByFile(this.selectedFile).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Không thể nhận diện bài hát. Vui lòng thử lại.';
        this.loading = false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // Navigation Routing Back
  // ─────────────────────────────────────────────────────────
  /** Dẹp hộp thoại Modal hay Push Back Location dựa trên Breakpoint Window Width Device */
  onBack() {
     this.breakpointObserver
        .observe([Breakpoints.Tablet, Breakpoints.Web])
        .subscribe(async (result) => {
          if (result.matches) {
            this.location.back();
          } else {
            this.modalCtrl.dismiss();
          }
        });
  }
}
