import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Input,
  inject,
  effect,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';


@Component({
  selector: 'app-audio-equalizer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="equalizer-container" [style.width]="width" [style.height]="height">
      <!-- Real-time frequency bars -->
      <div class="frequency-bars" #frequencyBars>
        <div
          class="bar"
          *ngFor="let bar of bars; let i = index"
          [style.height.%]="bar"
          [style.background]="getBarColor(i, bar)"
          [style.box-shadow]="getBarShadow(i, bar)"
        ></div>
      </div>

      <!-- Glow effect overlay -->
      <div class="glow-overlay" *ngIf="isPlaying && showGlow"></div>
    </div>
  `,
  styles: [`
    .equalizer-container {
      position: relative;
      display: flex;
      align-items: end;
      justify-content: center;
      background: transparent;
      overflow: hidden;
    }

    .frequency-bars {
      display: flex;
      align-items: end;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      gap: 2px;
    }

    .bar {
      flex: 1;
      min-height: 4px;
      border-radius: 2px 2px 0 0;
      transition: height 0.1s ease-out;
      transform-origin: bottom;
    }

    .glow-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
      pointer-events: none;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.8; }
    }

    /* Responsive bars */
    @media (max-width: 640px) {
      .frequency-bars {
        gap: 1px;
      }
    }
  `]
})
export class AudioEqualizerComponent implements OnInit, OnDestroy {
  @Input() width: string = '100px';
  @Input() height: string = '40px';
  @Input() barCount: number = 16;
  @Input() sensitivity: number = 1.5;
  @Input() showGlow: boolean = true;
  @ViewChild('frequencyBars', { static: true }) frequencyBarsRef!: ElementRef;

  private audioPlayerService = inject(AudioPlayerService);
  private cdr = inject(ChangeDetectorRef);
  // Audio analysis properties
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private animationFrame: number | null = null;
  private frequencyData: Uint8Array | null = null;

  // Static shared resources to avoid multiple connections
  private static sharedAudioContext: AudioContext | null = null;
  private static sharedSource: MediaElementAudioSourceNode | null = null;
  private static sharedAnalyser: AnalyserNode | null = null;
  private static connectedElement: HTMLAudioElement | null = null;
  // Component state
  bars: number[] = [];
  isPlaying = false;
  private isInitialized = false;
  private lastAudioElement: HTMLAudioElement | null = null;

  // Performance optimization - pre-calculated values
  private centerWeights: number[] = [];
  private frequencyMappings: { start: number; end: number }[] = [];
  private centerDistances: number[] = [];

  // Performance constants - pre-calculated to avoid repeated calculations
  private readonly SENSITIVITY_FACTOR = 100;
  private readonly MIN_HEIGHT_BASE = 4;
  private readonly MIN_HEIGHT_CENTER_BONUS = 8;
  private readonly SMOOTH_KEEP_FACTOR = 0.85;
  private readonly SMOOTH_NEW_FACTOR = 0.15;
  private readonly TIME_MULTIPLIER = 0.003;
  private readonly WAVE_AMPLITUDE = 3;
  private readonly WAVE_FREQUENCY_STEP = 0.5;

  constructor() {
    // React to audio player state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.isPlaying = state.isPlaying;

      if (state.isPlaying && state.currentSong) {
        this.startAnalysis();
      } else {
        this.stopAnalysis();
      }
    });
  }

  ngOnInit() {
    this.initializeBars();
    this.setupAudioAnalysis();
  }

  ngOnDestroy() {
    this.cleanup();
  }  private initializeBars() {
    this.bars = new Array(this.barCount);
    this.centerWeights = new Array(this.barCount);
    this.frequencyMappings = new Array(this.barCount);
    this.centerDistances = new Array(this.barCount);

    // Pre-calculate all values once to avoid repeated calculations
    for (let i = 0; i < this.barCount; i++) {
      const position = i / (this.barCount - 1);
      const centerDistance = Math.abs(position - 0.5);

      // Store pre-calculated values
      this.centerDistances[i] = centerDistance;

      // Pre-calculate center weights
      const mountainCurve = Math.cos(centerDistance * Math.PI) * 0.4 + 0.6;
      let centerBoost = 1.0;

      if (centerDistance <= 0.1) {
        centerBoost = 2.0;
      } else if (centerDistance <= 0.2) {
        centerBoost = 1.7;
      } else if (centerDistance <= 0.3) {
        centerBoost = 1.3;
      } else {
        centerBoost = 0.8 - centerDistance * 0.4;
      }

      this.centerWeights[i] = mountainCurve * centerBoost;

      // Pre-calculate frequency mappings
      const midRangeStart = 0.4 - centerDistance * 0.2;
      const midRangeEnd = 0.6 + centerDistance * 0.2;
      this.frequencyMappings[i] = { start: midRangeStart, end: midRangeEnd };

      // Initialize bar heights with center bias
      this.bars[i] = 4 + (1 - centerDistance) * 8;
    }
  }
  private async setupAudioAnalysis() {
    try {
      // Get audio element from service
      const audioElement = this.audioPlayerService.getAudioElement();
      if (!audioElement) {
        console.warn('🔊 No audio element available, using fallback animation');
        this.fallbackToSmartAnimation();
        return;
      }

      // Use shared audio context to avoid multiple connections
      if (AudioEqualizerComponent.connectedElement === audioElement &&
          AudioEqualizerComponent.sharedAudioContext &&
          AudioEqualizerComponent.sharedAnalyser) {

        this.audioContext = AudioEqualizerComponent.sharedAudioContext;
        this.analyser = AudioEqualizerComponent.sharedAnalyser;
        this.source = AudioEqualizerComponent.sharedSource;

      } else {
        // Clean up previous connections
        this.cleanupSharedAudio();

        // Create new audio context
        AudioEqualizerComponent.sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audioContext = AudioEqualizerComponent.sharedAudioContext;

        // Create analyzer
        AudioEqualizerComponent.sharedAnalyser = this.audioContext.createAnalyser();
        AudioEqualizerComponent.sharedAnalyser.fftSize = 512;
        AudioEqualizerComponent.sharedAnalyser.smoothingTimeConstant = 0.8;
        AudioEqualizerComponent.sharedAnalyser.minDecibels = -90;
        AudioEqualizerComponent.sharedAnalyser.maxDecibels = -10;
        this.analyser = AudioEqualizerComponent.sharedAnalyser;

        // Create source (only once per audio element)
        AudioEqualizerComponent.sharedSource = this.audioContext.createMediaElementSource(audioElement);
        this.source = AudioEqualizerComponent.sharedSource;

        // Connect: source -> analyser -> destination
        this.source.connect(this.analyser);
        this.source.connect(this.audioContext.destination);

        // Track the connected element
        AudioEqualizerComponent.connectedElement = audioElement;
      }

      // Create frequency data array
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Failed to setup audio analysis:', error);
      this.fallbackToSmartAnimation();
    }
  }

  private startAnalysis() {
    if (!this.isInitialized || !this.analyser || !this.frequencyData) {
      this.fallbackToSmartAnimation();
      return;
    }

    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    this.animate();
  }

  private stopAnalysis() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Gradually reduce bars to minimum
    this.animateToMinimum();
  }
  private animate() {
    if (!this.analyser || !this.frequencyData) return;

    // Get frequency data
    this.analyser.getByteFrequencyData(this.frequencyData);

    // Process frequency data into bars
    this.updateBars();

    // Trigger change detection
    this.cdr.detectChanges();

    // Continue animation if playing
    if (this.isPlaying) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    }
  }
  // Remove unused method - values are now pre-calculated
  // private getFrequencyWeight(barIndex: number): number { ... }

  private updateBars() {
    if (!this.frequencyData) return;

    const bufferLength = this.frequencyData.length;
    const time = Date.now() * this.TIME_MULTIPLIER; // Use pre-calculated constant

    for (let i = 0; i < this.barCount; i++) {
      // Use pre-calculated values (no repeated calculations)
      const mapping = this.frequencyMappings[i];
      const centerWeight = this.centerWeights[i];
      const centerDistance = this.centerDistances[i];

      const startIndex = Math.floor(mapping.start * bufferLength);
      const endIndex = Math.floor(mapping.end * bufferLength);

      // Ensure valid range (optimized bounds checking)
      const safeStart = Math.max(0, Math.min(startIndex, bufferLength - 1));
      const safeEnd = Math.max(safeStart + 1, Math.min(endIndex, bufferLength));

      // Calculate average efficiently
      let sum = 0;
      const rangeSize = safeEnd - safeStart;
      for (let j = safeStart; j < safeEnd; j++) {
        sum += this.frequencyData[j];
      }
      const average = sum / rangeSize;

      // Apply pre-calculated weights (no repeated multiplication)
      let barHeight = (average / 255) * this.SENSITIVITY_FACTOR * this.sensitivity * centerWeight;

      // Simplified movement calculation with pre-calculated constants
      const centerBonus = 1 - centerDistance;
      barHeight += Math.sin(time + i * this.WAVE_FREQUENCY_STEP) * this.WAVE_AMPLITUDE * centerBonus;

      // Pre-calculated minimum height using constants
      const minHeight = this.MIN_HEIGHT_BASE + centerBonus * this.MIN_HEIGHT_CENTER_BONUS;
      barHeight = Math.max(minHeight, Math.min(100, barHeight));

      // Smooth transitions using pre-calculated factors
      this.bars[i] = this.bars[i] * this.SMOOTH_KEEP_FACTOR + barHeight * this.SMOOTH_NEW_FACTOR;
    }
  }
  private animateToMinimum() {
    const animateDown = () => {
      let allAtMinimum = true;

      for (let i = 0; i < this.bars.length; i++) {
        if (this.bars[i] > 4) {
          this.bars[i] = Math.max(4, this.bars[i] * 0.9);
          allAtMinimum = false;
        }
      }

      this.cdr.detectChanges();

      if (!allAtMinimum) {
        setTimeout(() => requestAnimationFrame(animateDown), 50);
      }
    };

    animateDown();
  }
  private fallbackToSmartAnimation() {

    if (!this.isPlaying) return;

    // Pre-calculate constants to avoid repeated calculations
    const timeMultiplier = 0.002;
    const globalPulseFreq = 2;
    const centerDistanceEffect = 0.6;
    const frequencyBase = 0.8;
    const frequencyRange = 0.3;
    const harmonicsMultiplier = 1.5;
    const harmonicsAmplitude = 12;
    const smoothFactor = 0.2; // For smooth transitions

    const animate = () => {
      const time = Date.now() * timeMultiplier; // Calculate once
      const globalPulse = Math.sin(time * globalPulseFreq) * 8; // Global pulse effect
      const globalSin = Math.sin(time * 0.8); // Calculate once

      for (let i = 0; i < this.barCount; i++) {
        // Use pre-calculated values (no repeated calculations)
        const centerDistance = this.centerDistances[i];
        const centerMultiplier = 1 - centerDistance * centerDistanceEffect;

        // Optimized calculations with pre-calculated values
        const frequency = frequencyBase + centerDistance * frequencyRange;
        const amplitude = (35 + globalSin * 25) * centerMultiplier;

        const baseHeight = 15 + Math.sin(time * frequency) * amplitude;
        const harmonics = Math.sin(time * frequency * harmonicsMultiplier) * harmonicsAmplitude * centerMultiplier;
        const centerPulse = globalPulse * (1 - centerDistance);

        // Pre-calculated minimum height
        const minHeight = 6 + (1 - centerDistance) * 12;
        const calculatedHeight = baseHeight + harmonics + centerPulse;

        // Smooth transition instead of direct assignment
        const targetHeight = Math.max(minHeight, Math.min(95, calculatedHeight));
        this.bars[i] = this.bars[i] * (1 - smoothFactor) + targetHeight * smoothFactor;
      }

      this.cdr.markForCheck(); // More efficient than detectChanges

      if (this.isPlaying) {
        setTimeout(() => requestAnimationFrame(animate), 50);
      }
    };

    animate();
  }

  getBarColor(index: number, height: number): string {
    const intensity = height / 100;
    const position = index / (this.barCount - 1);

    // Professional gradient: Deep purple to cyan
    const baseHue = 270 - (position * 120); // 270 (purple) to 150 (cyan)
    const saturation = 70 + intensity * 30;
    const lightness = 40 + intensity * 30;

    return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
  }

  getBarShadow(index: number, height: number): string {
    const intensity = height / 100;
    const glowStrength = Math.max(0.2, intensity);
    const position = index / (this.barCount - 1);
    const baseHue = 270 - (position * 120);

    return `0 0 ${4 + glowStrength * 8}px hsla(${baseHue}, 80%, 60%, ${glowStrength * 0.6})`;
  }
  private cleanup() {
    this.stopAnalysis();
    this.isInitialized = false;
    // Don't cleanup shared resources here, let other instances use them
  }

  private static cleanupSharedAudio() {
    if (AudioEqualizerComponent.sharedAudioContext &&
        AudioEqualizerComponent.sharedAudioContext.state !== 'closed') {
      AudioEqualizerComponent.sharedAudioContext.close();
    }

    AudioEqualizerComponent.sharedAudioContext = null;
    AudioEqualizerComponent.sharedAnalyser = null;
    AudioEqualizerComponent.sharedSource = null;
    AudioEqualizerComponent.connectedElement = null;
  }

  private cleanupSharedAudio() {
    AudioEqualizerComponent.cleanupSharedAudio();
  }

  // Public methods for external control
  public setBarCount(count: number) {
    this.barCount = count;
    this.initializeBars();
  }

  public setSensitivity(sensitivity: number) {
    this.sensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
  }

  public toggleGlow() {
    this.showGlow = !this.showGlow;
  }
}
