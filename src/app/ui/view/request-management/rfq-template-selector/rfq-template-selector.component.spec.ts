import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RfqTemplateSelectorComponent } from './rfq-template-selector.component';

describe('RfqTemplateSelectorComponent', () => {
  let component: RfqTemplateSelectorComponent;
  let fixture: ComponentFixture<RfqTemplateSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RfqTemplateSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RfqTemplateSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
