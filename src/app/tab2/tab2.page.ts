import { Component, OnInit, ChangeDetectorRef, NgZone, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonModal,
  IonButtons,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonRefresher,
  IonRefresherContent,
  AlertController,
  LoadingController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  closeOutline,
  imageOutline,
  checkmarkCircleOutline,
  timeOutline,
  arrowUndoOutline,
  refreshOutline,
} from 'ionicons/icons';
import type {
  EstadoIncidencia,
  ImagenIncidencia,
  Incidencia,
} from '../models/incidencia.model';
import { TiempoRelativoPipe } from '../pipes/tiempo-relativo.pipe';
import { IncidenciasService } from '../services/incidencias.service';

export interface IncidenciaItem {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: EstadoIncidencia;
  estadoTexto: string;
  badgeColor: string;
  created_at: string;
  tipo?: string;
  urgencia?: string;
  usuario_nombre?: string;
  imagenes: ImagenIncidencia[];
  solucion?: string | null;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule,
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
    IonModal,
    IonButtons,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonRefresher,
    IonRefresherContent,
    TiempoRelativoPipe,
  ],
})
export class Tab2Page implements OnInit {
  textoBusqueda = '';
  filtroEstado: 'todas' | EstadoIncidencia = 'todas';

  incidenciaSeleccionada: IncidenciaItem | null = null;
  modalAbierto = false;

  incidencias: IncidenciaItem[] = [];

