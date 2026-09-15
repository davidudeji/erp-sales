import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchInventoryFormComponent } from './branch-inventory-form.component';

describe('BranchInventoryFormComponent', () => {
  let component: BranchInventoryFormComponent;
  let fixture: ComponentFixture<BranchInventoryFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchInventoryFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchInventoryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
