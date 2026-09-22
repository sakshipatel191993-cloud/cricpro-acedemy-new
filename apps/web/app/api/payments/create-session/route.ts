import { NextResponse } from 'next/server';

// Retired: a booking ID is not proof of ownership. The booking creation routes
// already return checkout URLs; there are no application callers of this route.
// Reopening payments requires verified ownership or a scoped guest capability.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Payment restart is unavailable. Please contact us for help with an existing booking.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
