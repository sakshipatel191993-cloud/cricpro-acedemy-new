// Use Auth's server-controlled confirmation timestamp, never user_metadata.
export function isConfirmedCustomer(user: { email_confirmed_at?: string | null; is_anonymous?: boolean } | null | undefined): boolean {
  return !!user?.email_confirmed_at && !user.is_anonymous;
}
