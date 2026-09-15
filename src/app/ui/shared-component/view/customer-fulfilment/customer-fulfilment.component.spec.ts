import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerFulfilmentComponent } from './customer-fulfilment.component';

describe('CustomerFulfilmentComponent', () => {
  let component: CustomerFulfilmentComponent;
  let fixture: ComponentFixture<CustomerFulfilmentComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CustomerFulfilmentComponent]
    });
    fixture = TestBed.createComponent(CustomerFulfilmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
