import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestForQuotationServiceFormComponent } from './request-for-quotation-service-form.component';

describe('RequestForQuotationServiceFormComponent', () => {
  let component: RequestForQuotationServiceFormComponent;
  let fixture: ComponentFixture<RequestForQuotationServiceFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestForQuotationServiceFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestForQuotationServiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
