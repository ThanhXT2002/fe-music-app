import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditPlaylistPage } from './edit-playlist.page';

describe('EditPlaylistPage', () => {
  let component: EditPlaylistPage;
  let fixture: ComponentFixture<EditPlaylistPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EditPlaylistPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
