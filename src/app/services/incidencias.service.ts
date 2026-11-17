import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(this.tokenKey);
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  login(correo: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, { correo, password })
      .pipe(
        tap((res) => {
          if (res.access_token) {
            localStorage.setItem(this.tokenKey, res.access_token);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/auth/perfil`, {
      headers: this.getAuthHeaders(),
    });
  }

  getResumen(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(`${this.apiUrl}/incidencias/resumen`, {
      headers: this.getAuthHeaders(),
    });
  }

  getIncidencias(estado?: EstadoIncidencia): Observable<Incidencia[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }

    return this.http.get<Incidencia[]>(`${this.apiUrl}/incidencias`, {
      headers: this.getAuthHeaders(),
      params,
    });
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
}
