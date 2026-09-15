import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateTypesComponent } from './template-types.component';

describe('TemplateTypesComponent', () => {
  let component: TemplateTypesComponent;
  let fixture: ComponentFixture<TemplateTypesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemplateTypesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateTypesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
