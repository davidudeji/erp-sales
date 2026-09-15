import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductManagementDetailComponent } from './product-management-detail.component';

describe('ProductManagementDetailComponent', () => {
  let component: ProductManagementDetailComponent;
  let fixture: ComponentFixture<ProductManagementDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductManagementDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductManagementDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
