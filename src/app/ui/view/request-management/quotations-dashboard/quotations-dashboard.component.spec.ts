import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuotationsDashboardComponent } from './quotations-dashboard.component';

describe('QuotationsDashboardComponent', () => {
  let component: QuotationsDashboardComponent;
  let fixture: ComponentFixture<QuotationsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QuotationsDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuotationsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
