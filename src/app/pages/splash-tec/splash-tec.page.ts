import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonImg, IonSpinner} from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-splash-tec',
  templateUrl: './splash-tec.page.html',
  styleUrls: ['./splash-tec.page.scss'],
  imports: [IonImg, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonSpinner],
})
export class SplashTecPage implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 2000);
  }
}
