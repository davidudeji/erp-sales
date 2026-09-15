import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VendorApprovalQueueComponent } from './vendor-approval-queue.component';

describe('VendorApprovalQueueComponent', () => {
  let component: VendorApprovalQueueComponent;
  let fixture: ComponentFixture<VendorApprovalQueueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VendorApprovalQueueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VendorApprovalQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
