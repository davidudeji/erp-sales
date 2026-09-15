import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountPayabaleManagementComponent } from './account-payabale-management.component';

describe('AccountPayabaleManagementComponent', () => {
  let component: AccountPayabaleManagementComponent;
  let fixture: ComponentFixture<AccountPayabaleManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AccountPayabaleManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AccountPayabaleManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
