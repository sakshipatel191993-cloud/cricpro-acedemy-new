# CricPro Academy Backend PRD

## Next.js + Supabase Backend Architecture

**Project:** CricPro Academy Backend Platform
**Frontend Stack:** Next.js App Router
**Backend Stack:** Next.js API Routes + Supabase
**Last Updated:** 2026-09-22

## September checkout requirements addendum

Implementation update: [admin-managed coupons](docs/features/admin-coupons.md) is now implemented locally with private tables/RPCs, transactional redemption reservations, admin CRUD/archive and immutable net-price checkout snapshots. This supersedes the historical manual-Stripe-promotion proposal below. No production migration, deployment or live activation has occurred.

Follow-on planning: [phase-two security and pricing plan](docs/security/phase-two-implementation-plan.md) defines distributed limiter failure behaviour, scoped guest grants/ownership, timezone-aware shared quoting, checkout-attempt recovery and acceptance tests. It is a design proposal, not a migration or implementation approval.

Status: planned, not implemented. This addendum supersedes conflicting legacy payment/auth requirements below.

- Implement COACH15 (15%) and COACH20 (20%) under the approved initial policy: all paid booking types (lane hire, sidearm, bowling machine, group sessions and masterclasses, plus coaching/parties when payable), including paid booking add-ons; 30 days from launch, 50 successful uses per code, one per customer across both codes and all booking types, no stacking/minimum spend and guest eligibility. Enquiry-only services have no payment to discount; do not create new payment flows merely to apply this policy.
- Enforce shared campaign/customer redemption limits and per-code caps atomically, with pending-attempt reservations, verified settlement and safe release. Email-based guest limits are not identity proof. Use server-validated code input and an explicitly attached Stripe promotion. Set exact launch/expiry timestamps and confirm refund eligibility restoration before activation.
- Keep guest checkout. Derive signed-in ownership from a server-verified Supabase identity, never a browser-supplied user ID or email filter.
- Preserve immutable gross quote values and record discount and net-paid minor-unit amounts separately for both `bookings` and `group_session_bookings`.
- Fulfil only after verifying Stripe payment status, currency, original quote/subtotal, permitted discount, final total, mode and exact booking/Checkout Session linkage. Share this verifier between webhook and success-page fallback.
- Use idempotent checkout attempts and atomic paid transitions. Retried/expired checkouts and duplicate webhooks must not double-charge, confirm twice, increment redemption twice or release a paid place.
- Implement scoped owner access and expiring guest capabilities for private booking operations; forbid public booking/enquiry lists and ID-only cancellation.
- A cancellation must not be labelled refunded until an actual Stripe refund is confirmed.
- Use server-owned booking drafts with bounded expiry, minimal personal data and safe same-origin sign-in return URLs. Preserve guest fallback when sign-in is abandoned.
- Reconcile the existing `bookings.user_id` reference to `public.users` with authenticated identities before attaching ownership. Group bookings require a reviewed equivalent ownership model.
- RLS currently denies direct normal-client table access; do not disable RLS to make account history work. Add narrowly scoped ownership policies or a server-authorized history API.
- No new migrations, coupons, credentials or production changes are authorized by this planning document.

See [implementation plan](docs/features/checkout-implementation-plan.md), [coupon specification](docs/features/checkout-coupons.md) and [optional sign-in specification](docs/features/optional-checkout-sign-in.md).

---

# Vision

Build a production-grade backend system for CricPro Academy that supports:

- Real-time booking management
- Atomic slot reservation
- Mobile-first performance
- Admin operations dashboard
- Stripe payment integration
- Email notification workflows
- Future multi-location scalability

The backend must prioritize:

- reliability
- booking consistency
- low latency
- operational simplicity
- scalability

---

# 🚨 CRITICAL REQUIREMENT: Prevent Double Booking

This is the most important backend requirement.

The same court/lane/resource must NEVER be booked twice for overlapping times.

This MUST be enforced at:

- database level
- transaction level
- not only frontend validation

The system must remain safe under:

- concurrent requests
- payment retries
- network delays
- multiple device access

---

# Tech Stack

| Layer             | Technology         |
| ----------------- | ------------------ |
| Backend Framework | Next.js App Router |
| API Layer         | Route Handlers     |
| Database          | Supabase Postgres  |
| ORM               | Drizzle ORM        |
| Authentication    | Supabase Auth      |
| Validation        | Zod                |
| Payments          | Stripe             |
| Emails            | Resend             |
| File Storage      | Supabase Storage   |
| Realtime          | Supabase Realtime  |
| Caching           | Redis / Upstash    |
| Monitoring        | Sentry             |
| Deployment        | Vercel             |

---

# Backend Architecture

```
Client (Frontend)
       ↓
Next.js Route Handlers
       ↓
Service Layer
       ↓
Drizzle ORM
       ↓
Supabase PostgreSQL
```

