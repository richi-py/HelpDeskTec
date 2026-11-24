import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonItem,
  IonInput,
  IonIcon,
  IonInputPasswordToggle,
  IonList,
  IonImg,
  IonSpinner,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { alertCircleOutline, lockClosedOutline, personAddOutline, personOutline } from 'ionicons/icons';
import { IncidenciasService } from '../../services/incidencias.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonButton,
    IonItem,
    IonInput,
    IonIcon,
    IonInputPasswordToggle,
    IonList,
    IonImg,
    IonSpinner,
  ],
})
export class LoginPage implements OnInit {
  correo = '';
  password = '';
  errorMensaje = '';
  cargando = false;

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService
  ) {}

  ngOnInit() {
    addIcons({
      lockClosedOutline,
      personOutline,
      alertCircleOutline,
      personAddOutline,
    });
  }

  ionViewWillEnter(): void {
    this.correo = '';
    this.password = '';
    this.errorMensaje = '';
    this.cargando = false;
  }

  ionViewDidLeave(): void {
    this.cargando = false;
    this.password = '';
  }

  pageHelpTec() {
    this.errorMensaje = '';

    const correoLimpio = this.correo.trim();
    const passLimpio = this.password.trim();

    // 1. Validación de campos obligatorios
    if (!correoLimpio) {
      this.errorMensaje = 'Por favor, ingresa tu correo electrónico.';
      return;
    }

    // 2. Validación de formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correoLimpio)) {
      this.errorMensaje = 'Ingresa un correo electrónico válido (ejemplo: usuario@empresa.com).';
      return;
    }

    if (!passLimpio) {
      this.errorMensaje = 'Por favor, ingresa tu contraseña.';
      return;
    }

    if (passLimpio.length < 4) {
      this.errorMensaje = 'La contraseña debe tener al menos 4 caracteres.';
      return;
    }

    // 3. Autenticación con el Backend de Flask y MongoDB
    this.cargando = true;
    this.incidenciasService.login(correoLimpio, passLimpio).subscribe({
      next: (res) => {
        this.cargando = false;

        // Validación de rol: esta app es para técnicos
        if (res.usuario && res.usuario.rol !== 'tecnico' && res.usuario.rol !== 'admin') {
          this.errorMensaje = 'Acceso denegado: Esta aplicación es exclusiva para personal técnico.';
          this.incidenciasService.logout();
          return;
        }

        this.password = '';
        this.cargando = false;
        this.router.navigate(['/tabs/tab1']);
      },
      error: (err) => {
        this.cargando = false;

        if (err.status === 0) {
          this.errorMensaje =
            'No se puede conectar al servidor. Asegúrate de tener iniciado el backend con: python Directions.py';
        } else if (err.status === 401 || err.status === 404) {
          this.errorMensaje = 'Correo o contraseña incorrectos.';
        } else {
          this.errorMensaje =
            err.error?.mensaje || 'Error al iniciar sesión. Inténtalo nuevamente.';
        }
      },
    });
  }

  irARegistro() {
    this.router.navigate(['/registro']);
  }
}
