import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagedInventoryTableComponent } from './managed-inventory-table.component';

describe('ManagedInventoryTableComponent', () => {
  let component: ManagedInventoryTableComponent;
  let fixture: ComponentFixture<ManagedInventoryTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ManagedInventoryTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ManagedInventoryTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
