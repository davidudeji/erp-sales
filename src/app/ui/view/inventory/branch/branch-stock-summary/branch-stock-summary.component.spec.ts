import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchStockSummaryComponent } from './branch-stock-summary.component';

describe('BranchStockSummaryComponent', () => {
  let component: BranchStockSummaryComponent;
  let fixture: ComponentFixture<BranchStockSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchStockSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchStockSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