---

# Environment Variables

```env
# DATABASE
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AUTH
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# PAYMENTS
PAYMENTS_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# EMAIL
RESEND_API_KEY=
EMAIL_FROM=

# APP
NEXT_PUBLIC_APP_URL=

# REDIS
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# MONITORING
SENTRY_DSN=
```

---

# Payment Toggle System

Payments must be fully toggleable from environment variables.

## Disabled Mode

```env
PAYMENTS_ENABLED=false
```

Behavior:

- skip Stripe
- instantly confirm booking
- send booking confirmation email

## Enabled Mode

```env
PAYMENTS_ENABLED=true
```

Behavior:

- create Stripe checkout session
- hold slot temporarily
- confirm booking after successful webhook

This allows development/testing without payment dependency.

---

# Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── availability/
│   │   ├── bookings/
│   │   ├── payments/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── webhooks/
│   │   └── inquiries/
│
├── lib/
│   ├── db/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── client.ts
│   │
│   ├── stripe/
│   ├── resend/
│   ├── auth/
│   ├── pricing/
│   ├── availability/
│   ├── validations/
│   └── utils/
│
├── services/
│   ├── booking.service.ts
│   ├── payment.service.ts
│   ├── availability.service.ts
│   ├── email.service.ts
│   ├── admin.service.ts
│   └── inquiry.service.ts
│
├── middleware.ts
├── constants/
├── types/
└── jobs/
```

---

# Core Backend Modules

---

# 1. Availability System

## Core Principle

**Slots are NOT stored permanently.**

Backend dynamically generates slots using:

- availability rules
- pricing rules
- overrides
- bookings
- blocked slots

This architecture provides:

- DB scalability (no millions of pre-created slots)
- Flexible pricing
- Simple admin operations
- Easy rule updates

---

## Architecture Flow

```txt
1. Fetch resource
2. Fetch availability rules
3. Generate raw slots
4. Apply pricing rules
5. Apply overrides
6. Remove blocked slots
7. Remove booked slots
8. Return final slots
```

---

## 1.1 Create Availability Rules

Admin defines when a resource operates.

### API

```http
POST /api/admin/resources/:id/availability-rules
```

### Payload

```json
{
  "dayOfWeek": 1,
  "startTime": "06:00",
  "endTime": "22:00",
  "slotDurationMins": 60,
  "bufferMins": 10
}
```

### Meaning

```txt
Every Monday:
6 AM → 10 PM
1 hour slots
10 min buffer between slots
```

---

## 1.2 Create Pricing Rules

Admin defines pricing logic.

### API

```http
POST /api/admin/resources/:id/pricing-rules
```

### Payload

```json
{
  "name": "Evening Premium",
  "days": [1, 2, 3, 4, 5],
  "startTime": "17:00",
  "endTime": "22:00",
  "price": 700
}
```

### Meaning

```txt
Weekday evenings cost ₹700
Multiple rules can overlap - highest price wins
```

---

## 1.3 Create Slot Override

Temporary one-off price changes for specific slots.

### API

```http
POST /api/admin/resources/:id/slot-overrides
```

### Payload

```json
{
  "slotDate": "2026-05-20",
  "startAt": "2026-05-20T18:00:00Z",
  "endAt": "2026-05-20T19:00:00Z",
  "customPrice": 1200
}
```

### Meaning

```txt
Override price for a specific slot
Useful for special events or surge pricing
```

---

## 1.4 Block Slots

Admin blocks time periods for maintenance, holidays, events.

### API

```http
POST /api/admin/resource-blocks
```

### Payload

```json
{
  "resourceId": "lane-1",
  "startAt": "2026-05-20T18:00:00Z",
  "endAt": "2026-05-20T20:00:00Z",
  "reason": "Maintenance"
}
```

---

## Generate Slots API

Main endpoint for fetching available slots.

### API

```http
GET /api/slots?resourceId=lane-1&date=2026-05-20
```

### Response

```json
[
  {
    "start": "2026-05-20T06:00:00Z",
    "end": "2026-05-20T07:00:00Z",
    "price": 300,
    "available": true
  },
  {
    "start": "2026-05-20T18:00:00Z",
    "end": "2026-05-20T19:00:00Z",
    "price": 1200,
    "available": true
  }
]
```

---

## Responsibilities

- dynamically generate slots based on rules
- calculate peak/off-peak pricing
- apply one-off overrides
- exclude blocked slots
- exclude overlapping bookings
- support realtime refresh

---

# Requirements

- sub-500ms response target
- mobile optimized payload
- cache frequently requested dates
- support realtime updates
- handle multiple overlapping pricing rules
- apply pricing rule priority (highest price wins)

---

# 2. Booking System

This is the core business module.

---

# Booking Flow

```
Select Slot
    ↓
