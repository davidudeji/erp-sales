import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockMovementDetailComponent } from './stock-movement-detail.component';

describe('StockMovementDetailComponent', () => {
  let component: StockMovementDetailComponent;
  let fixture: ComponentFixture<StockMovementDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StockMovementDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockMovementDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
