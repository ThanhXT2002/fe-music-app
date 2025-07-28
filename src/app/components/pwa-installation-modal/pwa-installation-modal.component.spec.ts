import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PWAInstallationModalComponent } from './pwa-installation-modal.component';

describe('PWAInstallationModalComponent', () => {
  let component: PWAInstallationModalComponent;
  let fixture: ComponentFixture<PWAInstallationModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PWAInstallationModalComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PWAInstallationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
