import { TestBed } from '@angular/core/testing';

import { RandomTokenService } from './random-token.service';

describe('RandomTokenService', () => {
  let service: RandomTokenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RandomTokenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
