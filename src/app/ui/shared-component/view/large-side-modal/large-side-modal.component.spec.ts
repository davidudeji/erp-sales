import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LargeSideModalComponent } from './large-side-modal.component';

describe('LargeSideModalComponent', () => {
  let component: LargeSideModalComponent;
  let fixture: ComponentFixture<LargeSideModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LargeSideModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LargeSideModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
