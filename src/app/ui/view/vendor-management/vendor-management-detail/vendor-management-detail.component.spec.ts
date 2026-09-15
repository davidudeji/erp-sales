import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorManagementDetailComponent } from './vendor-management-detail.component';

describe('VendorManagementDetailComponent', () => {
  let component: VendorManagementDetailComponent;
  let fixture: ComponentFixture<VendorManagementDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VendorManagementDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorManagementDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
