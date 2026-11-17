import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SplashTecPage } from './splash-tec.page';

describe('SplashTecPage', () => {
  let component: SplashTecPage;
  let fixture: ComponentFixture<SplashTecPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SplashTecPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
