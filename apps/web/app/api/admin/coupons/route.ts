import {
  isAdminRequest,
  isAdminMutationRequest,
} from "@/lib/security/admin-auth"
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body"
import { supabaseAdmin } from "@/lib/services/supabase"
import { couponInput } from "@/lib/coupons"

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
export async function GET(request: Request) {
  if (!(await isAdminRequest(request)))
    return json({ error: "Unauthorized" }, 401)
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_coupon_list")
    if (error) throw error
    return json({
      coupons: data,
      enabled: process.env.CHECKOUT_PROMOTIONS_ENABLED === "true",
    })
  } catch {
    return json(
      {
        error:
          "Coupon management is unavailable. Check the database migration and configuration.",
      },
      503
    )
  }
}
async function mutate(
  request: Request,
  action: "create" | "update" | "archive"
) {
  if (!(await isAdminMutationRequest(request)))
    return json({ error: "Forbidden" }, 403)
  try {
    const body = await readJsonBody(request, 4096)
    let input = null
    try {
      if (action !== "archive") input = couponInput(body)
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Invalid coupon" },
        400
      )
    }
    if (
      action !== "create" &&
      (typeof body.id !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(body.id) ||
        !Number.isSafeInteger(body.version))
    )
      return json({ error: "Invalid coupon version" }, 400)
    const { data, error } = await supabaseAdmin.rpc("admin_save_coupon", {
      p_action: action,
      p_id: action === "create" ? null : body.id,
      p_version: action === "create" ? null : body.version,
      p_input: input,
    })
    if (error)
      return json(
        {
          error:
            error.code === "23505"
              ? "This code already exists, including archived coupons."
              : "Coupon changed or could not be saved. Refresh and check the dates and usage cap.",
        },
        409
      )
    return json({ coupon: data }, action === "create" ? 201 : 200)
  } catch (error) {
    return json(
      {
        error:
          error instanceof RequestBodyError
            ? error.message
            : "Unable to save coupon",
      },
      error instanceof RequestBodyError ? error.status : 503
    )
  }
}
export const POST = (request: Request) => mutate(request, "create")
export const PATCH = (request: Request) => mutate(request, "update")
export const DELETE = (request: Request) => mutate(request, "archive")
