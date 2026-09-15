import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigureTaxPopupComponent } from './configure-tax-popup.component';

describe('ConfigureTaxPopupComponent', () => {
  let component: ConfigureTaxPopupComponent;
  let fixture: ComponentFixture<ConfigureTaxPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfigureTaxPopupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ConfigureTaxPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
