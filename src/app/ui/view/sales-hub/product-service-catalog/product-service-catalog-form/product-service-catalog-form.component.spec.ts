import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductServiceCatalogFormComponent } from './product-service-catalog-form.component';

describe('ProductServiceCatalogFormComponent', () => {
  let component: ProductServiceCatalogFormComponent;
  let fixture: ComponentFixture<ProductServiceCatalogFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductServiceCatalogFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductServiceCatalogFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
