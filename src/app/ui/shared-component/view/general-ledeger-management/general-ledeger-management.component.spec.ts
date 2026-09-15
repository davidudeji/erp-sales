import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralLedegerManagementComponent } from './general-ledeger-management.component';

describe('GeneralLedegerManagementComponent', () => {
  let component: GeneralLedegerManagementComponent;
  let fixture: ComponentFixture<GeneralLedegerManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GeneralLedegerManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GeneralLedegerManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
