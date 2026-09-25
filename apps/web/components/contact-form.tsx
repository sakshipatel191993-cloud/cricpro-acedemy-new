"use client"

import { useRef, useState, type FormEvent, type ReactNode } from "react"
import { WhatsAppOptIn } from "@/components/whatsapp-opt-in"

export function ContactForm({ children, enquiryType }: { children: ReactNode; enquiryType?: "coaching" | "birthday_party" }) {
  const submitting = useRef(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const fields = new FormData(form)
    submitting.current = true
    setPending(true)
    setResult(null)
    try {
      const subject = String(fields.get("subject") || "general")
      const details = Array.from(fields.entries())
        .filter(([key, value]) => !["name", "email", "phone", "subject", "message", "whatsappConsent"].includes(key) && String(value).trim())
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: enquiryType || (subject === "coaching" ? "coaching" : subject === "birthday" ? "birthday_party" : "contact"),
          name: fields.get("name"),
          email: fields.get("email"),
          phone: fields.get("phone"),
          whatsappConsent: fields.get("whatsappConsent") === "yes",
          message: `Subject: ${enquiryType || subject}\n\n${fields.get("message") || ""}\n${details}`,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to send your enquiry. Please try again.")
      form.reset()
      setResult({ ok: true, message: data.notification?.admin === false
        ? "Your enquiry has been saved, but the email notification could not be sent. For urgent enquiries, email info@cricprocoe.com."
        : "Thank you! Your enquiry has been received. Our team will be in touch soon." })
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Unable to send your enquiry. Please email info@cricprocoe.com." })
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <form className="public-form space-y-6" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-60"><WhatsAppOptIn />{children}</fieldset>
      {pending && <p role="status" className="text-sm font-medium text-muted-foreground">Sending your enquiry…</p>}
      {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium leading-relaxed" : "rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium leading-relaxed text-destructive"}>{result.message}</p>}
    </form>
  )
}
