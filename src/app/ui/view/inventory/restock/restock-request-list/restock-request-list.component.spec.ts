import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestockRequestListComponent } from './restock-request-list.component';

describe('RestockRequestListComponent', () => {
  let component: RestockRequestListComponent;
  let fixture: ComponentFixture<RestockRequestListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RestockRequestListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestockRequestListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