Validate Availability
    ↓
Create Pending Booking
    ↓
(Optional Payment)
    ↓
Confirm Booking
    ↓
Send Emails
```

---

# Booking Statuses

```
pending_payment
confirmed
cancelled
completed
expired
refunded
```

---

# Race Condition Prevention

## REQUIRED DATABASE STRATEGY

Must use:

- PostgreSQL exclusion constraints
- transactions
- row-level locking

---

# PostgreSQL Exclusion Constraint

```sql
EXCLUDE USING gist (
  resource_id WITH =,
  tsrange(start_at, end_at) WITH &&
)
WHERE (
  status IN ('confirmed', 'pending_payment')
)
```

This guarantees:

- no overlapping bookings
- safe concurrent booking
- atomic slot protection

This is mandatory.

---

# Temporary Slot Holding

When payment begins:

```
status = pending_payment
expires_at = now + 10 minutes
```

If payment fails or expires:

- release slot automatically

Use scheduled cleanup job.

---

# Booking APIs

## POST `/api/bookings`

Create booking safely inside transaction.

---

## GET `/api/bookings/:id`

Fetch booking details.

---

## POST `/api/bookings/cancel`

Cancel booking.

---

## POST `/api/bookings/reschedule`

Move booking to new slot safely.

---

# Booking Transaction Flow

```
BEGIN TRANSACTION

1. Validate resource exists
2. Check blocked slots
3. Check overlapping bookings
4. Insert booking
5. Commit

IF conflict:
ROLLBACK
```

---

# 3. Payment System

Stripe integration must remain optional.

---

# Stripe APIs

## POST `/api/payments/create-session`

Creates checkout session.

---

## POST `/api/webhooks/stripe`

Handles:

- payment success
- payment failure
- refund events

---

# Stripe Flow

```
Booking Created
      ↓
Stripe Checkout
      ↓
Webhook Verification
      ↓
Booking Confirmed
      ↓
Email Sent
```

---

# Stripe Requirements

- webhook signature verification
- idempotency support
- retry-safe processing
- refund support

---

# 4. Email System

Use Resend for transactional emails.

---

# Trigger Events

Send emails for:

- booking confirmation
- cancellation
- payment receipt
- inquiry submission
- admin alerts
- reminders

---

# Email Queue Architecture

Emails MUST NOT send directly inside request lifecycle.

Required flow:

```
API Request
    ↓
email_jobs table
    ↓
background worker
    ↓
