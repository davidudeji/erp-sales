import { TestBed } from '@angular/core/testing';

import { NavigationLinksService } from './navigation-links.service';

describe('NavigationLinksService', () => {
  let service: NavigationLinksService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NavigationLinksService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
