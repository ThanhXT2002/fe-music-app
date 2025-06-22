# 🎵 Audio Equalizer Component

Một component equalizer chuyên nghiệp thực sự phân tích âm thanh và tạo hiệu ứng trực quan theo nhịp nhạc.

## ✨ Tính năng

- **Real-time Audio Analysis**: Sử dụng Web Audio API để phân tích tần số âm thanh thực tế
- **Professional Fallback**: Animation thông minh khi không thể truy cập audio element
- **Responsive Design**: Tự động điều chỉnh theo kích thước container
- **Customizable**: Có thể tùy chỉnh số lượng thanh, độ nhạy, màu sắc
- **Performance Optimized**: Sử dụng requestAnimationFrame và change detection tối ưu

## 🚀 Cách sử dụng

### 1. Import component
```typescript
import { AudioEqualizerComponent } from './components/shared/audio-equalizer/audio-equalizer.component';

@Component({
  imports: [AudioEqualizerComponent]
})
```

### 2. Sử dụng trong template
```html
<!-- Basic usage -->
<app-audio-equalizer></app-audio-equalizer>

<!-- Custom configuration -->
<app-audio-equalizer 
  width="120px" 
  height="60px" 
  [barCount]="24" 
  [sensitivity]="2.0"
  [showGlow]="true">
</app-audio-equalizer>
```

## ⚙️ Properties

| Property | Type | Default | Mô tả |
|----------|------|---------|-------|
| `width` | string | '100px' | Chiều rộng của equalizer |
| `height` | string | '40px' | Chiều cao của equalizer |
| `barCount` | number | 16 | Số lượng thanh tần số |
| `sensitivity` | number | 1.5 | Độ nhạy (0.1 - 3.0) |
| `showGlow` | boolean | true | Hiển thị hiệu ứng glow |

## 🎯 Public Methods

```typescript
// Thay đổi số lượng thanh
equalizer.setBarCount(32);

// Điều chỉnh độ nhạy
equalizer.setSensitivity(2.5);

// Bật/tắt hiệu ứng glow
equalizer.toggleGlow();
```

## 🔧 Technical Details

### Web Audio API
- **FFT Size**: 512 (độ phân giải cao)
- **Smoothing**: 0.75 (smooth transitions)
- **Frequency Range**: -90dB to -10dB
- **Analysis Rate**: 60fps với requestAnimationFrame

### Fallback Animation
Khi không thể truy cập audio element, component tự động chuyển sang animation fallback thông minh với:
- Harmonic movement theo các tần số khác nhau
- Random noise để tạo tự nhiên
- Frequency weighting cho bass và treble

### Color System
- **Bass (0-20%)**: Purple boost với gradient
- **Mid (20-80%)**: Balanced frequencies
- **Treble (80-100%)**: Cyan boost với glow effect

## 🎨 Styling

Component sử dụng CSS custom properties và có thể dễ dàng tùy chỉnh:

```css
.equalizer-container {
  /* Tùy chỉnh background */
  background: your-custom-gradient;
}

.bar {
  /* Tùy chỉnh thanh tần số */
  border-radius: 4px;
  opacity: 0.9;
}
```

## 📱 Responsive

- **Mobile**: Gap 1px, thanh nhỏ hơn
- **Desktop**: Gap 2px, thanh full size
- **Auto-scaling**: Tự động điều chỉnh theo container

## 🔄 Lifecycle

1. **ngOnInit**: Khởi tạo thanh và setup audio analysis
2. **Audio Detection**: Tự động detect audio element từ AudioPlayerService
3. **Context Creation**: Tạo AudioContext và AnalyserNode
4. **Real-time Analysis**: Phân tích tần số và cập nhật bars
5. **ngOnDestroy**: Cleanup resources và disconnect audio nodes

## ⚠️ Lưu ý

- Cần có AudioPlayerService với method `getAudioElement()`
- Web Audio API yêu cầu user interaction trước khi hoạt động
- Component tự động fallback khi không thể access audio
- Performance tốt nhất với barCount 8-32

## 🔗 Dependencies

- Angular 19+ với signals
- AudioPlayerService (internal)
- Web Audio API (built-in browser)
