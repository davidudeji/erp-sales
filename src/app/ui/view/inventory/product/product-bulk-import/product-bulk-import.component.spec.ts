import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductBulkImportComponent } from './product-bulk-import.component';

describe('ProductBulkImportComponent', () => {
  let component: ProductBulkImportComponent;
  let fixture: ComponentFixture<ProductBulkImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProductBulkImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductBulkImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
