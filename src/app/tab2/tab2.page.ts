import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonSearchbar,
  IonSegmentButton,
  IonSegment,
  IonLabel,
  IonList,
  IonItem,
  IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import type { EstadoIncidencia, Incidencia } from '../models/incidencia.model';
import { TiempoRelativoPipe } from '../pipes/tiempo-relativo.pipe';
import { IncidenciasService } from '../services/incidencias.service';

export interface IncidenciaResumen {
  codigo: string;
  titulo: string;
  estado: EstadoIncidencia;
  estadoTexto: string;
  badgeColor: string;
  created_at: string;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonBadge,
    TiempoRelativoPipe,
  ],
})
export class Tab2Page implements OnInit {
  textoBusqueda = '';
  filtroEstado: 'todas' | EstadoIncidencia = 'todas';

  incidencias: IncidenciaResumen[] = [
    {
      codigo: 'INC-0045',
      titulo: 'Error en equipo de cómputo',
      estado: 'pendiente',
      estadoTexto: 'Pendiente',
      badgeColor: 'medium',
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      codigo: 'INC-0042',
      titulo: 'No funciona el correo institucional',
      estado: 'en_proceso',
      estadoTexto: 'En proceso',
      badgeColor: 'primary',
      created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
    {
      codigo: 'INC-0041',
      titulo: 'Fallo de red en aula 12',
      estado: 'asignada',
      estadoTexto: 'Asignada',
      badgeColor: 'warning',
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    },
    {
      codigo: 'INC-0039',
      titulo: 'Instalación de software',
      estado: 'resuelta',
      estadoTexto: 'Resuelta',
      badgeColor: 'success',
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ];

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService
  ) {
    addIcons({
      arrowBackOutline,
    });
  }

  ngOnInit(): void {
    const token = localStorage.getItem('helpdesk_token');
    if (!token) {
      return;
    }

    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.incidencias = lista.map((inc) => this.mapearIncidencia(inc));
      },
      error: () => {},
    });
  }

  private mapearIncidencia(inc: Incidencia): IncidenciaResumen {
    const mapa: Record<EstadoIncidencia, { texto: string; color: string }> = {
      pendiente: { texto: 'Pendiente', color: 'medium' },
      asignada: { texto: 'Asignada', color: 'warning' },
      en_proceso: { texto: 'En proceso', color: 'primary' },
      resuelta: { texto: 'Resuelta', color: 'success' },
    };
    const meta = mapa[inc.estado];
    return {
      codigo: inc.codigo,
      titulo: inc.titulo,
      estado: inc.estado,
      estadoTexto: meta.texto,
      badgeColor: meta.color,
      created_at: inc.created_at,
    };
  }

  get incidenciasFiltradas(): IncidenciaResumen[] {
    const termino = this.textoBusqueda.trim().toLowerCase();

    return this.incidencias.filter((inc) => {
      const coincideEstado =
        this.filtroEstado === 'todas' || inc.estado === this.filtroEstado;
      const coincideTexto =
        !termino ||
        inc.codigo.toLowerCase().includes(termino) ||
        inc.titulo.toLowerCase().includes(termino);

      return coincideEstado && coincideTexto;
    });
  }

  backPage(): void {
    this.router.navigate(['/tabs/tab1']);
  }
}
