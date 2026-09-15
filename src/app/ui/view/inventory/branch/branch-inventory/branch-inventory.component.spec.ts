import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchInventoryComponent } from './branch-inventory.component';

describe('BranchInventoryComponent', () => {
  let component: BranchInventoryComponent;
  let fixture: ComponentFixture<BranchInventoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchInventoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
