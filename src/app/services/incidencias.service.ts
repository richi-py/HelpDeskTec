import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  EstadoIncidencia,
  Incidencia,
  Notificacion,
  ResumenDashboard,
  Usuario,
} from '../models/incidencia.model';

export interface LoginResponse {
  access_token: string;
  usuario: Usuario;
}

@Injectable({
  providedIn: 'root',
})
export class IncidenciasService {
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'helpdesk_token';
  private readonly usuarioKey = 'helpdesk_tec_usuario';

  private usuarioSubject = new BehaviorSubject<Usuario | null>(this.getUsuarioActual());
  usuarioActual$ = this.usuarioSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(this.tokenKey);
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUsuarioActual(): Usuario | null {
    const data = localStorage.getItem(this.usuarioKey);
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  limpiarCacheLocal(): void {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith('helpdesk_tec_') ||
        key.startsWith('helpdesk_ultimas_incidencias')
      ) {
        localStorage.removeItem(key);
      }
    });
  }

  login(correo: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, { correo, password })
      .pipe(
        tap((res) => {
          this.limpiarCacheLocal();
          if (res.access_token) {
            localStorage.setItem(this.tokenKey, res.access_token);
          }
          if (res.usuario) {
            localStorage.setItem(this.usuarioKey, JSON.stringify(res.usuario));
            this.usuarioSubject.next(res.usuario);
          }
        })
      );
  }

  registro(datos: {
    nombre: string;
    correo: string;
    password: string;
    rol?: string;
    area?: string;
    telefono?: string;
  }): Observable<{ ok: boolean; data: Usuario }> {
    return this.http.post<{ ok: boolean; data: Usuario }>(
      `${this.apiUrl}/auth/register`,
      {
        rol: 'tecnico',
        ...datos,
      }
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.usuarioKey);
    this.limpiarCacheLocal();
    this.usuarioSubject.next(null);
  }

  getPerfil(): Observable<Usuario> {
    return this.http
      .get<Usuario>(`${this.apiUrl}/auth/perfil`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        timeout(6000),
        tap((u) => {
          if (u) {
            localStorage.setItem(this.usuarioKey, JSON.stringify(u));
            this.usuarioSubject.next(u);
          }
        }),
        catchError(() => of(this.getUsuarioActual() as Usuario))
      );
  }

  getResumen(): Observable<ResumenDashboard> {
    return this.http
      .get<ResumenDashboard>(`${this.apiUrl}/incidencias/resumen`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        timeout(6000),
        catchError(() =>
          of({
            pendientes: 0,
            asignadas: 0,
            en_proceso: 0,
            resueltas: 0,
          })
        )
      );
  }

  getIncidencias(estado?: EstadoIncidencia): Observable<Incidencia[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }

    return this.http
      .get<Incidencia[]>(`${this.apiUrl}/incidencias`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        timeout(6000),
        catchError(() => of([]))
      );
  }

  getIncidenciaPorId(id: string): Observable<Incidencia> {
    return this.http.get<Incidencia>(`${this.apiUrl}/incidencias/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  cambiarEstado(
    id: string,
    estado: EstadoIncidencia,
    solucion?: string
  ): Observable<{ ok: boolean; incidencia?: Incidencia }> {
    return this.http.patch<{ ok: boolean; incidencia?: Incidencia }>(
      `${this.apiUrl}/incidencias/${id}/estado`,
      { estado, solucion },
      { headers: this.getAuthHeaders() }
    );
  }

  agregarComentario(id: string, mensaje: string): Observable<Incidencia> {
    return this.http.post<Incidencia>(
      `${this.apiUrl}/incidencias/${id}/comentarios`,
      { mensaje },
      { headers: this.getAuthHeaders() }
    );
  }

  subirImagen(
    id: string,
    archivo: File,
    tipo: 'reporte' | 'solucion' = 'solucion'
  ): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('imagen', archivo);
    formData.append('tipo', tipo);

    return this.http.post<{ url: string }>(
      `${this.apiUrl}/incidencias/${id}/imagenes`,
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  getNotificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/notificaciones`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Métodos de integración con Estructuras de Datos
  deshacerUltimoEstado(id: string): Observable<{ ok: boolean; estado_anterior_restaurado: string }> {
    return this.http.post<{ ok: boolean; estado_anterior_restaurado: string }>(
      `${this.apiUrl}/incidencias/${id}/deshacer`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  getColaPrioridad(): Observable<Incidencia[]> {
    return this.http.get<Incidencia[]>(`${this.apiUrl}/estructuras/cola-prioridad`, {
      headers: this.getAuthHeaders(),
    });
  }

  getMetricasEstructuras(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/estructuras/metricas`, {
      headers: this.getAuthHeaders(),
    });
  }
}
