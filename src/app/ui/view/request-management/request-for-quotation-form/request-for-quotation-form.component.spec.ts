import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestForQuotationFormComponent } from './request-for-quotation-form.component';

describe('RequestForQuotationFormComponent', () => {
  let component: RequestForQuotationFormComponent;
  let fixture: ComponentFixture<RequestForQuotationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestForQuotationFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestForQuotationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
