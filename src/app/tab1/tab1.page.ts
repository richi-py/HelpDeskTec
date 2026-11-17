import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/angular';
import type { Incidencia, ResumenDashboard } from '../models/incidencia.model';
import { TiempoRelativoPipe } from '../pipes/tiempo-relativo.pipe';
import { IncidenciasService } from '../services/incidencias.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    TiempoRelativoPipe,
  ],
})
export class Tab1Page implements OnInit {
  nombreUsuario = 'Carlos';

  resumen: ResumenDashboard = {
    pendientes: 0,
    asignadas: 4,
    en_proceso: 2,
    resueltas: 12,
  };

  incidenciasRecientes: Array<{
    codigo: string;
    titulo: string;
    estadoTexto: string;
    badgeColor: string;
    created_at: string;
  }> = [
    {
      codigo: 'INC-0041',
      titulo: 'Fallo de red en aula 12',
      estadoTexto: 'Asignada',
      badgeColor: 'warning',
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
  ];

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('helpdesk_token');
    if (!token) {
      return;
    }

    this.incidenciasService.getPerfil().subscribe({
      next: (perfil) => {
        this.nombreUsuario = perfil.nombre.split(' ')[0] || perfil.nombre;
      },
      error: () => {},
    });

    this.incidenciasService.getResumen().subscribe({
      next: (resumen) => {
        this.resumen = resumen;
      },
      error: () => {},
    });

    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.incidenciasRecientes = lista.slice(0, 1).map((inc: Incidencia) => ({
          codigo: inc.codigo,
          titulo: inc.titulo,
          estadoTexto: this.etiquetaEstado(inc.estado),
          badgeColor: this.colorEstado(inc.estado),
          created_at: inc.created_at,
        }));
      },
      error: () => {},
    });
  }

  private etiquetaEstado(estado: Incidencia['estado']): string {
    const mapa: Record<Incidencia['estado'], string> = {
      pendiente: 'Pendiente',
      asignada: 'Asignada',
      en_proceso: 'En proceso',
      resuelta: 'Resuelta',
    };
    return mapa[estado];
  }

  private colorEstado(estado: Incidencia['estado']): string {
    const mapa: Record<Incidencia['estado'], string> = {
      pendiente: 'medium',
      asignada: 'warning',
      en_proceso: 'primary',
      resuelta: 'success',
    };
    return mapa[estado];
  }

  goToMisIncidencias(): void {
    this.router.navigate(['/mis-incidencias']);
  }

  ViewAll(): void {
    this.router.navigate(['/tabs/tab2']);
  }
}
