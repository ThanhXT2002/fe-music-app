
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { SongIdentifyApiService, IdentifySongResponse } from 'src/app/services/api/song-identify-api.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-find-infor-song-with-file',
  imports: [IonicModule, CommonModule],
  templateUrl: './find-infor-song-with-file.component.html',
  styleUrls: ['./find-infor-song-with-file.component.scss'],
})
export class FindInforSongWithFileComponent implements OnInit, OnDestroy {
  isOnline = navigator.onLine;
  private onlineListener = () => this.setOnlineStatus(true);
  private offlineListener = () => this.setOnlineStatus(false);
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  loading = false;
  result: IdentifySongResponse | null = null;
  error: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private songIdentifyApi: SongIdentifyApiService,
    private toastService: ToastService,
    private breakpointObserver: BreakpointObserver,
    private location: Location
  ) {}
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

  setOnlineStatus(status: boolean) {
    this.isOnline = status;
    if (!status) {
      this.showOfflineToast();
    }
  }

  showOfflineToast() {
    this.toastService.info('Vui lòng kết nối mạng để thực hiện chức năng này.', 3500);
  }


  triggerFileInput() {
    if (!navigator.onLine) {
      this.showOfflineToast();
      return;
    }
    this.fileInputRef.nativeElement.click();
  }

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
