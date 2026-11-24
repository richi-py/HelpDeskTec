import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'splash-tec',
    loadComponent: () => import('./pages/splash-tec/splash-tec.page').then((m) => m.SplashTecPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./pages/registro/registro.page').then((m) => m.RegistroPage),
  },
  {
    path: 'mis-incidencias',
    loadComponent: () =>
      import('./pages/mis-incidencias/mis-incidencias.page').then((m) => m.MisIncidenciasPage),
  },
];
