"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/services/supabase"
import { safeReturnPath } from "@/lib/security/return-path"

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = safeReturnPath(searchParams.get("from"))

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  function update(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formData.password !== formData.confirm) {
      setError("Passwords do not match.")
      return
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    setLoading(true)
    setError("")

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // If session exists immediately (email confirmation disabled), redirect
    if (data.session) {
      router.push(from)
      router.refresh()
      return
    }

    // Otherwise show "check your email" message
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
          <p className="mb-6 text-muted-foreground">
            We've sent a confirmation link to <strong>{formData.email}</strong>.
            Click the link to activate your account.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Back to Login</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="mt-1 text-muted-foreground">
            Book faster, track your sessions
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign Up</CardTitle>
            <CardDescription>All fields marked * are required</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Smith"
                  value={formData.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="07xxx xxx xxx"
                  value={formData.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={formData.confirm}
                    onChange={(e) => update("confirm", e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/login?from=${encodeURIComponent(from)}`}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
