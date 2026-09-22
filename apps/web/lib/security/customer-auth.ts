import { supabaseAdmin, isSupabaseConfigured } from "@/lib/services/supabase"

// Validate with Auth, never trust client-supplied IDs, emails or decoded JWTs.
export async function getVerifiedCustomerId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization")
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!token || !isSupabaseConfigured) return null
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    return error || !data.user || data.user.is_anonymous ? null : data.user.id
  } catch {
    return null
  }
}
