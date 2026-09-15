import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchInventoryTableComponent } from './branch-inventory-table.component';

describe('BranchInventoryTableComponent', () => {
  let component: BranchInventoryTableComponent;
  let fixture: ComponentFixture<BranchInventoryTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchInventoryTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchInventoryTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
