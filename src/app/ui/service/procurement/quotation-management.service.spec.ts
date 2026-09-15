import { TestBed } from '@angular/core/testing';

import { QuotationManagementService } from './quotation-management.service';

describe('QuotationManagementService', () => {
  let service: QuotationManagementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuotationManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
