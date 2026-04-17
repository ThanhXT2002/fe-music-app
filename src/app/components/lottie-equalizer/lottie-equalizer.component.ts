// src/app/components/shared/lottie-equalizer.component.ts
import { Component, Input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { AudioPlayerService } from '@core/services/audio-player.service';

/**
 * Component hiển thị Animation Lottie (sóng âm) phục vụ cho trình phát nhạc.
 *
 * Chức năng:
 * - Load file ảnh động Lottie (.json) dạng sóng nhạc mượt mà.
 * - Liên kết trực tiếp với trạng thái Play/Pause của player để dừng/tiếp tục đồ họa.
 */
@Component({
  selector: 'app-lottie-equalizer',
  template: `
    <ng-lottie
      [options]="options"
      [width]="width.toString()"
      [height]="height.toString()"
      (animationCreated)="onAnimationCreated($event)"
      [class]="cssClass"
      [class.playing]="isPlaying">
    </ng-lottie>
  `,styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    ::ng-deep ng-lottie svg {
      /* Màu tím (purple) cho icon mặc định */
      filter: brightness(10) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(243deg) brightness(104%) contrast(97%);
    }

    .playing ::ng-deep ng-lottie svg {
      /* Màu tím (purple) khi đang phát nhạc */
      filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(243deg) brightness(104%) contrast(97%);
      animation: equalizer-pulse 0.8s ease-in-out infinite;
    }

    .dark ::ng-deep ng-lottie svg {
      /* Màu tím sáng hơn cho dark mode */
      filter: brightness(0) saturate(100%) invert(84%) sepia(58%) saturate(2476%) hue-rotate(243deg) brightness(105%) contrast(92%);
    }

    .dark.playing ::ng-deep ng-lottie svg {
      /* Màu tím sáng hơn cho dark mode khi phát */
      filter: brightness(0) saturate(100%) invert(84%) sepia(58%) saturate(2476%) hue-rotate(243deg) brightness(105%) contrast(92%);
    }

    @keyframes equalizer-pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.8;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule, LottieComponent]
})
export class LottieEqualizerComponent {
  // ─────────────────────────────────────────────────────────
  // Input Configuration
  // ─────────────────────────────────────────────────────────
  /** Chiều rộng box ảnh Lottie (pixel) */
  @Input() width: number = 24;
  
  /** Chiều cao box ảnh Lottie (pixel) */
  @Input() height: number = 24;
  
  /** Chuỗi class CSS phụ trợ tuỳ chỉnh thêm cho Lottie */
  @Input() cssClass: string = '';

  // ─────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────
  /** Bản tham chiếu thực tế đến đối tượng animation để kiểm soát hàm play/pause (chưa expose type) */
  private animation: any;
  
  /** Cờ theo dõi trạng thái đang Play hay Pause để trigger Animation CSS đi kèm nếu cần */
  isPlaying = false;

  /** Tuỳ chọn khởi tạo nạp cho ngx-lottie (path chứa dữ liệu thiết kế sóng âm Vector) */
  options: AnimationOptions = {
    path: '/assets/animations/equalizer.json', 
    loop: true,
    autoplay: false // Khởi chạy thủ công thông qua state thay vì tự động AutoPlay do cơ chế DOM
  };

  // ─────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────
  constructor(private audioPlayerService: AudioPlayerService) {
    // Phản ứng với sự thay đổi tín hiệu phát nhạc Signal từ AudioPlayerService
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.isPlaying = state.isPlaying;
      this.updateAnimation();
    });
  }

  // ─────────────────────────────────────────────────────────
  // Callbacks & Animation Controll
  // ─────────────────────────────────────────────────────────
  /**
   * Hook callback bắt buộc được gọi khi package ngx-lottie build xong DOM file json.
   * Gắn object instance vào biến cục bộ để gọi ra các tác vụ thủ công.
   */
  onAnimationCreated(animation: any) {
    this.animation = animation;
    this.updateAnimation();
  }

  /**
   * Phân luồng điều phối ra lệnh cho Graphic Layer hoạt ảnh chạy nếu cờ Play được giương và pause ngược lại.
   */
  private updateAnimation() {
    if (!this.animation) return;

    if (this.isPlaying) {
      this.animation.play();
    } else {
      this.animation.pause();
    }
  }

  /** Lệnh gọi phát hoạt hoạ chủ động từ bên ngoài (Nếu thiết kế mở Component Controller cần đến) */
  play() {
    this.animation?.play();
  }

  /** Lệnh gọi dừng hoạt hoạ khựng lại vị trí hiện đại */
  pause() {
    this.animation?.pause();
  }

  /** Lệnh ngắt hẳn reset về thời gian Vector 0s từ đầu */
  stop() {
    this.animation?.stop();
  }

  /** 
   * Tăng tốc hoặc giảm tốc thời gian khung hình nội hàm Lottie Player. 
   * @param speed - Tốc độ tua (1.0 = thông thường, > 1 = nhanh hơn nguyên bản)
   */
  setSpeed(speed: number) {
    this.animation?.setSpeed(speed);
  }
}
