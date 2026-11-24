import { Component, OnInit, ChangeDetectorRef, NgZone, ApplicationRef } from '@angular/core';
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
  incidencias: Incidencia[] = [];

  constructor(
    private incidenciasService: IncidenciasService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    this.cargarIncidencias();
  }

  ionViewWillEnter(): void {
    this.cargarIncidencias();
  }

  cargarIncidencias(): void {
    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.ngZone.run(() => {
          if (lista && lista.length > 0) {
            this.incidencias = lista
              .filter((inc) => inc.estado !== 'pendiente')
              .map((inc) => this.mapearIncidencia(inc));
          } else {
            this.incidencias = [];
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        });
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
