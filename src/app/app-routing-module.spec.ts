import { routes } from './app-routing-module';

describe('app routing', () => {
  it('should register the onboarding route before the generic vendor uuid route', () => {
    const onboardingIndex = routes.findIndex(route => route.path === 'commerce/manage-vendors/onboarding');
    const vendorUuidIndex = routes.findIndex(route => route.path === 'commerce/manage-vendors/:uuid');

    expect(onboardingIndex).toBeGreaterThan(-1);
    expect(vendorUuidIndex).toBeGreaterThan(-1);
    expect(onboardingIndex).toBeLessThan(vendorUuidIndex);
  });
});
