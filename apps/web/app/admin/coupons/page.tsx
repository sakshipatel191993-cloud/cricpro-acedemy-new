"use client"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type Coupon = {
  id: string
  code: string
  percent_off: number
  max_uses: number
  starts_at: string
  expires_at: string
  status: string
  version: number
  reserved: number
  redeemed: number
}
type Draft = {
  code: string
  percent_off: string
  max_uses: string
  start_date: string
  end_date: string
  status: string
}
const ukDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
function fresh(code = "", percent = "15"): Draft {
  const start = ukDate(new Date()),
    end = new Date(`${start}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 30)
  return {
    code,
    percent_off: percent,
    max_uses: "50",
    start_date: start,
    end_date: ukDate(end),
    status: "draft",
  }
}
export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("")
  const [enabled, setEnabled] = useState(false),
    [archived, setArchived] = useState(false)
  const [removing, setRemoving] = useState<Coupon | null>(null)
  async function load() {
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/admin/coupons", { cache: "no-store" })
      const data = await r.json()
      if (!r.ok) throw Error(data.error)
      setCoupons(data.coupons)
      setEnabled(data.enabled)
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load coupons")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  function edit(coupon?: Coupon, preset?: string) {
    setError("")
    setNotice("")
    setEditing(coupon ?? null)
    setDraft(
      coupon
        ? {
            code: coupon.code,
            percent_off: String(coupon.percent_off),
            max_uses: String(coupon.max_uses),
            start_date: ukDate(coupon.starts_at),
            end_date: ukDate(coupon.expires_at),
            status: coupon.status,
          }
        : fresh(preset, preset === "COACH20" ? "20" : "15")
    )
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft || busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/admin/coupons", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          ...(editing ? { id: editing.id, version: editing.version } : {}),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw Error(data.error)
      setDraft(null)
      setNotice(
        "Coupon saved. Existing checkouts keep their original discount."
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save coupon")
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!removing || busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: removing.id, version: removing.version }),
      })
      const data = await r.json()
      if (!r.ok) throw Error(data.error)
      setRemoving(null)
      setNotice(
        "Coupon removed from new checkouts. Payment history is preserved."
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove coupon")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="mt-2 text-muted-foreground">
            Manage percentage discounts for every paid booking type.
          </p>
        </div>
        <Button onClick={() => edit()} disabled={busy}>
          Add coupon
        </Button>
      </div>
      {!enabled && (
        <p className="rounded-lg border p-4 text-sm">
          Checkout coupons are switched off. You can prepare coupons here;
          activation requires the coupon configuration and migration.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        One successful use per customer across all codes, tracked by booking
        email and signed-in account where available. No stacking or minimum
        spend, except Stripe’s £0.30 payment minimum. Paid uses are not
        automatically restored after refunds.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}{" "}
          <Button variant="ghost" onClick={() => void load()}>
            Refresh
          </Button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {draft && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? `Edit ${editing.code}` : "Add coupon"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coupon-code">Code</Label>
                  <Input
                    id="coupon-code"
                    required
                    disabled={!!editing}
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
                    value={draft.code}
                    onChange={(e) =>
                      setDraft({ ...draft, code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-percent">Discount (%)</Label>
                  <Input
                    id="coupon-percent"
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={draft.percent_off}
                    onChange={(e) =>
                      setDraft({ ...draft, percent_off: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-cap">Maximum uses</Label>
                  <Input
                    id="coupon-cap"
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={draft.max_uses}
                    onChange={(e) =>
                      setDraft({ ...draft, max_uses: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-status">Status</Label>
                  <select
                    id="coupon-status"
                    className="w-full rounded-md border bg-background p-2"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-start">
                    Starts at midnight (UK date)
                  </Label>
                  <Input
                    id="coupon-start"
                    type="date"
                    required
                    value={draft.start_date}
                    onChange={(e) =>
                      setDraft({ ...draft, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coupon-end">
                    Expires at midnight (UK date, exclusive)
                  </Label>
                  <Input
                    id="coupon-end"
                    type="date"
                    required
                    value={draft.end_date}
                    onChange={(e) =>
                      setDraft({ ...draft, end_date: e.target.value })
                    }
                  />
                </div>
              </fieldset>
              <p className="text-xs text-muted-foreground">
                The code is valid before the expiry date begins. Codes cannot be
                renamed or reused after removal. Existing payment attempts
                retain their discount.
              </p>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save coupon"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {removing && (
        <section
          role="alertdialog"
          aria-labelledby="remove-title"
          aria-describedby="remove-note"
          className="space-y-3 rounded-lg border p-5"
        >
          <h2 id="remove-title" className="font-semibold">
            Remove {removing.code}?
          </h2>
          <p id="remove-note">
            This archives the code. New checkouts cannot use it; already-started
            payments and past redemptions are preserved.
          </p>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void remove()}
          >
            Confirm removal
          </Button>{" "}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Keep coupon
          </Button>
        </section>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        Show removed coupons
      </label>
      {loading ? (
        <p role="status">Loading coupons…</p>
      ) : !loaded ? (
        <p>
          The coupon list could not be loaded. Check the connection and refresh.
        </p>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 py-8">
            <p>
              No coupons yet. Start with the agreed campaign or create your own.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => edit(undefined, "COACH15")}
              >
                Prepare COACH15
              </Button>
              <Button
                variant="outline"
                onClick={() => edit(undefined, "COACH20")}
              >
                Prepare COACH20
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons
            .filter((c) => archived || c.status !== "archived")
            .map((c) => (
              <article
                key={c.id}
                className="flex flex-wrap justify-between gap-4 rounded-lg border p-4"
              >
                <div>
                  <h2 className="font-semibold">
                    {c.code}{" "}
                    <span className="text-primary">{c.percent_off}% off</span>
                  </h2>
                  <p className="text-sm">
                    {c.status} · {ukDate(c.starts_at)} to {ukDate(c.expires_at)}{" "}
                    (UK)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.redeemed} redeemed · {c.reserved} pending · {c.max_uses}{" "}
                    maximum
                  </p>
                </div>
                {c.status !== "archived" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => edit(c)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRemoving(c)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </article>
            ))}
        </div>
      )}
    </div>
  )
}
