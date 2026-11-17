import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MisIncidenciasPage } from './mis-incidencias.page';

describe('MisIncidenciasPage', () => {
  let component: MisIncidenciasPage;
  let fixture: ComponentFixture<MisIncidenciasPage>;

  beforeEach(async () => {
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = () => {};
    }

    await TestBed.configureTestingModule({
      imports: [MisIncidenciasPage],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MisIncidenciasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
