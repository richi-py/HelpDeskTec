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
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowBackOutline,
  briefcaseOutline,
  callOutline,
  checkmarkCircleOutline,
  lockClosedOutline,
  personOutline,
} from 'ionicons/icons';
import { IncidenciasService } from '../../services/incidencias.service';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
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
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
  ],
})
export class RegistroPage implements OnInit {
  nombre = '';
  correo = '';
  area = '';
  telefono = '';
  password = '';
  confirmPassword = '';

  errorMensaje = '';
  exitoMensaje = '';
  cargando = false;

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService
  ) {}

  ngOnInit() {
    addIcons({
      arrowBackOutline,
      personOutline,
      briefcaseOutline,
      callOutline,
      lockClosedOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
    });
  }

  registrarTecnico() {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    const nombreLimpio = this.nombre.trim();
    const correoLimpio = this.correo.trim().toLowerCase();
    const passLimpio = this.password.trim();

    if (!nombreLimpio) {
      this.errorMensaje = 'Por favor, ingresa tu nombre completo.';
      return;
    }

    if (!correoLimpio) {
      this.errorMensaje = 'Por favor, ingresa tu correo electrónico.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correoLimpio)) {
      this.errorMensaje = 'Ingresa un formato de correo válido (ej: tecnico@empresa.com).';
      return;
    }

    if (!passLimpio) {
      this.errorMensaje = 'Por favor, define una contraseña.';
      return;
    }

    if (passLimpio.length < 4) {
      this.errorMensaje = 'La contraseña debe tener al menos 4 caracteres.';
      return;
    }

    if (passLimpio !== this.confirmPassword.trim()) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;
    this.incidenciasService
      .registro({
        nombre: nombreLimpio,
        correo: correoLimpio,
        password: passLimpio,
        rol: 'tecnico',
        area: this.area.trim() || 'Soporte Técnico',
        telefono: this.telefono.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.cargando = false;
          this.exitoMensaje = '¡Cuenta de técnico creada exitosamente! Redirigiendo...';

          // Iniciar sesión automáticamente
          this.incidenciasService.login(correoLimpio, passLimpio).subscribe({
            next: () => {
              setTimeout(() => {
                this.router.navigate(['/tabs/tab1']);
              }, 1200);
            },
            error: () => {
              setTimeout(() => {
                this.router.navigate(['/login']);
              }, 1500);
            },
          });
        },
        error: (err) => {
          this.cargando = false;
          if (err.status === 409) {
            this.errorMensaje = 'Este correo electrónico ya está registrado en el sistema.';
          } else if (err.status === 0) {
            this.errorMensaje =
              'No se puede conectar con el servidor. Verifica que Flask esté iniciado (python Directions.py).';
          } else {
            this.errorMensaje =
              err.error?.mensaje || 'Error al crear la cuenta. Inténtalo nuevamente.';
          }
        },
      });
  }

  volverAlLogin() {
    this.router.navigate(['/login']);
  }
}
