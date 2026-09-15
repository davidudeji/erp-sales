import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesHubComponent } from './sales-hub.component';

describe('SalesHubComponent', () => {
  let component: SalesHubComponent;
  let fixture: ComponentFixture<SalesHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SalesHubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
