import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LpoComponent } from './lpo.component';

describe('LpoComponent', () => {
  let component: LpoComponent;
  let fixture: ComponentFixture<LpoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LpoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LpoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