  constructor(
    private router: Router,
    private incidenciasService: IncidenciasService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {
    addIcons({
      arrowBackOutline,
      closeOutline,
      imageOutline,
      checkmarkCircleOutline,
      timeOutline,
      arrowUndoOutline,
      refreshOutline,
    });
  }

  handleRefresh(event: any): void {
    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.ngZone.run(() => {
          if (lista && lista.length > 0) {
            this.incidencias = lista.map((inc) => this.mapearIncidencia(inc));
            localStorage.setItem(
              'helpdesk_tec_incidencias',
              JSON.stringify(this.incidencias)
            );
          } else {
            this.incidencias = [];
            localStorage.removeItem('helpdesk_tec_incidencias');
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          event.target.complete();
        });
      },
      error: () => {
        event.target.complete();
      },
    });
  }

  ngOnInit(): void {
    this.cargarDesdeCache();
    this.cargarIncidencias();
  }

  ionViewWillEnter(): void {
    this.cargarDesdeCache();
    this.cargarIncidencias();
  }

  private cargarDesdeCache(): void {
    const cache = localStorage.getItem('helpdesk_tec_incidencias');
    if (cache) {
      try {
        const datos = JSON.parse(cache);
        if (datos && datos.length > 0) {
          this.incidencias = datos;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        }
      } catch {}
    }
  }

  cargarIncidencias(): void {
    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.ngZone.run(() => {
          if (lista && lista.length > 0) {
            this.incidencias = lista.map((inc) => this.mapearIncidencia(inc));
            localStorage.setItem(
              'helpdesk_tec_incidencias',
              JSON.stringify(this.incidencias)
            );
          } else {
            this.incidencias = [];
            localStorage.removeItem('helpdesk_tec_incidencias');
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        });
      },
      error: (err) => {
        console.error('Error al cargar incidencias:', err);
      },
    });
  }

  private mapearIncidencia(inc: Incidencia): IncidenciaItem {
    const mapa: Record<EstadoIncidencia, { texto: string; color: string }> = {
      pendiente: { texto: 'Pendiente', color: 'medium' },
      asignada: { texto: 'Asignada', color: 'warning' },
      en_proceso: { texto: 'En proceso', color: 'primary' },
      resuelta: { texto: 'Resuelta', color: 'success' },
    };
    const meta = mapa[inc.estado] || { texto: inc.estado, color: 'medium' };

    return {
      id: inc.id,
      codigo: inc.codigo,
      titulo: inc.titulo,
      descripcion: inc.descripcion,
      estado: inc.estado,
      estadoTexto: meta.texto,
      badgeColor: meta.color,
      created_at: inc.created_at,
      tipo: inc.tipo,
      urgencia: inc.urgencia,
      usuario_nombre: inc.usuario_nombre,
      imagenes: inc.imagenes || [],
      solucion: inc.solucion,
    };
  }

  get incidenciasFiltradas(): IncidenciaItem[] {
    const termino = this.textoBusqueda.trim().toLowerCase();

    return this.incidencias.filter((inc) => {
      const coincideEstado =
        this.filtroEstado === 'todas' || inc.estado === this.filtroEstado;
      const coincideTexto =
        !termino ||
        inc.codigo.toLowerCase().includes(termino) ||
        inc.titulo.toLowerCase().includes(termino) ||
        inc.descripcion.toLowerCase().includes(termino);

      return coincideEstado && coincideTexto;
    });
  }

  verDetalle(inc: IncidenciaItem): void {
    this.incidenciaSeleccionada = inc;
    this.modalAbierto = true;
  }

  cerrarDetalle(): void {
    this.modalAbierto = false;
    this.incidenciaSeleccionada = null;
  }

  async cambiarEstado(nuevoEstado: EstadoIncidencia): Promise<void> {
    if (!this.incidenciaSeleccionada) return;

    let solucion: string | undefined = undefined;

    if (nuevoEstado === 'resuelta') {
      const prompt = await this.alertController.create({
        header: 'Resolver incidencia',
        message: 'Describe brevemente la solución aplicada:',
        inputs: [
          {
            name: 'solucion',
            type: 'textarea',
            placeholder: 'Detalles de la solución...',
          },
        ],
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Resolver',
            handler: (data) => {
              solucion = data.solucion;
              this.ejecutarCambioEstado(nuevoEstado, solucion);
            },
          },
        ],
      });
      await prompt.present();
      return;
    }

    this.ejecutarCambioEstado(nuevoEstado);
  }

  private async ejecutarCambioEstado(
    nuevoEstado: EstadoIncidencia,
    solucion?: string
  ): Promise<void> {
    if (!this.incidenciaSeleccionada) return;

    const loading = await this.loadingController.create({
      message: 'Actualizando estado...',
    });
    await loading.present();

    this.incidenciasService
      .cambiarEstado(this.incidenciaSeleccionada.id, nuevoEstado, solucion)
      .subscribe({
        next: async (res) => {
          await loading.dismiss();
          if (this.incidenciaSeleccionada) {
            this.incidenciaSeleccionada.estado = nuevoEstado;
            const mapa: Record<EstadoIncidencia, { texto: string; color: string }> = {
              pendiente: { texto: 'Pendiente', color: 'medium' },
              asignada: { texto: 'Asignada', color: 'warning' },
              en_proceso: { texto: 'En proceso', color: 'primary' },
              resuelta: { texto: 'Resuelta', color: 'success' },
            };
            this.incidenciaSeleccionada.estadoTexto = mapa[nuevoEstado].texto;
            this.incidenciaSeleccionada.badgeColor = mapa[nuevoEstado].color;
            if (solucion) {
              this.incidenciaSeleccionada.solucion = solucion;
            }
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
          this.cargarIncidencias();
        },
        error: async (err) => {
          await loading.dismiss();
          console.error('Error al cambiar estado:', err);
          const alerta = await this.alertController.create({
            header: 'Error al actualizar estado',
            message:
              err?.error?.error ||
              err?.error?.msg ||
              'No se pudo actualizar el estado en HelpDesk.',
            buttons: ['Aceptar'],
          });
          await alerta.present();
        },
      });
  }

  async deshacerAccion(): Promise<void> {
    if (!this.incidenciaSeleccionada) return;

    const loading = await this.loadingController.create({
      message: 'Revirtiendo último cambio de estado...',
    });
    await loading.present();

    this.incidenciasService.deshacerUltimoEstado(this.incidenciaSeleccionada.id).subscribe({
      next: async (res) => {
        await loading.dismiss();
        const alerta = await this.alertController.create({
          header: 'Cambio Deshecho',
          message: `Se restauró el estado anterior: "${res.estado_anterior_restaurado}".`,
          buttons: ['Aceptar'],
        });
        await alerta.present();
        this.modalAbierto = false;
        this.cargarIncidencias();
      },
      error: async () => {
        await loading.dismiss();
        const alerta = await this.alertController.create({
          header: 'No se puede deshacer',
          message: 'Esta incidencia no tiene cambios previos para revertir.',
          buttons: ['Aceptar'],
        });
        await alerta.present();
      },
    });
  }

  backPage(): void {
    this.router.navigate(['/tabs/tab1']);
  }
}
