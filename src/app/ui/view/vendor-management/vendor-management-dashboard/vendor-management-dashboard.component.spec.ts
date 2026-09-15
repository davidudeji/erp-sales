import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorManagementDashboardComponent } from './vendor-management-dashboard.component';

describe('VendorManagementDashboardComponent', () => {
  let component: VendorManagementDashboardComponent;
  let fixture: ComponentFixture<VendorManagementDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VendorManagementDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorManagementDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
