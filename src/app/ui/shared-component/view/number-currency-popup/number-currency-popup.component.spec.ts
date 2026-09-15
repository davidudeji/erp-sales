import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberCurrencyPopupComponent } from './number-currency-popup.component';

describe('NumberCurrencyPopupComponent', () => {
  let component: NumberCurrencyPopupComponent;
  let fixture: ComponentFixture<NumberCurrencyPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NumberCurrencyPopupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NumberCurrencyPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
