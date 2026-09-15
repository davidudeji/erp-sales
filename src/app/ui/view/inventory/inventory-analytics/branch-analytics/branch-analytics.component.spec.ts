import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchAnalyticsComponent } from './branch-analytics.component';

describe('BranchAnalyticsComponent', () => {
  let component: BranchAnalyticsComponent;
  let fixture: ComponentFixture<BranchAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchAnalyticsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
