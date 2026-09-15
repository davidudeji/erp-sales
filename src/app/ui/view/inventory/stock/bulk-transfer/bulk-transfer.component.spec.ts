import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkTransferComponent } from './bulk-transfer.component';

describe('BulkTransferComponent', () => {
  let component: BulkTransferComponent;
  let fixture: ComponentFixture<BulkTransferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BulkTransferComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkTransferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
