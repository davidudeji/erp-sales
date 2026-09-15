import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchTransferHistoryComponent } from './branch-transfer-history.component';

describe('BranchTransferHistoryComponent', () => {
  let component: BranchTransferHistoryComponent;
  let fixture: ComponentFixture<BranchTransferHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchTransferHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchTransferHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
