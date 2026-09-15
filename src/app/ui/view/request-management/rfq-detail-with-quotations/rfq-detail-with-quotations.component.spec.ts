import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfqDetailWithQuotationsComponent } from './rfq-detail-with-quotations.component';

describe('RfqDetailWithQuotationsComponent', () => {
  let component: RfqDetailWithQuotationsComponent;
  let fixture: ComponentFixture<RfqDetailWithQuotationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RfqDetailWithQuotationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RfqDetailWithQuotationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
