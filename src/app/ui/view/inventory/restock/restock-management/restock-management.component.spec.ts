import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestockManagementComponent } from './restock-management.component';

describe('RestockManagementComponent', () => {
  let component: RestockManagementComponent;
  let fixture: ComponentFixture<RestockManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RestockManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestockManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
