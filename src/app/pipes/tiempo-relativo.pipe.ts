import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte una fecha ISO (UTC) en tiempo relativo legible (ej. "Hace 2 h").
 */
@Pipe({
  name: 'tiempoRelativo',
  standalone: true,
})
export class TiempoRelativoPipe implements PipeTransform {
  transform(fecha: string | Date | null | undefined): string {
    if (!fecha) {
      return '';
    }

    const timestamp = new Date(fecha).getTime();
    if (Number.isNaN(timestamp)) {
      return '';
    }

    const diffMs = Math.max(0, Date.now() - timestamp);
    const minutos = Math.floor(diffMs / 60000);

    if (minutos < 1) {
      return 'Hace un momento';
    }
    if (minutos < 60) {
      return `Hace ${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    if (horas < 24) {
      return `Hace ${horas} h`;
    }

    const dias = Math.floor(horas / 24);
    return dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
  }
}
