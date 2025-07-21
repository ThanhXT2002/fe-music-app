import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestAudioPage } from './test-audio.page';

describe('TestAudioPage', () => {
  let component: TestAudioPage;
  let fixture: ComponentFixture<TestAudioPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestAudioPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
