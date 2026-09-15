import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestockRequestFormComponent } from './restock-request-form.component';

describe('RestockRequestFormComponent', () => {
  let component: RestockRequestFormComponent;
  let fixture: ComponentFixture<RestockRequestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RestockRequestFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestockRequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
