import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonButton, IonItem, IonInput, IonIcon, IonInputPasswordToggle, IonList, IonImg } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { lockClosedOutline, personOutline } from 'ionicons/icons';
import { IncidenciasService } from '../../services/incidencias.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonContent, CommonModule, FormsModule, IonButton, IonItem, IonInput, IonIcon, IonInputPasswordToggle, IonList, IonImg],
})
export class LoginPage implements OnInit {
  correo = '';
  password = '';
  errorMensaje = '';

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService
  ) {}

  ngOnInit() {
    addIcons({
      lockClosedOutline,
      personOutline,
    });
  }

  pageHelpTec() {
    this.errorMensaje = '';
    if (!this.correo.trim() || !this.password.trim()) {
      this.router.navigate(['/tabs/tab1']);
      return;
    }

    this.incidenciasService.login(this.correo.trim(), this.password).subscribe({
      next: () => {
        this.router.navigate(['/tabs/tab1']);
      },
      error: (err) => {
        if (err.status === 0) {
          // Backend aún no iniciado: permite continuar en modo demo local
          this.router.navigate(['/tabs/tab1']);
        } else {
          this.errorMensaje = 'Correo o contraseña incorrectos.';
        }
      },
    });
  }
}
