const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript")
const root = path.resolve(__dirname, "../../..")
function load(file, deps = {}) {
  const m = { exports: {} }
  new Function(
    "require",
    "module",
    "exports",
    ts.transpile(fs.readFileSync(path.join(root, file), "utf8"), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    })
  )(
    (n) => {
      if (n in deps) return deps[n]
      throw Error(n)
    },
    m,
    m.exports
  )
  return m.exports
}
const quote = load("apps/web/lib/booking-quote.ts")
const helpers = load("apps/web/lib/coupons.ts", {
  "@/lib/booking-quote": quote,
})
test("coupon validation, integer rounding and UK calendar boundaries", () => {
  assert.equal(helpers.normalizeCoupon(" coach15 "), "COACH15")
  assert.throws(() => helpers.normalizeCoupon("<script>"))
  assert.deepEqual(helpers.discountTotal(4000, 15), {
    subtotalMinor: 4000,
    discountMinor: 600,
    totalMinor: 3400,
  })
  assert.equal(helpers.discountTotal(4000, 20).totalMinor, 3200)
  assert.equal(helpers.discountTotal(3333, 15).discountMinor, 500)
  assert.throws(() => helpers.discountTotal(30, 99))
  assert.throws(() => helpers.discountTotal(1000, 100))
  const input = helpers.couponInput({
    code: "COACH15",
    percent_off: 15,
    max_uses: 50,
    start_date: "2030-06-01",
    end_date: "2030-07-01",
    status: "draft",
  })
  assert.equal(input.starts_at, "2030-05-31T23:00:00.000Z")
  assert.throws(() =>
    helpers.couponInput({
      ...input,
      start_date: "2030-07-01",
      end_date: "2030-06-01",
    })
  )
})
test("admin coupon CRUD requires authentication/origin and records bounded inputs", async () => {
  let admin = false,
    origin = false,
    calls = []
  const route = load("apps/web/app/api/admin/coupons/route.ts", {
    "@/lib/security/admin-auth": {
      isAdminRequest: async () => admin,
      isAdminMutationRequest: async () => admin && origin,
    },
    "@/lib/security/request-body": load(
      "apps/web/lib/security/request-body.ts"
    ),
    "@/lib/services/supabase": {
      supabaseAdmin: {
        rpc: async (name, args) => {
          calls.push([name, args])
          return { data: { id: "synthetic" }, error: null }
        },
      },
    },
    "@/lib/coupons": helpers,
  })
  const body = {
    code: " coach15 ",
    percent_off: 15,
    max_uses: 50,
    start_date: "2030-06-01",
    end_date: "2030-07-01",
    status: "draft",
  }
  const req = (method, b = body) =>
    new Request("https://example.invalid/api/admin/coupons", {
      method,
      ...(method !== "GET"
        ? {
            body: JSON.stringify(b),
            headers: { "content-type": "application/json" },
          }
        : {}),
    })
  assert.equal((await route.GET(req("GET"))).status, 401)
  assert.equal((await route.POST(req("POST"))).status, 403)
  assert.equal(calls.length, 0)
  admin = true
  assert.equal((await route.POST(req("POST"))).status, 403)
  origin = true
  assert.equal((await route.POST(req("POST"))).status, 201)
  assert.equal(calls.at(-1)[1].p_input.code, "COACH15")
  assert.equal(
    (await route.POST(req("POST", { ...body, percent_off: 100 }))).status,
    400
  )
  const item = {
    ...body,
    id: "12345678-1234-4123-a123-123456789012",
    version: 1,
  }
  assert.equal((await route.PATCH(req("PATCH", item))).status, 200)
  assert.equal((await route.DELETE(req("DELETE", item))).status, 200)
  assert.equal(calls.at(-1)[1].p_action, "archive")
  assert.equal(
    (await route.GET(req("GET"))).headers.get("cache-control"),
    "no-store"
  )
})
