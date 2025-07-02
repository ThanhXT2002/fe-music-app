import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { FooterComponent } from "../../components/footer/footer.component";
import { HomeService } from 'src/app/services/api/home.service';
import { Song } from 'src/app/interfaces/song.interface';


@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, FormsModule, FooterComponent, IonContent]
})
export class HomePage implements OnInit {

  listSongs: Song[] = [];

  constructor(
    private homeService: HomeService
  ) { }

  ngOnInit() {
    // Get cached data (already loaded when app started)
    this.homeService.getHomeData().subscribe({
      next: (res) => {
        if (res) {
          console.log('Home page received cached data:', res.data);
          // Convert res.data (DataSong) to an array of Song objects
          this.listSongs = (Array.isArray(res.data) ? res.data : [res.data]).map((dataSong: any) => ({
            ...dataSong,
            audioUrl: dataSong.audioUrl ?? '',
            addedDate: dataSong.addedDate ?? '',
            isFavorite: dataSong.isFavorite ?? false
          }));

          console.log('List of songs:', this.listSongs);
          // Process the cached data here
        } else {
          console.log('Data is still loading...');
        }
      },
      error: (error) => {
        console.error('Error in home page:', error);
      }
    });
  }

}
