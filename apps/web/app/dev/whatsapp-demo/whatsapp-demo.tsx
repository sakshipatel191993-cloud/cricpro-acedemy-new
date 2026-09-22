'use client';

import { useState } from 'react';
import { Button } from '@workspace/ui/components/button';
import type { DemoScenario } from '@/lib/services/whatsapp-demo';

export default function WhatsAppDemo() {
  const [consented, setConsented] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>('delivered');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; detail: string; message: string } | null>(null);
  const [error, setError] = useState('');

  async function simulate() {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/dev/whatsapp-demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consented, scenario }) });
      if (!response.ok) throw new Error('Simulation unavailable. Use the local development server.');
      setResult(await response.json());
    } catch (error) { setError(error instanceof Error ? error.message : 'Simulation failed'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
    <div className="rounded-lg border border-amber-500 bg-amber-50 p-4 text-amber-950">
      <p className="font-bold">SIMULATED — NOT SENT</p>
      <p className="text-sm">Local demonstration only. No WhatsApp messages, payments, emails or database records are created.</p>
    </div>
    <div><h1 className="text-3xl font-bold">WhatsApp booking demo</h1><p className="mt-2 text-muted-foreground">Try customer confirmation scenarios without a Meta account.</p></div>
    <section className="rounded-lg border p-5" aria-label="Fictional booking">
      <h2 className="mb-3 font-semibold">Fictional booking · DEMO-001</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt>Customer</dt><dd>Alex Demo</dd><dt>WhatsApp</dt><dd>+44 7700 900123 (fictional)</dd>
        <dt>Session</dt><dd>Lane hire · 3 October 2026, 10:00</dd><dt>Amount</dt><dd>£25.00 · no charge</dd>
      </dl>
    </section>
    <fieldset disabled={busy} className="space-y-5 rounded-lg border p-5">
      <legend className="px-2 font-semibold">Simulation controls</legend>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={consented} onChange={event => { setConsented(event.target.checked); setResult(null); }} />Simulate customer opting in to WhatsApp updates (unchecked by default).</label>
      <label className="block space-y-2"><span className="text-sm font-medium">Scenario</span>
        <select aria-label="Scenario" className="block w-full rounded-md border bg-background p-2" value={scenario} onChange={event => { setScenario(event.target.value as DemoScenario); setResult(null); }}>
          <option value="delivered">Paid booking → delivered</option><option value="failed">Paid booking → delivery failed</option>
          <option value="stopped">Customer replied STOP → suppressed</option><option value="unpaid">Payment pending → no confirmation</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3"><Button onClick={simulate}>{busy ? 'Simulating…' : 'Run simulation'}</Button>
        <Button variant="outline" onClick={() => { setConsented(false); setScenario('delivered'); setResult(null); setError(''); }}>Reset demo</Button></div>
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <section aria-live="polite" aria-atomic="true">
      {result && <div className="space-y-3 rounded-lg border p-5"><h2 className="font-semibold">Simulated result: {result.status}</h2><p>{result.detail}</p>
        {result.status !== 'skipped' && <div className="rounded-lg bg-emerald-50 p-4 text-emerald-950"><p className="mb-2 text-xs font-bold">MESSAGE PREVIEW — NOT SENT</p><p>{result.message}</p></div>}
      </div>}
    </section>
    <p className="text-sm text-muted-foreground">This checks the message transport using a mock provider. It does not verify real Meta delivery or run an actual checkout. Production WhatsApp remains disabled.</p>
  </main>;
}
