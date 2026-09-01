import { BookingSuccessView } from './booking-success-view';

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; session_id?: string }>;
}) {
  const { ref, session_id } = await searchParams;
  return <BookingSuccessView bookingRef={ref ?? ''} sessionId={session_id ?? ''} />;
}
