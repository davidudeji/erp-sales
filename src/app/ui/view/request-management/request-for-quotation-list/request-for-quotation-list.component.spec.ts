import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestForQuotationListComponent } from './request-for-quotation-list.component';

describe('RequestForQuotationListComponent', () => {
  let component: RequestForQuotationListComponent;
  let fixture: ComponentFixture<RequestForQuotationListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestForQuotationListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestForQuotationListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
