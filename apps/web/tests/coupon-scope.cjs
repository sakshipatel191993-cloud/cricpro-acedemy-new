const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');

test('coupon UI is limited to ordinary lane hire', () => {
  const review = fs.readFileSync(path.join(root, 'apps/web/app/booking-confirm/page.tsx'), 'utf8');
  const sessions = fs.readFileSync(path.join(root, 'apps/web/components/sessions-page.tsx'), 'utf8');
  assert.match(review, /booking\.serviceType === 'lane_hire'.*<CouponField/);
  assert.doesNotMatch(sessions, /CouponField|couponCode|couponVersion|couponSubtotal/);
});

test('group and masterclass APIs reject coupon payloads', () => {
  const route = fs.readFileSync(path.join(root, 'apps/web/app/api/group-session-bookings/route.ts'), 'utf8');
  assert.match(route, /\['couponCode', 'couponVersion', 'couponSubtotal'\]/);
  assert.match(route, /Coupons are available for single lane hire only/);
  assert.doesNotMatch(route, /reserve_group_with_coupon|couponRequest/);
});
