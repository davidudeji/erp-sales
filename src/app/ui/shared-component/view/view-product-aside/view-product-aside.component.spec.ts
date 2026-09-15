import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewProductAsideComponent } from './view-product-aside.component';

describe('ViewProductAsideComponent', () => {
  let component: ViewProductAsideComponent;
  let fixture: ComponentFixture<ViewProductAsideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewProductAsideComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ViewProductAsideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
