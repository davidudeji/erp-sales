import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SellLikelihoodComponent } from './sell-likelihood.component';

describe('SellLikelihoodComponent', () => {
  let component: SellLikelihoodComponent;
  let fixture: ComponentFixture<SellLikelihoodComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SellLikelihoodComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SellLikelihoodComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
