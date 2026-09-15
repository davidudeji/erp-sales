import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobApplicationFormKeepComponent } from './job-application-form-keep.component';

describe('JobApplicationFormKeepComponent', () => {
  let component: JobApplicationFormKeepComponent;
  let fixture: ComponentFixture<JobApplicationFormKeepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobApplicationFormKeepComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(JobApplicationFormKeepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
