import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Oops404Page } from './oops-404.page';

describe('Oops404Page', () => {
  let component: Oops404Page;
  let fixture: ComponentFixture<Oops404Page>;

  beforeEach(() => {
    fixture = TestBed.createComponent(Oops404Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
