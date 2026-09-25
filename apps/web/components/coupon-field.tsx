"use client"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { CouponSelection } from "@/lib/coupons"

export function CouponField({
  quoteId,
  email,
  value,
  onChange,
  onBusyChange,
  disabled = false,
}: {
  quoteId?: string
  email?: string
  value: CouponSelection | null
  onChange: (value: CouponSelection | null) => void
  onBusyChange?: (busy: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const sequence = useRef(0)
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    void fetch("/api/coupons/preview", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (active) setEnabled(data.enabled === true)
      })
      .catch(() => {})
    return () => {
      active = false
      sequence.current++
    }
  }, [])
  async function apply() {
    const current = ++sequence.current
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    onChange(null)
    try {
      const response = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, quoteId, email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Coupon unavailable")
      if (sequence.current === current) onChange(data.coupon)
    } catch (error) {
      if (sequence.current === current)
        setError(error instanceof Error ? error.message : "Coupon unavailable")
    } finally {
      if (sequence.current === current) {
        setBusy(false)
        onBusyChange?.(false)
      }
    }
  }
  if (!enabled || !quoteId) return null
  return (
    <fieldset
      className="space-y-2 rounded-lg border p-4"
      disabled={disabled || busy}
    >
      <Label htmlFor={id}>Coupon code (optional)</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          maxLength={32}
          autoComplete="off"
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            onChange(null)
            setError("")
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!code.trim() || !email || !quoteId}
          onClick={() => void apply()}
        >
          {busy ? "Checking…" : "Apply"}
        </Button>
      </div>
      {value ? (
        <div role="status" className="text-sm">
          <p>
            {value.code}: you save £
            {(value.discountMinor / 100).toFixed(2)}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCode("")
              onChange(null)
            }}
          >
            Remove coupon
          </Button>
        </div>
      ) : null}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
