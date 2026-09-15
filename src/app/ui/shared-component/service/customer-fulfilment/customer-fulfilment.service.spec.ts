import { TestBed } from '@angular/core/testing';

import { CustomerFulfilmentService } from './customer-fulfilment.service';

describe('CustomerFulfilmentService', () => {
  let service: CustomerFulfilmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomerFulfilmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
