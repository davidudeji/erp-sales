import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThresholdManagementComponent } from './threshold-management.component';

describe('ThresholdManagementComponent', () => {
  let component: ThresholdManagementComponent;
  let fixture: ComponentFixture<ThresholdManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ThresholdManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThresholdManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
