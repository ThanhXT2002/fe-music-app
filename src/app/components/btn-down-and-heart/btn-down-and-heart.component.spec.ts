import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BtnDownAndHeartComponent } from './btn-down-and-heart.component';

describe('BtnDownAndHeartComponent', () => {
  let component: BtnDownAndHeartComponent;
  let fixture: ComponentFixture<BtnDownAndHeartComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BtnDownAndHeartComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BtnDownAndHeartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
