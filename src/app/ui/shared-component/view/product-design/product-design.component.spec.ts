import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDesignComponent } from './product-design.component';

describe('ProductDesignComponent', () => {
  let component: ProductDesignComponent;
  let fixture: ComponentFixture<ProductDesignComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProductDesignComponent]
    });
    fixture = TestBed.createComponent(ProductDesignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
