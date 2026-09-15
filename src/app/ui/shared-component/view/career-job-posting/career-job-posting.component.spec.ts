import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CareerJobPostingComponent } from './career-job-posting.component';

describe('CareerJobPostingComponent', () => {
  let component: CareerJobPostingComponent;
  let fixture: ComponentFixture<CareerJobPostingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CareerJobPostingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CareerJobPostingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
