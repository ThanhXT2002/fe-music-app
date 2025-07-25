import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PwaGuidePage } from './pwa-guide.page';

describe('PwaGuidePage', () => {
  let component: PwaGuidePage;
  let fixture: ComponentFixture<PwaGuidePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PwaGuidePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
