import {
  Component,
  OnInit,
  OnDestroy,
  effect,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject, takeUntil } from 'rxjs';
import { DatabaseService } from 'src/app/services/database.service';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';


enum DragState {
  IDLE,
  DETECTING, // Đang đếm 1.5s
  DRAG_ACTIVE, // Đã scale, ready to drag
  REORDERING, // Đang drag vertical
  DELETING, // Đang drag horizontal > 75%
}

@Component({
  selector: 'app-current-playlist',
  templateUrl: './current-playlist.component.html',
  styleUrls: ['./current-playlist.component.scss'],
  standalone: true,
  imports: [CommonModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentPlaylistComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);

  // Drag and gesture state
  dragState = signal<DragState>(DragState.IDLE);
  dragItemIndex = signal<number>(-1);
  longPressTimer: any = null;
  touchStartPos = { x: 0, y: 0 };
  touchCurrentPos = { x: 0, y: 0 };
  itemWidth = 0;

  // Expose DragState enum to template
  DragState = DragState;

  // Use signals to track state - this ensures proper reactivity
  currentSong = this.audioPlayerService.currentSong;
  isPlaying = this.audioPlayerService.isPlayingSignal;
  isShuffling = this.audioPlayerService.isShuffling;
  currentIndex = this.audioPlayerService.currentIndex;
  currentTime = this.audioPlayerService.currentTime;
  duration = this.audioPlayerService.duration;

  // Computed signals based on playbackState
  playbackState = this.audioPlayerService.playbackState;
  currentPlaylist = computed(() => this.playbackState().currentPlaylist);

  // Progress percentage for progress bar
  progressPercentage = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  // Formatted time strings
  progressTime = computed(() => this.formatTime(this.currentTime()));

  // Countdown time - thời gian còn lại
  remainingTime = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    const remaining = total > 0 ? total - current : 0;
    return Math.max(0, remaining); // Đảm bảo không âm
  });

  // Formatted countdown time
  durationTime = computed(() => {
    const remaining = this.remainingTime();
    return `-${this.formatTime(remaining)}`;
  });
  @Output() dragActive = new EventEmitter<boolean>();

  constructor() {
    // Force change detection when any signal changes - THIS IS THE KEY FIX
    effect(() => {
      // Track all signals that should trigger UI updates
      const song = this.currentSong();
      const playing = this.isPlaying();
      const shuffling = this.isShuffling();
      const index = this.currentIndex();
      const time = this.currentTime();
      const dur = this.duration();
      const state = this.playbackState(); // Force change detection to ensure UI updates
      // Use requestAnimationFrame to ensure it runs in next tick
      requestAnimationFrame(() => {
        this.cdr.detectChanges();
      });
    }); // Listen for custom events from PlayerPage to force change detection
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'player-action-triggered',
        this.handlePlayerAction
      );
    }
  }
  ngOnInit() {
    // No need to manually assign since we're using signals directly
    // Signals will automatically update the UI when values change
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up custom event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener(
        'player-action-triggered',
        this.handlePlayerAction
      );
    } // Clean up drag state
    this.resetNewDragState();
  }
  private handlePlayerAction = () => {
    requestAnimationFrame(() => {
      this.cdr.detectChanges();
    });
  };

  // Track function for ngFor
  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
  // Get current song index in playlist
  getCurrentSongIndex(): number {
    return this.currentIndex();
  }

  // Check if song is currently playing
  isCurrentSong(song: Song): boolean {
    return this.currentSong()?.id === song.id;
  }
  // Get CSS class for song item
  getSongItemClass(song: Song, index: number): string {
    const isActive = this.isCurrentSong(song);
    const baseClass = 'transition-all duration-200';

    if (isActive) {
      return `${baseClass} bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700`;
    }

    return `${baseClass} hover:bg-gray-50 dark:hover:bg-gray-800`;
  } // Play specific song
  async playSong(song: Song, index: number) {
    try {
      await this.audioPlayerService.playSong(
        song,
        this.currentPlaylist(),
        index
      );
      // Force UI update after playing
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error playing song:', error);
    }
  } // Remove song from playlist
  async removeSong(event: Event, index: number) {
    event.stopPropagation();

    if (this.currentPlaylist().length <= 1) {
      // If only one song left, clear everything
      await this.clearPlaylist();
      return;
    }

    try {
      // Use removeFromQueue method from audio service
      this.audioPlayerService.removeFromQueue(index);
    } catch (error) {
      console.error('Error removing song:', error);
    }
  } // Toggle shuffle mode
  async toggleShuffle() {
    try {
      this.audioPlayerService.toggleShuffle();
      // Force UI update after action
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error toggling shuffle:', error);
    }
  }

  // Clear entire playlist
  async clearPlaylist() {
    try {
      await this.audioPlayerService.pause();
      // Set empty playlist
      await this.audioPlayerService.setPlaylist([]);
    } catch (error) {
      console.error('Error clearing playlist:', error);
    }
  }
  previousTrack() {
    this.audioPlayerService.playPrevious();
    // Force UI update after action
    this.cdr.detectChanges();
  }

  togglePlayPause() {
    this.audioPlayerService.togglePlayPause();
    // Force UI update after action
    this.cdr.detectChanges();
  }

  nextTrack() {
    this.audioPlayerService.playNext();
    // Force UI update after action
    this.cdr.detectChanges();
  }
  async toggleFavorite() {
    const song = this.currentSong();
    if (!song) return;

    try {
      const newFavoriteStatus = !song.isFavorite;
      await this.databaseService.toggleFavorite(song.id);

      // Update the song object
      song.isFavorite = newFavoriteStatus;
      this.audioPlayerService.updateCurrentSong(song);

      // Force UI update
      this.cdr.detectChanges();

      console.log(`Song ${song.title} favorite status: ${newFavoriteStatus}`);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  // Debug method to manually check signals
  debugSignals() {
    console.log('🔍 Debug signals:', {
      currentSong: this.currentSong()?.title,
      isPlaying: this.isPlaying(),
      isShuffling: this.isShuffling(),
      currentTime: this.currentTime(),
      duration: this.duration(),
      progressPercentage: this.progressPercentage(),
      playbackState: this.playbackState(),
    });
  }

  // Force UI refresh method
  forceRefresh() {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }
  // ============ NEW SIMPLIFIED DRAG METHODS ============

  private dragStartTime = 0;
  private dragThreshold = 500; // 500ms for long press

  onDragHandleStart(event: PointerEvent, index: number) {
    this.dragStartTime = Date.now();
    this.dragItemIndex.set(index);

    // Start monitoring for long press
    setTimeout(() => {
      if (Date.now() - this.dragStartTime >= this.dragThreshold) {
        this.activateNewDragMode();
      }
    }, this.dragThreshold);
  }

  onDragHandleEnd(event: PointerEvent) {
    const dragDuration = Date.now() - this.dragStartTime;

    if (dragDuration < this.dragThreshold) {
      // Short press - play song
      const index = this.dragItemIndex();
      const song = this.currentPlaylist()[index];
      if (song) {
        this.playSong(song, index);
      }
    }

    this.resetNewDragState();
  }

  onLongPress(event: Event, index: number) {
    // Context menu event for additional long press detection
    event.preventDefault();
    this.dragItemIndex.set(index);
    this.activateNewDragMode();
  }
  private activateNewDragMode() {
    this.dragState.set(DragState.DRAG_ACTIVE);
    this.dragActive.emit(true); // Emit event to parent component

    // Add haptic feedback on mobile
    this.triggerHapticFeedback();

    this.cdr.detectChanges();
  }

  private resetNewDragState() {
    this.dragState.set(DragState.IDLE);
    this.dragItemIndex.set(-1);
    this.dragStartTime = 0;
    this.dragActive.emit(false); // Emit event to parent component

    this.cdr.detectChanges();
  }

  private triggerHapticFeedback() {
    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration
    }

    // Visual feedback class for immediate response
    const itemElement = document.querySelector(
      `.song-item:nth-child(${this.dragItemIndex() + 1})`
    );
    if (itemElement) {
      itemElement.classList.add('haptic-feedback');
      setTimeout(() => {
        itemElement.classList.remove('haptic-feedback');
      }, 100);
    }
  }
  // Handle CDK drag drop for reordering
  onDrop(event: CdkDragDrop<Song[]>) {
    if (event.previousIndex !== event.currentIndex) {
      const playlist = [...this.currentPlaylist()];
      moveItemInArray(playlist, event.previousIndex, event.currentIndex);

      // Lưu lại bài hát, thời gian và trạng thái playing
      const currentSong = this.currentSong();
      const currentTime = this.currentTime();
      const wasPlaying = this.isPlaying();
      let newCurrentIndex = this.audioPlayerService.currentIndex();

      if (currentSong) {
        newCurrentIndex = playlist.findIndex(
          (song) => song.id === currentSong.id
        );
      }
      // Nếu bài hát không đổi, chỉ reorder in place để không reset audio
      if (
        currentSong &&
        playlist[newCurrentIndex] &&
        playlist[newCurrentIndex].id === currentSong.id
      ) {
        this.audioPlayerService.reorderPlaylistInPlace(
          playlist,
          newCurrentIndex
        );
        // KHÔNG gọi seek hoặc togglePlayPause nữa để đảm bảo hoàn toàn liền mạch
      } else {
        // Nếu currentSong thay đổi (trường hợp hiếm), fallback về setPlaylist
        this.audioPlayerService.setPlaylist(playlist, newCurrentIndex);
        setTimeout(() => {
          if (this.currentSong()?.id === currentSong?.id) {
            this.audioPlayerService.seek(currentTime);
            if (wasPlaying && !this.isPlaying()) {
              this.audioPlayerService.togglePlayPause();
            }
          }
        }, 100);
      }
    }
    this.resetNewDragState();
  }
  // Get item styling based on drag state
  getItemDragClass(index: number): string {
    const currentState = this.dragState();
    const dragIndex = this.dragItemIndex();

    if (dragIndex !== index) return '';

    switch (currentState) {
      case DragState.DRAG_ACTIVE:
        return 'scale-105 z-50 shadow-xl ring-2 ring-purple-500';
      case DragState.REORDERING:
        return 'scale-105 z-50 shadow-xl ring-2 ring-purple-500';
      default:
        return '';
    }
  }

  // Simplified drag mode check
  isDragModeActive(): boolean {
    return this.dragState() !== DragState.IDLE;
  }
}