Resend
```

Benefits:

- faster API responses
- retry support
- delivery tracking
- reduced failures

---

# Email Templates

## Customer Templates

- booking-confirmation
- cancellation-confirmation
- payment-receipt
- session-reminder

## Admin Templates

- new-booking
- failed-payment
- new-inquiry
- slot-conflict-alert

---

# 5. Inquiry System

Supports:

- coaching inquiries
- birthday party inquiries
- contact form submissions

---

# Inquiry APIs

## POST `/api/inquiries`

Create inquiry.

---

## GET `/api/admin/inquiries`

Admin inquiry listing.

---

# Inquiry Statuses

```
new
contacted
converted
closed
```

---

# 6. Admin Dashboard Backend

The admin panel is a full operational system.

---

# Admin Authentication

Use:

- Supabase Auth
- middleware protection
- role-based authorization

---

# User Roles

| Role          | Purpose         |
| ------------- | --------------- |
| public        | website visitor |
| authenticated | logged-in user  |
| admin         | staff           |
| super_admin   | owner           |

---

# Admin Routes

```
/admin
/admin/bookings
/admin/resources
/admin/customers
/admin/group-sessions
/admin/payments
/admin/inquiries
/admin/settings
/admin/analytics
```

---

# Admin Modules

---

# Booking Management

Features:

- view all bookings
- filters
- cancellations
- rescheduling
- manual bookings
- refund support

---

# Resource Management

Manage:

- lanes
- bowling machines
- side-arm setups

Features:

- activate/deactivate
- pricing configuration
- maintenance mode
- operating hours

---

# Slot Blocking System

Admins must block:

- maintenance
- holidays
- private events
- coaching sessions

---

# Group Sessions Management

Features:

- recurring schedules
- player limits
- attendance tracking
- coach assignment

---

# Customer Management

Features:

- booking history
- total spend
- notes
- frequent customers
- blacklist support

---

# Analytics Dashboard

KPIs:

- daily revenue
- utilization %
- peak hours
- cancellations
- repeat users
- top services

---

# Settings Management

Admin-configurable:

- pricing
- peak/offpeak timings
- cancellation rules
- email templates
- payment toggle
- academy timings

---

# Database Design

---

# users

```
id
name
email
phone
role
created_at
```

---

# resources

```
id
name
type
active
capacity
peak_price
offpeak_price
created_at
```

---

# bookings

```
id
booking_reference
user_id
resource_id
service_type
booking_date
start_at
end_at
status
payment_status
amount
stripe_session_id
expires_at
notes
created_at
```

---

# blocked_slots

```
id
resource_id
start_at
end_at
reason
created_by
created_at
```

---

# group_sessions

```
id
title
age_group
max_players
current_players
coach_name
schedule
price
active
created_at
```

---

# group_session_bookings

```
id
session_id
player_name
parent_name
emergency_contact
medical_notes
created_at
```

---

# inquiries

```
id
type
name
email
phone
message
status
created_at
```

---

# email_jobs

```
id
recipient
template
payload
status
attempts
created_at
```

---

# audit_logs

```
id
admin_id
action
entity
entity_id
metadata
created_at
```

---

# Supabase Setup Requirements

---

# Extensions

Run:

```sql
create extension if not exists btree_gist;
create extension if not exists pgcrypto;
```

---

# Realtime

Enable realtime for:

- bookings
- blocked_slots
- resources

---

# Storage Buckets

Required buckets:

```
coach-profiles
facility-images
admin-assets
```

---

# Row Level Security

RLS must be enabled on all tables.

Policies required for:

- public reads
- admin mutations
- authenticated user access

---

# Security Requirements

---

# Validation

Use Zod validation everywhere.

---

# Rate Limiting

Protect:

- booking endpoints
- inquiries
- auth APIs

Use:

- Upstash Redis

---

# Webhook Verification

Must verify:

- Stripe signatures
- Resend webhook signatures

---

# CSRF Protection

Required for:

- admin mutations
- payment APIs

---

# Audit Logging

All admin mutations must create audit logs.

Track:

- who changed
- what changed
- when changed

---

# Mobile Performance Requirements

Frontend is mobile-first.

Backend must optimize for:

- low payload size
- fast response times
- aggressive caching
- pagination
- minimal overfetching

---

# Performance Targets

| Metric               | Target  |
| -------------------- | ------- |
| Availability API     | < 500ms |
| Booking API          | < 1s    |
| Admin Dashboard Load | < 2s    |
| Webhook Processing   | < 3s    |

---

# Caching Strategy

Use caching for:

- availability lookup
- pricing configs
- group schedules

Recommended:

- Redis
- Next.js cache
- stale-while-revalidate

---

# Background Jobs

Required scheduled jobs:

| Job                      | Frequency    |
| ------------------------ | ------------ |
| Release expired bookings | every minute |
| Send reminders           | hourly       |
| Cleanup failed payments  | hourly       |
| Analytics aggregation    | daily        |

---

# Monitoring & Observability

Recommended stack:

| Tool             | Purpose          |
| ---------------- | ---------------- |
| Sentry           | Error monitoring |
| PostHog          | Analytics        |
| Vercel Analytics | Performance      |
| OpenTelemetry    | Tracing          |

---

# API Design Principles

All APIs must:

- use consistent response structure
- support pagination
- use typed validation
- avoid overfetching
- remain mobile optimized

---

# Standard API Response

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Error

```json
{
  "success": false,
  "error": {
    "message": "",
    "code": ""
  }
}
```

---

# Future Scalability

The architecture should support future features without major rewrites.

---

# Planned Future Features

| Feature                | Priority |
| ---------------------- | -------- |
| Memberships            | High     |
| Multi-location support | Medium   |
| Coach portal           | Medium   |
| QR attendance          | Medium   |
| WhatsApp notifications | Medium   |
| Waitlist system        | Medium   |

---

# Multi-Location Preparation

Future-proof schema using:

```
tenant_id
location_id
```

even if initially unused.

---

# Recommended Development Order

---

# Phase 1

- Supabase setup
- schema design
- auth
- availability APIs
- booking APIs

---

# Phase 2

- race condition protection
- admin dashboard backend
- slot blocking
- group sessions

---

# Phase 3

- Stripe integration
- webhook processing
- email system
- background jobs

---

# Phase 4

- analytics
- realtime updates
- optimization
- observability

---

# Non-Negotiable Rules

1. Never trust frontend availability checks alone.
2. All booking writes must be transactional.
3. Payments must remain toggleable.
4. Email sending must be asynchronous.
5. Admin actions must be audited.
6. APIs must remain mobile optimized.
7. Business logic must remain outside route handlers.

---

# Service Layer Rule

Do NOT place business logic directly in route handlers.

Correct structure:

```
API Route
   ↓
Service Layer
   ↓
Database Layer
```

This improves:

- maintainability
- testing
- scalability
- debugging

---

# Final Goal

Build a backend platform that is:

- reliable
- scalable
- mobile optimized
- payment ready
- admin friendly
- concurrency safe
- future-proof

while remaining manageable for a solo developer.
