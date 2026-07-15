import { scanUrl } from './index';

test('should find a11y errors on empty page', async () => {
  const results = await scanUrl('https://example.com');
  expect(results).toBeDefined();
  expect(results.violations).toBeDefined();
}, 60000);
