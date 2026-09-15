import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovementApprovalComponent } from './movement-approval.component';

describe('MovementApprovalComponent', () => {
  let component: MovementApprovalComponent;
  let fixture: ComponentFixture<MovementApprovalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MovementApprovalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovementApprovalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
