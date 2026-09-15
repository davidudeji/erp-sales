import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductManagementFormComponent } from './product-management-form.component';

describe('ProductManagementFormComponent', () => {
  let component: ProductManagementFormComponent;
  let fixture: ComponentFixture<ProductManagementFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductManagementFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductManagementFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
