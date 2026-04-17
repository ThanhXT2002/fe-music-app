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
import { PlayerStore } from '../../core/stores/player.store';

/**
 * Component hiển thị hiệu ứng sóng âm (audio equalizer) theo nhạc.
 * 
 * Chức năng:
 * - Lấy data từ AudioContext của trình duyệt để vẽ cột sóng âm
 * - Tự động fallback sang giả lập sóng (smart animation) nếu không access được AudioElement
 * - Tối ưu hoá performance (tính toán trước phần trăm, dùng requestAnimationFrame)
 * - Tối ưu hóa việc kết nối AudioContext: Sử dụng chung connection cho toàn bộ ứng dụng để tránh lỗi "hết slot AudioContext".
 */
@Component({
  selector: 'app-audio-equalizer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="equalizer-container" [style.width]="width" [style.height]="height">
      <!-- ===================== CỘT SÓNG ÂM ===================== -->
      <div class="frequency-bars" #frequencyBars>
        <div
          class="bar"
          *ngFor="let bar of bars; let i = index"
          [style.height.%]="bar"
          [style.background]="getBarColor(i, bar)"
          [style.box-shadow]="getBarShadow(i, bar)"
        ></div>
      </div>

      <!-- ===================== HIỆU ỨNG ÁNH SÁNG ===================== -->
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
  // ─────────────────────────────────────────────────────────
  // Inputs / ViewChild
  // ─────────────────────────────────────────────────────────

  /** Chiều rộng của component equalizer */
  @Input() width: string = '100px';
  
  /** Chiều cao của component equalizer */
  @Input() height: string = '40px';
  
  /** Số lượng cột sóng âm hiển thị */
  @Input() barCount: number = 16;
  
  /** Độ nhạy của sóng âm: số càng cao cột nảy càng mạnh */
  @Input() sensitivity: number = 1.5;
  
  /** Cho phép hiện hiệu ứng phát sáng mờ khi nhạc đang phát */
  @Input() showGlow: boolean = true;
  
  /** Tham chiếu đến DOM chứa các cột sóng để thao tác trực tiếp nếu cần thiết */
  @ViewChild('frequencyBars', { static: true }) frequencyBarsRef!: ElementRef;

  // ─────────────────────────────────────────────────────────
  // Injected dependencies
  // ─────────────────────────────────────────────────────────

  private player = inject(PlayerStore);
  private cdr = inject(ChangeDetectorRef);

  // ─────────────────────────────────────────────────────────
  // Audio Analysis Properties (Local)
  // ─────────────────────────────────────────────────────────

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private animationFrame: number | null = null;
  private frequencyData: Uint8Array | null = null;

  // ─────────────────────────────────────────────────────────
  // Static Shared Resources
  // ─────────────────────────────────────────────────────────

  // NOTE: Giữ static properties để dùng chung AudioContext cho mọi instance. 
  // Trình duyệt có giới hạn số lượng AudioContext, nếu tạo mới mỗi lần sẽ bị lỗi "hardware exception".
  private static sharedAudioContext: AudioContext | null = null;
  private static sharedSource: MediaElementAudioSourceNode | null = null;
  private static sharedAnalyser: AnalyserNode | null = null;
  private static connectedElement: HTMLAudioElement | null = null;

  // ─────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────

  /** Mảng lưu chiều cao của các cột sóng âm (tính theo %) */
  bars: number[] = [];
  
  /** Trạng thái hiển thị hiệu ứng nhạc */
  isPlaying = false;
  
  private isInitialized = false;
  private lastAudioElement: HTMLAudioElement | null = null;

  // ─────────────────────────────────────────────────────────
  // Caching / Constants (Performance Optimization)
  // ─────────────────────────────────────────────────────────

  private centerWeights: number[] = [];
  private frequencyMappings: { start: number; end: number }[] = [];
  private centerDistances: number[] = [];

  private readonly SENSITIVITY_FACTOR = 100;
  private readonly MIN_HEIGHT_BASE = 4;
  private readonly MIN_HEIGHT_CENTER_BONUS = 8;
  private readonly SMOOTH_KEEP_FACTOR = 0.85;
  private readonly SMOOTH_NEW_FACTOR = 0.15;
  private readonly TIME_MULTIPLIER = 0.003;
  private readonly WAVE_AMPLITUDE = 3;
  private readonly WAVE_FREQUENCY_STEP = 0.5;

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  constructor() {
    // Theo dõi trạng thái PlayerStore để start/stop hiệu ứng animation đồng bộ với nhạc
    effect(() => {
      const state = this.player.playbackState();
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
  }

  // ─────────────────────────────────────────────────────────
  // Data Setup
  // ─────────────────────────────────────────────────────────

  /**
   * Tính toán trước (pre-calculate) các biến nội suy, vùng tần số, và khoảng cách tới tâm 
   * để không phải tính lại trong mỗi frame loop vẽ của requestAnimationFrame.
   */
  private initializeBars() {
    this.bars = new Array(this.barCount);
    this.centerWeights = new Array(this.barCount);
    this.frequencyMappings = new Array(this.barCount);
    this.centerDistances = new Array(this.barCount);

    for (let i = 0; i < this.barCount; i++) {
      const position = i / (this.barCount - 1);
      const centerDistance = Math.abs(position - 0.5);

      this.centerDistances[i] = centerDistance;

      // Tính đường cong chóp núi (cột ở giữa cao hơn các cột hai bên)
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

      // Tính dải tần số tương ứng cho mỗi cột
      const midRangeStart = 0.4 - centerDistance * 0.2;
      const midRangeEnd = 0.6 + centerDistance * 0.2;
      this.frequencyMappings[i] = { start: midRangeStart, end: midRangeEnd };

      // Khởi tạo cột nằm ở mức tối thiểu có bias cao hơn dần vào giữa
      this.bars[i] = 4 + (1 - centerDistance) * 8;
    }
  }

  /**
   * Khởi tạo Web Audio API để phân tích tần số nhạc theo thời gian thực.
   */
  private async setupAudioAnalysis() {
    try {
      const audioElement = this.player.getAudioElement();
      if (!audioElement) {
        // FIXME: Chưa lấy được audio element có thể do race condition, đang dùng animation tĩnh tạm
        console.warn('No audio element available, using fallback animation');
        this.fallbackToSmartAnimation();
        return;
      }

      // Chỉ thiết lập lại context nếu audio element bị đổi sang phần tử khác thực sự
      if (AudioEqualizerComponent.connectedElement === audioElement &&
          AudioEqualizerComponent.sharedAudioContext &&
          AudioEqualizerComponent.sharedAnalyser) {
        this.audioContext = AudioEqualizerComponent.sharedAudioContext;
        this.analyser = AudioEqualizerComponent.sharedAnalyser;
        this.source = AudioEqualizerComponent.sharedSource;
      } else {
        this.cleanupSharedAudio();

        // Khởi tạo context Audio tùy loại trình duyệt
        AudioEqualizerComponent.sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audioContext = AudioEqualizerComponent.sharedAudioContext;

        AudioEqualizerComponent.sharedAnalyser = this.audioContext.createAnalyser();
        // 512 là đủ để có độ chi tiết cao mà không tốn CPU
        AudioEqualizerComponent.sharedAnalyser.fftSize = 512;
        AudioEqualizerComponent.sharedAnalyser.smoothingTimeConstant = 0.8;
        AudioEqualizerComponent.sharedAnalyser.minDecibels = -90;
        AudioEqualizerComponent.sharedAnalyser.maxDecibels = -10;
        this.analyser = AudioEqualizerComponent.sharedAnalyser;

        AudioEqualizerComponent.sharedSource = this.audioContext.createMediaElementSource(audioElement);
        this.source = AudioEqualizerComponent.sharedSource;

        // Bắt buộc phải connect source vào analyser và destination để âm thanh được phát ra loa
        this.source.connect(this.analyser);
        this.source.connect(this.audioContext.destination);

        AudioEqualizerComponent.connectedElement = audioElement;
      }

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.isInitialized = true;

    } catch (error) {
      console.error('Failed to setup audio analysis:', error);
      this.fallbackToSmartAnimation();
    }
  }

  // ─────────────────────────────────────────────────────────
  // Animation & Rendering Process
  // ─────────────────────────────────────────────────────────

  private startAnalysis() {
    if (!this.isInitialized || !this.analyser || !this.frequencyData) {
      this.fallbackToSmartAnimation();
      return;
    }

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

    this.animateToMinimum();
  }

  private animate() {
    if (!this.analyser || !this.frequencyData) return;

    // HACK: Ép kiểu sang any do lỗi mismatch type Uint8Array giữa thư viện core TypeScript mới (TS > 5) và DOM API.
    // Lỗi gốc: Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'Uint8Array<ArrayBuffer>'
    this.analyser.getByteFrequencyData(this.frequencyData as any);

    this.updateBars();
    this.cdr.detectChanges();

    if (this.isPlaying) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    }
  }

  private updateBars() {
    if (!this.frequencyData) return;

    const bufferLength = this.frequencyData.length;
    const time = Date.now() * this.TIME_MULTIPLIER; 

    for (let i = 0; i < this.barCount; i++) {
      const mapping = this.frequencyMappings[i];
      const centerWeight = this.centerWeights[i];
      const centerDistance = this.centerDistances[i];

      const startIndex = Math.floor(mapping.start * bufferLength);
      const endIndex = Math.floor(mapping.end * bufferLength);

      // Đảm bảo không truy cập mảng bị lố index
      const safeStart = Math.max(0, Math.min(startIndex, bufferLength - 1));
      const safeEnd = Math.max(safeStart + 1, Math.min(endIndex, bufferLength));

      let sum = 0;
      const rangeSize = safeEnd - safeStart;
      for (let j = safeStart; j < safeEnd; j++) {
        sum += this.frequencyData[j];
      }
      const average = sum / rangeSize;

      let barHeight = (average / 255) * this.SENSITIVITY_FACTOR * this.sensitivity * centerWeight;

      const centerBonus = 1 - centerDistance;
      // Cộng hưởng thêm mượt mà dựa trên sóng đồ thị hàm sin
      barHeight += Math.sin(time + i * this.WAVE_FREQUENCY_STEP) * this.WAVE_AMPLITUDE * centerBonus;

      const minHeight = this.MIN_HEIGHT_BASE + centerBonus * this.MIN_HEIGHT_CENTER_BONUS;
      barHeight = Math.max(minHeight, Math.min(100, barHeight));

      // Dùng hệ số làm mượt để các cột không bị giật cục
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

  /**
   * Giả lập effect nhạc trường hợp Web Audio API bị block (ví dụ: Apple chặn auto-play, chưa tương tác người dùng).
   */
  private fallbackToSmartAnimation() {
    if (!this.isPlaying) return;

    const timeMultiplier = 0.002;
    const globalPulseFreq = 2;
    const centerDistanceEffect = 0.6;
    const frequencyBase = 0.8;
    const frequencyRange = 0.3;
    const harmonicsMultiplier = 1.5;
    const harmonicsAmplitude = 12;
    const smoothFactor = 0.2; 

    const animate = () => {
      const time = Date.now() * timeMultiplier;
      const globalPulse = Math.sin(time * globalPulseFreq) * 8; 
      const globalSin = Math.sin(time * 0.8);

      for (let i = 0; i < this.barCount; i++) {
        const centerDistance = this.centerDistances[i];
        const centerMultiplier = 1 - centerDistance * centerDistanceEffect;

        const frequency = frequencyBase + centerDistance * frequencyRange;
        const amplitude = (35 + globalSin * 25) * centerMultiplier;

        const baseHeight = 15 + Math.sin(time * frequency) * amplitude;
        const harmonics = Math.sin(time * frequency * harmonicsMultiplier) * harmonicsAmplitude * centerMultiplier;
        const centerPulse = globalPulse * (1 - centerDistance);

        const minHeight = 6 + (1 - centerDistance) * 12;
        const calculatedHeight = baseHeight + harmonics + centerPulse;

        const targetHeight = Math.max(minHeight, Math.min(95, calculatedHeight));
        this.bars[i] = this.bars[i] * (1 - smoothFactor) + targetHeight * smoothFactor;
      }

      this.cdr.markForCheck(); 

      if (this.isPlaying) {
        setTimeout(() => requestAnimationFrame(animate), 50);
      }
    };

    animate();
  }

  // ─────────────────────────────────────────────────────────
  // Utilities & Internal Styles Computation
  // ─────────────────────────────────────────────────────────

  /**
   * Tính toán màu CSS gradient cho từng cột sóng (bar).
   * Dùng dải màu HSL trải từ tím đậm đến ngọc lục bảo tuỳ thuộc vào chiều cao hiện tại.
   */
  getBarColor(index: number, height: number): string {
    const intensity = height / 100;
    const position = index / (this.barCount - 1);

    const baseHue = 270 - (position * 120); 
    const saturation = 70 + intensity * 30;
    const lightness = 40 + intensity * 30;

    return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Tính toán độ đổ bóng (box-shadow/glow) cho component tương ứng với màu sắc và biên độ âm thanh.
   */
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
    // NOTE: Cố ý không dọn dẹp AudioContext static ở đây để các instance component khác dùng chung
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

  // ─────────────────────────────────────────────────────────
  // Public Interface Control
  // ─────────────────────────────────────────────────────────

  /** Cập nhật lại số cột sóng âm hiển thị */
  public setBarCount(count: number) {
    this.barCount = count;
    this.initializeBars();
  }

  /** Điều chỉnh độ nhạy nhảy sóng (cột sẽ nảy cao hơn với cùng mức âm lượng khi hệ số lớn) */
  public setSensitivity(sensitivity: number) {
    this.sensitivity = Math.max(0.1, Math.min(3.0, sensitivity));
  }

  /** Bật/Tắt hiệu ứng background gradient phản sáng vòng tròn */
  public toggleGlow() {
    this.showGlow = !this.showGlow;
  }
}
