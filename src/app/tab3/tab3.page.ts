import {
  Component,
  OnInit,
  ChangeDetectorRef,
  NgZone,
  ApplicationRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonLabel,
  IonItem,
  IonToggle,
  IonList,
  IonCol,
  IonAvatar,
  IonRow,
  IonGrid,
  IonButtons,
  IonInput,
  IonButton,
  IonModal,
  IonSelect,
  IonSelectOption,
  AlertController,
  NavController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronForwardOutline,
  personOutline,
  settingsOutline,
  logOutOutline,
  closeOutline,
  businessOutline,
  callOutline,
  mailOutline,
  downloadOutline,
  documentTextOutline,
  barChartOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { IncidenciasService } from '../services/incidencias.service';
import type { Incidencia, ResumenDashboard, Usuario } from '../models/incidencia.model';

export interface DatoGrafica {
  etiqueta: string;
  valor: number;
  claseColor: string;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonLabel,
    IonItem,
    IonToggle,
    IonList,
    IonCol,
    IonAvatar,
    IonRow,
    IonGrid,
    IonButtons,
    IonInput,
    IonButton,
    IonModal,
    IonSelect,
    IonSelectOption,
  ],
})
export class Tab3Page implements OnInit {
  usuario: Usuario | null = null;
  paletteToggle = false;

  // Filtros de reporte como en el mockup
  tipoReporte = 'estado'; // 'estado' | 'urgencia' | 'tipo'
  rangoFechas = '30dias'; // '7dias' | '30dias' | 'todo'

  incidencias: Incidencia[] = [];
  resumen: ResumenDashboard = {
    pendientes: 0,
    asignadas: 0,
    en_proceso: 0,
    resueltas: 0,
  };

  datosGrafica: DatoGrafica[] = [
    { etiqueta: 'Pendientes', valor: 0, claseColor: 'bar-amarillo' },
    { etiqueta: 'En proceso', valor: 0, claseColor: 'bar-azul' },
    { etiqueta: 'Resueltas', valor: 0, claseColor: 'bar-verde' },
    { etiqueta: 'Asignadas', valor: 0, claseColor: 'bar-rojo' },
  ];

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private incidenciasService: IncidenciasService,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {
    addIcons({
      chevronForwardOutline,
      personOutline,
      settingsOutline,
      logOutOutline,
      closeOutline,
      businessOutline,
      callOutline,
      mailOutline,
      downloadOutline,
      documentTextOutline,
      barChartOutline,
      checkmarkDoneOutline,
    });
  }

  ngOnInit(): void {
    this.paletteToggle = document.body.classList.contains('dark');
    this.cargarDesdeCache();
    this.cargarDatos();
  }

  ionViewWillEnter(): void {
    this.paletteToggle = document.body.classList.contains('dark');
    this.cargarDesdeCache();
    this.cargarDatos();
  }

