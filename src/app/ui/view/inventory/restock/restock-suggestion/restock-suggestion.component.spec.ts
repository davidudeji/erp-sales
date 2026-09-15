import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestockSuggestionComponent } from './restock-suggestion.component';

describe('RestockSuggestionComponent', () => {
  let component: RestockSuggestionComponent;
  let fixture: ComponentFixture<RestockSuggestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RestockSuggestionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestockSuggestionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
