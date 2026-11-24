import { Component, OnInit, ChangeDetectorRef, NgZone, ApplicationRef } from '@angular/core';
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
  nombreUsuario = 'Técnico';

  resumen: ResumenDashboard = {
    pendientes: 0,
    asignadas: 0,
    en_proceso: 0,
    resueltas: 0,
  };

  incidenciasRecientes: Array<{
    codigo: string;
    titulo: string;
    estadoTexto: string;
    badgeColor: string;
    created_at: string;
  }> = [];

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    this.cargarDesdeCache();
    this.cargarDatos();
  }

  ionViewWillEnter(): void {
    this.cargarDesdeCache();
    this.cargarDatos();
  }

  private cargarDesdeCache(): void {
    const usr = this.incidenciasService.getUsuarioActual();
    if (usr?.nombre) {
      this.nombreUsuario = usr.nombre.split(' ')[0] || usr.nombre;
    }
    const cacheResumen = localStorage.getItem('helpdesk_tec_resumen');
    if (cacheResumen) {
      try {
        this.resumen = JSON.parse(cacheResumen);
      } catch {}
    }
    const cacheTickets = localStorage.getItem('helpdesk_tec_recientes');
    if (cacheTickets) {
      try {
        this.incidenciasRecientes = JSON.parse(cacheTickets);
      } catch {}
    }
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  cargarDatos(): void {
    this.incidenciasService.getPerfil().subscribe({
      next: (perfil) => {
        this.ngZone.run(() => {
          if (perfil?.nombre) {
            this.nombreUsuario = perfil.nombre.split(' ')[0] || perfil.nombre;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
            this.appRef.tick();
          }
        });
      },
      error: () => {},
    });

    this.incidenciasService.getResumen().subscribe({
      next: (resumen) => {
        this.ngZone.run(() => {
          if (resumen) {
            this.resumen = resumen;
            localStorage.setItem('helpdesk_tec_resumen', JSON.stringify(resumen));
            this.cdr.markForCheck();
            this.cdr.detectChanges();
            this.appRef.tick();
          }
        });
      },
      error: () => {},
    });

    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.ngZone.run(() => {
          if (lista && lista.length > 0) {
            this.incidenciasRecientes = lista.slice(0, 5).map((inc: Incidencia) => ({
              codigo: inc.codigo || (inc.id ? inc.id.substring(0, 6) : 'INC'),
              titulo: inc.titulo,
              estadoTexto: this.etiquetaEstado(inc.estado),
              badgeColor: this.colorEstado(inc.estado),
              created_at: inc.created_at,
            }));
            localStorage.setItem(
              'helpdesk_tec_recientes',
              JSON.stringify(this.incidenciasRecientes)
            );
          } else {
            this.incidenciasRecientes = [];
            localStorage.removeItem('helpdesk_tec_recientes');
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        });
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
