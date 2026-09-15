import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchManagerDashboardComponent } from './branch-manager-dashboard.component';

describe('BranchManagerDashboardComponent', () => {
  let component: BranchManagerDashboardComponent;
  let fixture: ComponentFixture<BranchManagerDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchManagerDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchManagerDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
