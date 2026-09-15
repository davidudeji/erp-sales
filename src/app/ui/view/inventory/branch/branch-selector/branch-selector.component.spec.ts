import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BranchSelectorComponent } from './branch-selector.component';

describe('BranchSelectorComponent', () => {
  let component: BranchSelectorComponent;
  let fixture: ComponentFixture<BranchSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BranchSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BranchSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