  private cargarDesdeCache(): void {
    this.usuario = this.incidenciasService.getUsuarioActual();
    const cacheResumen = localStorage.getItem('helpdesk_tec_resumen');
    if (cacheResumen) {
      try {
        this.resumen = JSON.parse(cacheResumen);
      } catch {}
    }
    const cacheGrafica = localStorage.getItem('helpdesk_tec_grafica');
    if (cacheGrafica) {
      try {
        this.datosGrafica = JSON.parse(cacheGrafica);
      } catch {}
    } else {
      this.actualizarGraficaPorEstado(this.resumen);
    }
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  cargarDatos(): void {
    // 1. Cargar perfil del técnico
    this.incidenciasService.getPerfil().subscribe({
      next: (u) => {
        this.ngZone.run(() => {
          if (u) {
            this.usuario = u;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
            this.appRef.tick();
          }
        });
      },
      error: () => {},
    });

    // 2. Cargar resumen del dashboard
    this.incidenciasService.getResumen().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.resumen = res;
          localStorage.setItem('helpdesk_tec_resumen', JSON.stringify(res));
          if (this.tipoReporte === 'estado' && this.rangoFechas === 'todo') {
            this.actualizarGraficaPorEstado(res);
          }
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        });
      },
      error: () => {},
    });

    // 3. Cargar incidencias completas para filtros por rango y tipo
    this.incidenciasService.getIncidencias().subscribe({
      next: (lista) => {
        this.ngZone.run(() => {
          this.incidencias = lista || [];
          this.recalcularReporte();
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.appRef.tick();
        });
      },
      error: () => {},
    });
  }

  onFiltroChange(): void {
    this.recalcularReporte();
  }

  recalcularReporte(): void {
    // Filtrar incidencias según rango de fechas
    const ahora = new Date().getTime();
    let filtradas = this.incidencias;

    if (this.rangoFechas === '7dias') {
      const limite = ahora - 7 * 24 * 60 * 60 * 1000;
      filtradas = this.incidencias.filter((i) => {
        const fecha = new Date(i.created_at).getTime();
        return isNaN(fecha) || fecha >= limite;
      });
    } else if (this.rangoFechas === '30dias') {
      const limite = ahora - 30 * 24 * 60 * 60 * 1000;
      filtradas = this.incidencias.filter((i) => {
        const fecha = new Date(i.created_at).getTime();
        return isNaN(fecha) || fecha >= limite;
      });
    }

    if (this.tipoReporte === 'estado') {
      const pendientes = filtradas.filter((i) => i.estado === 'pendiente').length;
      const enProceso = filtradas.filter((i) => i.estado === 'en_proceso').length;
      const resueltas = filtradas.filter((i) => i.estado === 'resuelta').length;
      const asignadas = filtradas.filter((i) => i.estado === 'asignada').length;

      // Si aún no han llegado incidencias pero hay resumen, usar el resumen
      const finalPend = pendientes || (this.incidencias.length === 0 ? this.resumen.pendientes : 0);
      const finalProc = enProceso || (this.incidencias.length === 0 ? this.resumen.en_proceso : 0);
      const finalRes = resueltas || (this.incidencias.length === 0 ? this.resumen.resueltas : 0);
      const finalAsig = asignadas || (this.incidencias.length === 0 ? this.resumen.asignadas : 0);

      this.datosGrafica = [
        { etiqueta: 'Pendientes', valor: finalPend, claseColor: 'bar-amarillo' },
        { etiqueta: 'En proceso', valor: finalProc, claseColor: 'bar-azul' },
        { etiqueta: 'Resueltas', valor: finalRes, claseColor: 'bar-verde' },
        { etiqueta: 'Asignadas', valor: finalAsig, claseColor: 'bar-rojo' },
      ];
    } else if (this.tipoReporte === 'urgencia') {
      const baja = filtradas.filter((i) => (i.urgencia || '').toLowerCase() === 'baja').length;
      const media = filtradas.filter(
        (i) => (i.urgencia || '').toLowerCase() === 'media' || !i.urgencia
      ).length;
      const alta = filtradas.filter((i) => (i.urgencia || '').toLowerCase() === 'alta').length;
      const critica = filtradas.filter((i) => (i.urgencia || '').toLowerCase() === 'critica').length;

      this.datosGrafica = [
        { etiqueta: 'Baja', valor: baja, claseColor: 'bar-verde' },
        { etiqueta: 'Media', valor: media, claseColor: 'bar-amarillo' },
        { etiqueta: 'Alta', valor: alta, claseColor: 'bar-azul' },
        { etiqueta: 'Crítica', valor: critica, claseColor: 'bar-rojo' },
      ];
    } else if (this.tipoReporte === 'tipo') {
      const soporte = filtradas.filter((i) => (i.tipo || '').toLowerCase().includes('soporte')).length;
      const red = filtradas.filter((i) => (i.tipo || '').toLowerCase().includes('red')).length;
      const hardware = filtradas.filter((i) => (i.tipo || '').toLowerCase().includes('hardware')).length;
      const software = filtradas.filter((i) => (i.tipo || '').toLowerCase().includes('software')).length;

      this.datosGrafica = [
        { etiqueta: 'Soporte', valor: soporte, claseColor: 'bar-azul' },
        { etiqueta: 'Redes', valor: red, claseColor: 'bar-amarillo' },
        { etiqueta: 'Hardware', valor: hardware, claseColor: 'bar-verde' },
        { etiqueta: 'Software', valor: software, claseColor: 'bar-rojo' },
      ];
    }

    localStorage.setItem('helpdesk_tec_grafica', JSON.stringify(this.datosGrafica));
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  private actualizarGraficaPorEstado(res: ResumenDashboard): void {
    this.datosGrafica = [
      { etiqueta: 'Pendientes', valor: res.pendientes || 0, claseColor: 'bar-amarillo' },
      { etiqueta: 'En proceso', valor: res.en_proceso || 0, claseColor: 'bar-azul' },
      { etiqueta: 'Resueltas', valor: res.resueltas || 0, claseColor: 'bar-verde' },
      { etiqueta: 'Asignadas', valor: res.asignadas || 0, claseColor: 'bar-rojo' },
    ];
  }

  calcularAltura(valor: number): number {
    const maxValor = Math.max(...this.datosGrafica.map((d) => d.valor), 1);
    return Math.max((valor / maxValor) * 78, 6);
  }

  getTituloGrafica(): string {
    if (this.tipoReporte === 'urgencia') return 'Incidencias por urgencia';
    if (this.tipoReporte === 'tipo') return 'Incidencias por categoría';
    return 'Incidencias por estado';
  }

  async generarReporte(): Promise<void> {
    const fechaHora = new Date().toLocaleString('es-MX');
    const total = this.datosGrafica.reduce((sum, item) => sum + item.valor, 0);

    // 1. Construir CSV estructurado
    let csv = `REPORTE DE INCIDENCIAS - HELPDESK TECNICO\n`;
    csv += `Fecha de emision: ${fechaHora}\n`;
    csv += `Tecnico responsable: ${this.usuario?.nombre || 'Tecnico HelpDesk'}\n`;
    csv += `Tipo de reporte: ${this.getTituloGrafica()}\n`;
    csv += `Rango de fechas: ${this.rangoFechas === '7dias' ? 'Ultimos 7 dias' : this.rangoFechas === '30dias' ? 'Ultimos 30 dias' : 'Todo el historico'}\n\n`;

    csv += `METRICAS CLAVE\n`;
    csv += `Categoria,Cantidad,Porcentaje\n`;
    this.datosGrafica.forEach((d) => {
      const pct = total > 0 ? ((d.valor / total) * 100).toFixed(1) : '0.0';
      csv += `"${d.etiqueta}",${d.valor},${pct}%\n`;
    });
    csv += `Total,${total},100%\n\n`;

    if (this.incidencias.length > 0) {
      csv += `DETALLE DE INCIDENCIAS ENCONTRADAS\n`;
      csv += `Codigo,Titulo,Estado,Urgencia,Tipo,Fecha Creacion,Solucion\n`;
      this.incidencias.forEach((inc) => {
        csv += `"${inc.codigo || inc.id}","${(inc.titulo || '').replace(/"/g, '""')}","${inc.estado}","${inc.urgencia || 'Media'}","${inc.tipo || 'Soporte'}","${inc.created_at}","${(inc.solucion || '').replace(/"/g, '""')}"\n`;
      });
    }

    // 2. Descargar archivo en el navegador
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_helpdesk_${this.tipoReporte}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 3. Confirmación visual con Alerta
    const alerta = await this.alertController.create({
      header: 'Reporte generado con éxito',
      subHeader: this.getTituloGrafica(),
      message: `Se ha descargado el archivo CSV con ${total} incidencias contabilizadas para el periodo seleccionado.`,
      buttons: ['Aceptar'],
    });
    await alerta.present();
  }

  toggleChange(event: any): void {
    const isDark = event.detail.checked;
    this.paletteToggle = isDark;
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('darkMode', String(isDark));
  }

  async cerrarSesion(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas salir del panel de técnicos?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salir',
          role: 'destructive',
          handler: () => {
            this.incidenciasService.logout();
            this.navCtrl.navigateRoot('/login');
          },
        },
      ],
    });
    await alert.present();
  }
}
