import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorManagementListComponent } from './vendor-management-list.component';

describe('VendorManagementListComponent', () => {
  let component: VendorManagementListComponent;
  let fixture: ComponentFixture<VendorManagementListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VendorManagementListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorManagementListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
