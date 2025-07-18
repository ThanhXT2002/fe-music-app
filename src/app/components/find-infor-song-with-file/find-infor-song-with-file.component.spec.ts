import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { FindInforSongWithFileComponent } from './find-infor-song-with-file.component';

describe('FindInforSongWithFileComponent', () => {
  let component: FindInforSongWithFileComponent;
  let fixture: ComponentFixture<FindInforSongWithFileComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FindInforSongWithFileComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(FindInforSongWithFileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
