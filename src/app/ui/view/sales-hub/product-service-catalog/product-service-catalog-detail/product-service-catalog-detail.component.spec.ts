import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductServiceCatalogDetailComponent } from './product-service-catalog-detail.component';

describe('ProductServiceCatalogDetailComponent', () => {
  let component: ProductServiceCatalogDetailComponent;
  let fixture: ComponentFixture<ProductServiceCatalogDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductServiceCatalogDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductServiceCatalogDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
