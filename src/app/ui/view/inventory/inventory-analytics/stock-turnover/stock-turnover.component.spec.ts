import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockTurnoverComponent } from './stock-turnover.component';

describe('StockTurnoverComponent', () => {
  let component: StockTurnoverComponent;
  let fixture: ComponentFixture<StockTurnoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StockTurnoverComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockTurnoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
