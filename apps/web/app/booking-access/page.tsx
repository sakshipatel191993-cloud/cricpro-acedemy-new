"use client"

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/services/supabase';

type Details = { reference: string; service: string; schedule: string; status: string; paymentStatus: string; amount: string; discount?: Array<[string,string]> };
export default function BookingAccessPage() {
  const [token,setToken] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [details,setDetails] = useState<Details | null>(null);
  const [query,setQuery] = useState('');
  const [kind,setKind] = useState('resource');
  const [email,setEmail] = useState('');
  const [reference,setReference] = useState('');
  useEffect(() => {
    const secret = window.location.hash.slice(1);
    window.history.replaceState(null,'',window.location.pathname + window.location.search);
    if (secret) setToken(secret);
    else void loadBooking().catch(() => setMessage('Please request an access link or sign in to view this booking.'));
  },[]);
  async function loadBooking() {
    const requested = new URLSearchParams(window.location.search);
    if (requested.has('id') && requested.has('kind')) {
      const params = new URLSearchParams({ id:requested.get('id')!,kind:requested.get('kind')! }).toString();
      const response = await fetch(`/api/private-booking?${params}`,{ cache:'no-store',headers:await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error('Booking unavailable');
      setQuery(params); setDetails(data); return;
    }
    const session = await fetch('/api/guest-booking',{ cache: 'no-store' });
    const scope = await session.json();
    if (!session.ok) return;
    const params = new URLSearchParams({ kind: scope.kind,id: scope.id }).toString();
    const response = await fetch(`/api/private-booking?${params}`,{ cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Booking unavailable');
    setQuery(params); setDetails(data);
  }
  async function authHeaders(): Promise<Record<string,string>> {
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization:`Bearer ${data.session.access_token}` } : {};
  }
  async function download(document: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/private-booking?${query}&document=${document}`,{ cache:'no-store',headers:await authHeaders() });
      if (!response.ok) throw new Error('Document unavailable. Please contact support.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a'); anchor.href=url; anchor.download=`booking-${document}.pdf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Download unavailable'); }
    finally { setBusy(false); }
  }
  async function act(action: string, extra: Record<string,unknown> = {}) {
    setBusy(true); setMessage('');
    try {
      const headers: Record<string,string> = { 'Content-Type':'application/json' };
      if (action === 'claim') {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('Sign in in another tab, then return here to link this booking.');
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch('/api/guest-booking',{ method:'POST',headers,body:JSON.stringify({ action,...extra }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Please try again later.');
      setMessage(result.message ?? (action === 'claim' ? 'Booking linked to your account.' : 'Done.'));
      if (action === 'exchange') { setToken(''); await loadBooking(); }
      if (action === 'logout') { setDetails(null); setQuery(''); }
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Please try again later.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-12">
    <h1 className="text-2xl font-bold">Secure booking access</h1>
    <p>View one booking and download its documents. To cancel or request a refund, contact info@cricprocoe.com.</p>
    {token ? <section className="space-y-3"><p>This private link is single-use and expires after 15 minutes. Continue only if you requested it.</p><button disabled={busy} onClick={() => void act('exchange',{ token })} className="rounded bg-primary px-5 py-3 text-primary-foreground">Continue securely</button></section> : null}
    {details ? <section className="space-y-4">
      <h2 className="font-semibold">{details.reference}</h2><p>{details.service}</p><p>{details.schedule}</p><p>Status: {details.status} · Payment: {details.paymentStatus}</p><p>£{Number(details.amount).toFixed(2)}</p>
      {details.discount?.map(([label,value]) => <p key={label}>{label}: {value}</p>)}
      {['confirmed','completed'].includes(details.status) && <p><button disabled={busy} className="underline" onClick={() => void download('confirmation')}>Download booking confirmation PDF</button></p>}
      {details.paymentStatus === 'paid' && <p><button disabled={busy} className="underline" onClick={() => void download('receipt')}>Download verified payment receipt PDF</button></p>}
      <p>Optional: sign in in another tab, then explicitly link this booking. This requires a fresh emailed access link and a verified account.</p>
      <a href="/login?from=/account" target="_blank" rel="noopener noreferrer" className="underline">Sign in (optional)</a>
      <p><button disabled={busy} onClick={() => void act('claim',{ confirm:true })} className="rounded border p-3">Link this booking to my signed-in account</button></p>
      <button disabled={busy} onClick={() => void act('logout')} className="underline">End private session</button>
    </section> : !token && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void act('request',{ email,reference,kind }); }}>
      <p>Enter the booking reference and the email used to book. No account is required.</p>
      <label className="block">Booking type<select className="block w-full rounded border p-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="resource">Lane / bowling machine / side arm</option><option value="group">Group session / masterclass</option></select></label>
      <label className="block">Booking reference<input required maxLength={80} className="block w-full rounded border p-3" value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label className="block">Booking email<input required type="email" maxLength={254} className="block w-full rounded border p-3" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button disabled={busy} className="rounded bg-primary px-5 py-3 text-primary-foreground">Email a secure access link</button>
    </form>}
    <p role="status" aria-live="polite">{busy ? 'Please wait…' : message}</p>
  </main>;
}
