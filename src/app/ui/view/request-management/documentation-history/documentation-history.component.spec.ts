import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentationHistoryComponent } from './documentation-history.component';

describe('DocumentationHistoryComponent', () => {
  let component: DocumentationHistoryComponent;
  let fixture: ComponentFixture<DocumentationHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentationHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentationHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
