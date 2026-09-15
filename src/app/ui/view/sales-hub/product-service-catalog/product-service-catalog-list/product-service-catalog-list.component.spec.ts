import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductServiceCatalogComponent } from './product-service-catalog-list.component';

describe('ProductServiceCatalogComponent', () => {
  let component: ProductServiceCatalogComponent;
  let fixture: ComponentFixture<ProductServiceCatalogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductServiceCatalogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductServiceCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
