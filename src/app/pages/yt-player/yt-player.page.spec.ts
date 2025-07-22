import { ComponentFixture, TestBed } from '@angular/core/testing';
import { YtPlayerPage } from './yt-player.page';

describe('YtPlayerPage', () => {
  let component: YtPlayerPage;
  let fixture: ComponentFixture<YtPlayerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(YtPlayerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
