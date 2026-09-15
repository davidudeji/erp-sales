import { TestBed } from '@angular/core/testing';

import { VendorRegistrationService } from './vendor-registration.service';

describe('VendorRegistrationService', () => {
  let service: VendorRegistrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VendorRegistrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
