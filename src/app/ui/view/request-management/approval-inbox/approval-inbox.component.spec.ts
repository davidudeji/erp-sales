import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalInboxComponent } from './approval-inbox.component';

describe('ApprovalInboxComponent', () => {
  let component: ApprovalInboxComponent;
  let fixture: ComponentFixture<ApprovalInboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApprovalInboxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovalInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
