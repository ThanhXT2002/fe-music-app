import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-skeleton-song-item',
  templateUrl: './skeleton-song-item.component.html',
  styleUrls: ['./skeleton-song-item.component.scss'],
})
export class SkeletonSongItemComponent  implements OnInit {
  @Input() index:number = 0;

  constructor() { }

  ngOnInit() {}

}
