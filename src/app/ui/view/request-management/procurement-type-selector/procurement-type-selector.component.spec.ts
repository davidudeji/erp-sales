import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcurementTypeSelectorComponent } from './procurement-type-selector.component';

describe('ProcurementTypeSelectorComponent', () => {
  let component: ProcurementTypeSelectorComponent;
  let fixture: ComponentFixture<ProcurementTypeSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProcurementTypeSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProcurementTypeSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
