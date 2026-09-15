import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AffordabilityDashboardComponent } from './affordability-dashboard.component';

describe('AffordabilityDashboardComponent', () => {
  let component: AffordabilityDashboardComponent;
  let fixture: ComponentFixture<AffordabilityDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AffordabilityDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AffordabilityDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
