import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { VendorManagementService } from './vendor-management.service';

describe('VendorManagementService', () => {
  let service: VendorManagementService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(VendorManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should provide fallback dashboard widgets when API data is unavailable', (done) => {
    service.getDashboardStats().subscribe(stats => {
      expect(stats.recentActivity.length).toBeGreaterThan(0);
      expect(stats.expiringDocumentsList.length).toBeGreaterThan(0);
      expect(stats.topPerformers.length).toBeGreaterThan(0);
      done();
    });
  });
});
