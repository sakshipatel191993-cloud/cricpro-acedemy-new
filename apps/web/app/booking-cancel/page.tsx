import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';

export default async function BookingCancelPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const returnPath = service === 'masterclass' ? '/masterclass' : service === 'group_session' ? '/group-sessions' : '/lane-hire';
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-4">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-6">
          Your booking has not been confirmed. No payment was taken.
          Your slot has been held for a short time — try again or choose a different time.
        </p>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href={returnPath}>Try Again</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
