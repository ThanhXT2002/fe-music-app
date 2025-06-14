import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { BackgroundDownloadService, DownloadSchedule } from '../../services/background-download.service';
import { DataSong } from '../../interfaces/song.interface';

@Component({
  selector: 'app-download-scheduler',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Schedule Download</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form [formGroup]="scheduleForm" (ngSubmit)="onSubmit()">
        <!-- Song Info -->
        <div class="song-info mb-4" *ngIf="songData">
          <ion-item>
            <ion-thumbnail slot="start">
              <img [src]="songData.thumbnails?.medium?.url || songData.thumbnail_url"
                   [alt]="songData.title">
            </ion-thumbnail>
            <ion-label>
              <h2>{{ songData.title }}</h2>
              <p>{{ songData.artist }}</p>
            </ion-label>
          </ion-item>
        </div>

        <!-- Scheduling Options -->
        <ion-list>
          <ion-item>
            <ion-select
              label="Schedule Type"
              formControlName="scheduleType"
              placeholder="Choose when to download">
              <ion-select-option value="now">Download Now</ion-select-option>
              <ion-select-option value="later">Schedule for Later</ion-select-option>
              <ion-select-option value="conditions">When Conditions Met</ion-select-option>
            </ion-select>
          </ion-item>

          <!-- Date/Time picker for "later" option -->
          <div *ngIf="scheduleForm.get('scheduleType')?.value === 'later'">
            <ion-item>
              <ion-datetime
                label="Schedule Date & Time"
                formControlName="scheduledTime"
                [min]="minDateTime"
                display-format="MMM DD, YYYY HH:mm"
                picker-format="MMM DD YYYY HH:mm">
              </ion-datetime>
            </ion-item>
          </div>

          <!-- Priority -->
          <ion-item>
            <ion-range
              label="Priority"
              formControlName="priority"
              min="1"
              max="10"
              step="1"
              snaps="true"
              ticks="true"
              pin="true"
              color="primary">
              <ion-label slot="start">Low</ion-label>
              <ion-label slot="end">High</ion-label>
            </ion-range>
          </ion-item>

          <!-- Conditions -->
          <ion-item>
            <ion-checkbox formControlName="wifiOnly"></ion-checkbox>
            <ion-label class="ion-margin-start">
              <h3>WiFi Only</h3>
              <p>Only download when connected to WiFi</p>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-checkbox formControlName="batteryConstraint"></ion-checkbox>
            <ion-label class="ion-margin-start">
              <h3>Battery Level Constraint</h3>
              <p>Only download when battery is above minimum level</p>
            </ion-label>
          </ion-item>

          <!-- Battery level slider -->
          <ion-item *ngIf="scheduleForm.get('batteryConstraint')?.value">
            <ion-range
              label="Minimum Battery Level (%)"
              formControlName="minimumBattery"
              min="10"
              max="90"
              step="5"
              snaps="true"
              pin="true"
              color="warning">
            </ion-range>
          </ion-item>

          <!-- Time window for conditions-based scheduling -->
          <div *ngIf="scheduleForm.get('scheduleType')?.value === 'conditions'">
            <ion-item>
              <ion-checkbox formControlName="timeWindow"></ion-checkbox>
              <ion-label class="ion-margin-start">
                <h3>Time Window</h3>
                <p>Only download within specific hours</p>
              </ion-label>
            </ion-item>

            <div *ngIf="scheduleForm.get('timeWindow')?.value" class="time-window">
              <ion-item>
                <ion-datetime
                  label="Start Time"
                  formControlName="startTime"
                  presentation="time"
                  [showDefaultButtons]="true">
                </ion-datetime>
              </ion-item>

              <ion-item>
                <ion-datetime
                  label="End Time"
                  formControlName="endTime"
                  presentation="time"
                  [showDefaultButtons]="true">
                </ion-datetime>
              </ion-item>
            </div>
          </div>

          <!-- Retry Settings -->
          <ion-item>
            <ion-select
              label="Max Retries"
              formControlName="maxRetries"
              placeholder="Choose retry limit">
              <ion-select-option value="0">No Retries</ion-select-option>
              <ion-select-option value="1">1 Retry</ion-select-option>
              <ion-select-option value="3">3 Retries</ion-select-option>
              <ion-select-option value="5">5 Retries</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-list>

        <!-- Action Buttons -->
        <div class="action-buttons mt-6">
          <ion-button
            expand="block"
            type="submit"
            [disabled]="!scheduleForm.valid"
            color="primary">
            <ion-icon name="download" slot="start"></ion-icon>
            Schedule Download
          </ion-button>

          <ion-button
            expand="block"
            fill="outline"
            color="medium"
            (click)="dismiss()">
            Cancel
          </ion-button>
        </div>
      </form>
    </ion-content>
  `,
  styles: [`
    .song-info {
      background: var(--ion-color-light);
      border-radius: 8px;
      padding: 8px;
    }

    .time-window {
      padding-left: 16px;
      border-left: 2px solid var(--ion-color-primary);
      margin: 8px 0;
    }

    .action-buttons {
      padding: 16px 0;
    }

    .action-buttons ion-button {
      margin-bottom: 8px;
    }

    ion-range {
      --bar-background: var(--ion-color-light);
      --bar-background-active: var(--ion-color-primary);
      --knob-background: var(--ion-color-primary);
    }
  `]
})
export class DownloadSchedulerComponent {
  @Input() songData?: DataSong;
  @Output() scheduleCreated = new EventEmitter<DownloadSchedule>();

  private fb = inject(FormBuilder);
  private modalController = inject(ModalController);
  private backgroundDownloadService = inject(BackgroundDownloadService);

  scheduleForm: FormGroup;
  minDateTime: string;

  constructor() {
    // Set minimum date to current time
    this.minDateTime = new Date().toISOString();

    this.scheduleForm = this.fb.group({
      scheduleType: ['now', Validators.required],
      scheduledTime: [new Date().toISOString()],
      priority: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      wifiOnly: [true],
      batteryConstraint: [false],
      minimumBattery: [20],
      timeWindow: [false],
      startTime: ['22:00'],
      endTime: ['08:00'],
      maxRetries: [3, Validators.required]
    });
  }

  async onSubmit() {
    if (!this.scheduleForm.valid || !this.songData) {
      return;
    }

    const formValue = this.scheduleForm.value;

    // Determine scheduled time
    let scheduledTime = new Date();
    if (formValue.scheduleType === 'later') {
      scheduledTime = new Date(formValue.scheduledTime);
    } else if (formValue.scheduleType === 'conditions') {
      // For conditions-based, schedule for immediate evaluation
      scheduledTime = new Date();
    }

    // Build conditions
    const conditions: DownloadSchedule['conditions'] = {
      wifiOnly: formValue.wifiOnly
    };

    if (formValue.batteryConstraint) {
      conditions.batteryLevel = formValue.minimumBattery;
    }

    if (formValue.timeWindow && formValue.scheduleType === 'conditions') {
      conditions.timeWindow = {
        start: formValue.startTime,
        end: formValue.endTime
      };
    }

    // Create schedule
    try {
      const scheduleId = this.backgroundDownloadService.scheduleDownload(
        this.songData,
        conditions,
        formValue.priority,
        scheduledTime
      );

      // Emit event
      const schedule: DownloadSchedule = {
        id: scheduleId,
        songData: this.songData,
        scheduledTime,
        conditions,
        status: 'pending',
        priority: formValue.priority,
        retryCount: 0,
        maxRetries: formValue.maxRetries
      };

      this.scheduleCreated.emit(schedule);

      // Show success message
      const toast = document.createElement('ion-toast');
      toast.message = 'Download scheduled successfully';
      toast.duration = 2000;
      toast.color = 'success';
      document.body.appendChild(toast);
      toast.present();

      this.dismiss();
    } catch (error) {
      console.error('Failed to schedule download:', error);

      const toast = document.createElement('ion-toast');
      toast.message = 'Failed to schedule download';
      toast.duration = 3000;
      toast.color = 'danger';
      document.body.appendChild(toast);
      toast.present();
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }
}
