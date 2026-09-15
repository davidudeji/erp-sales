import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransferWizardComponent } from './transfer-wizard.component';

describe('TransferWizardComponent', () => {
  let component: TransferWizardComponent;
  let fixture: ComponentFixture<TransferWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TransferWizardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransferWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
