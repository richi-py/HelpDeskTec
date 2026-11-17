import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import type { Incidencia as IncidenciaApi } from '../../models/incidencia.model';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo.pipe';
import { IncidenciasService } from '../../services/incidencias.service';

export interface Incidencia {
  id: string;
  titulo: string;
  created_at: string;
  estado: 'asignadas' | 'proceso' | 'resueltas';
  badgeColor: string;
  badgeTexto: string;
}

@Component({
  selector: 'app-mis-incidencias',
  templateUrl: './mis-incidencias.page.html',
  styleUrls: ['./mis-incidencias.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSegment,
    IonSegmentButton,
    TiempoRelativoPipe,
  ],
})
export class MisIncidenciasPage implements OnInit {
  filtro: string = 'asignadas';

  incidencias: Incidencia[] = [
    {
      id: 'INC-0041',
      titulo: 'Fallo de red en aula 12',
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      estado: 'asignadas',
      badgeColor: 'warning',
      badgeTexto: 'Asignada',
    },
    {
      id: 'INC-0042',
      titulo: 'Impresora sin conexión',
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      estado: 'asignadas',
      badgeColor: 'warning',
      badgeTexto: 'Asignada',
    },
    {
      id: 'INC-0043',
      titulo: 'Proyector no enciende',
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      estado: 'asignadas',
      badgeColor: 'warning',
      badgeTexto: 'Asignada',
    },
    {
      id: 'INC-0044',
      titulo: 'Actualización de software',
      created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      estado: 'asignadas',
      badgeColor: 'warning',
      badgeTexto: 'Asignada',
    },
    {
      id: 'INC-0038',
      titulo: 'Revisión de cableado estructurado',
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      estado: 'proceso',
      badgeColor: 'primary',
      badgeTexto: 'En proceso',
    },
    {
      id: 'INC-0039',
      titulo: 'Mantenimiento de servidor local',
      created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      estado: 'proceso',
      badgeColor: 'primary',
      badgeTexto: 'En proceso',
    },
    {
      id: 'INC-0025',
      titulo: 'Cambio de tóner en Dirección',
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      estado: 'resueltas',
      badgeColor: 'success',
      badgeTexto: 'Resuelta',
    },
    {
      id: 'INC-0026',
      titulo: 'Instalación de antivirus',
      created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
      estado: 'resueltas',
      badgeColor: 'success',
      badgeTexto: 'Resuelta',
    },
  ];

  constructor(private incidenciasService: IncidenciasService) {}

  ngOnInit(): void {
    const token = localStorage.getItem('helpdesk_token');
    if (!token) {
      return;
    }

    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.incidencias = lista
          .filter((inc) => inc.estado !== 'pendiente')
          .map((inc) => this.mapearIncidencia(inc));
      },
      error: () => {},
    });
  }

  private mapearIncidencia(inc: IncidenciaApi): Incidencia {
    const mapa: Record<
      Exclude<IncidenciaApi['estado'], 'pendiente'>,
      { estado: Incidencia['estado']; badgeColor: string; badgeTexto: string }
    > = {
      asignada: { estado: 'asignadas', badgeColor: 'warning', badgeTexto: 'Asignada' },
      en_proceso: { estado: 'proceso', badgeColor: 'primary', badgeTexto: 'En proceso' },
      resuelta: { estado: 'resueltas', badgeColor: 'success', badgeTexto: 'Resuelta' },
    };

    const meta = mapa[inc.estado as Exclude<IncidenciaApi['estado'], 'pendiente'>];
    return {
      id: inc.codigo,
      titulo: inc.titulo,
      created_at: inc.created_at,
      estado: meta.estado,
      badgeColor: meta.badgeColor,
      badgeTexto: meta.badgeTexto,
    };
  }

  get incidenciasFiltradas(): Incidencia[] {
    return this.incidencias.filter((item) => item.estado === this.filtro);
  }
}
