// src/app/components/shared/lottie-equalizer.component.ts
import { Component, Input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { AudioPlayerService } from 'src/app/services/audio-player.service';

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
      /* Màu tím (purple-500) cho icon mặc định */
      filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%);
      animation: equalizer-pulse 0.8s ease-in-out infinite;
    }

    .playing ::ng-deep ng-lottie svg {
      /* Màu hồng (pink-500) khi đang phát nhạc */
      filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%);
      animation: equalizer-pulse 0.8s ease-in-out infinite;
    }

    .dark ::ng-deep ng-lottie svg {
      /* Màu tím sáng hơn cho dark mode */
      filter: brightness(0) saturate(100%) invert(84%) sepia(58%) saturate(2476%) hue-rotate(243deg) brightness(105%) contrast(92%);
    }

    .dark.playing ::ng-deep ng-lottie svg {
      /* Màu hồng sáng hơn cho dark mode khi phát */
      filter: brightness(0) saturate(100%) invert(84%) sepia(29%) saturate(1439%) hue-rotate(313deg) brightness(104%) contrast(97%);
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
  @Input() width: number = 24;
  @Input() height: number = 24;
  @Input() cssClass: string = '';
  private animation: any;
  isPlaying = false;

  options: AnimationOptions = {
    path: '/assets/animations/equalizer.json', // Path tới file JSON
    loop: true,
    autoplay: false // Chúng ta sẽ control thủ công
  };

  constructor(private audioPlayerService: AudioPlayerService) {
    // Listen to audio player state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.isPlaying = state.isPlaying;
      this.updateAnimation();
    });
  }

  onAnimationCreated(animation: any) {
    this.animation = animation;
    this.updateAnimation();
  }

  private updateAnimation() {
    if (!this.animation) return;

    if (this.isPlaying) {
      this.animation.play();
    } else {
      this.animation.pause();
    }
  }

  // Public methods để control animation
  play() {
    this.animation?.play();
  }

  pause() {
    this.animation?.pause();
  }

  stop() {
    this.animation?.stop();
  }

  setSpeed(speed: number) {
    this.animation?.setSpeed(speed);
  }
}
