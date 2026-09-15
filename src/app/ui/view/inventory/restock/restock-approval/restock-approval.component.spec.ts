import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestockApprovalComponent } from './restock-approval.component';

describe('RestockApprovalComponent', () => {
  let component: RestockApprovalComponent;
  let fixture: ComponentFixture<RestockApprovalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RestockApprovalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestockApprovalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
