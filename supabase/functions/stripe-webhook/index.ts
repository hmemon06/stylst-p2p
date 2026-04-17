// Supabase Edge Function for Stripe Webhook
// Handles subscription and payment events from Stripe (via Superwall Payment Sheet)
//
// Deploy: supabase functions deploy stripe-webhook
//
// Required env vars:
//   STRIPE_WEBHOOK_SECRET  – Webhook signing secret from Stripe dashboard
//   SUPABASE_URL           – Auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY – Auto-set by Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Credit amounts per plan (matches RevenueCat webhook logic)
const CREDIT_AMOUNTS: Record<string, number> = {
  yearly: 200,
  monthly: 15,
  weekly: 3,
};

// ---------------------------------------------------------------------------
// Stripe signature verification (HMAC-SHA256)
// ---------------------------------------------------------------------------
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  if (!secret) {
    console.warn("⚠️  STRIPE_WEBHOOK_SECRET not set – skipping signature verification");
    return true; // Allow in dev; in production you MUST set the secret
  }

  try {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k, v];
      })
    );

    const timestamp = parts["t"];
    const signature = parts["v1"];

    if (!timestamp || !signature) return false;

    // Protect against replay attacks (5-minute tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      console.warn("Stripe signature timestamp too old");
      return false;
    }

    const payload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computed === signature;
  } catch (err) {
    console.error("Stripe signature verification error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract device UUID from Stripe metadata (Superwall passes it as appUserId / app_user_id). */
function extractDeviceUUID(obj: Record<string, any>): string | null {
  // Superwall typically sets metadata on the subscription or checkout session
  const meta = obj.metadata ?? {};
  return (
    meta.app_user_id ??
    meta.appUserId ??
    meta.device_uuid ??
    meta.superwall_app_user_id ??
    null
  );
}

/** Determine plan type from Stripe price interval. */
function determinePlan(interval: string | undefined): string {
  switch (interval) {
    case "year":
      return "yearly";
    case "month":
      return "monthly";
    case "week":
      return "weekly";
    default:
      return "yearly"; // default
  }
}

/** Determine credit amount from plan. */
function creditsForPlan(plan: string): number {
  return CREDIT_AMOUNTS[plan] ?? CREDIT_AMOUNTS.yearly;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature") || "";

  // Verify Stripe signature
  const isValid = await verifyStripeSignature(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("❌ Invalid Stripe signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event.type;
    const eventId = event.id;

    console.log(`[Stripe Webhook] Received ${eventType} (${eventId})`);

    // -----------------------------------------------------------------------
    // Handle events
    // -----------------------------------------------------------------------

    if (eventType === "checkout.session.completed") {
      // Initial purchase via Superwall Payment Sheet
      const session = event.data.object;
      const deviceUUID = extractDeviceUUID(session);
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!deviceUUID) {
        console.warn("⚠️  No device UUID in checkout.session metadata:", JSON.stringify(session.metadata));
        return jsonOk({ received: true, warning: "no_device_uuid" });
      }

      // Check for duplicate processing
      if (await isAlreadyProcessed(eventId)) {
        return jsonOk({ received: true, already_processed: true });
      }

      // Retrieve subscription to get the plan interval
      let plan = "yearly";
      let interval: string | undefined;
      if (stripeSubscriptionId) {
        // We don't have the Stripe SDK, so we store what we can from the session
        // The subscription details come through in customer.subscription.created
        plan = session.metadata?.plan || "yearly";
      }

      const credits = creditsForPlan(plan);

      await upsertUser(deviceUUID, {
        is_premium: true,
        plan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        payment_platform: "stripe",
        credits,
      });

      await recordTransaction(eventId, deviceUUID, eventType, session.metadata?.product_id || stripeSubscriptionId, credits);
      console.log(`✅ CHECKOUT COMPLETE ${deviceUUID}: premium=true, plan=${plan}, credits +${credits}`);
    }

    else if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
      const subscription = event.data.object;
      const deviceUUID = extractDeviceUUID(subscription);
      const stripeCustomerId = subscription.customer;
      const stripeSubscriptionId = subscription.id;
      const status = subscription.status; // active, past_due, canceled, etc.

      if (!deviceUUID) {
        console.warn(`⚠️  No device UUID in subscription metadata for ${eventType}`);
        return jsonOk({ received: true, warning: "no_device_uuid" });
      }

      if (await isAlreadyProcessed(eventId)) {
        return jsonOk({ received: true, already_processed: true });
      }

      const isActive = ["active", "trialing"].includes(status);
      const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
      const plan = determinePlan(interval);

      if (isActive) {
        const credits = creditsForPlan(plan);
        await upsertUser(deviceUUID, {
          is_premium: true,
          plan,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          payment_platform: "stripe",
          credits,
        });
        await recordTransaction(eventId, deviceUUID, eventType, subscription.items?.data?.[0]?.price?.id, credits);
        console.log(`✅ SUBSCRIPTION ${eventType === "customer.subscription.created" ? "CREATED" : "UPDATED"} ${deviceUUID}: plan=${plan}, credits +${credits}`);
      } else if (["canceled", "unpaid", "incomplete_expired"].includes(status)) {
        await updateUserPremium(deviceUUID, false);
        console.log(`✅ SUBSCRIPTION INACTIVE ${deviceUUID}: status=${status}, premium=false`);
      }
    }

    else if (eventType === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const deviceUUID = extractDeviceUUID(subscription);

      if (!deviceUUID) {
        console.warn("⚠️  No device UUID in deleted subscription metadata");
        return jsonOk({ received: true, warning: "no_device_uuid" });
      }

      await updateUserPremium(deviceUUID, false);
      console.log(`✅ SUBSCRIPTION DELETED ${deviceUUID}: premium=false`);
    }

    else if (eventType === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const stripeSubscriptionId = invoice.subscription;
      const deviceUUID = extractDeviceUUID(invoice) || await findDeviceBySubscription(stripeSubscriptionId);

      if (!deviceUUID) {
        console.warn("⚠️  No device UUID for invoice.payment_succeeded");
        return jsonOk({ received: true, warning: "no_device_uuid" });
      }

      if (await isAlreadyProcessed(eventId)) {
        return jsonOk({ received: true, already_processed: true });
      }

      // Only grant credits for renewal invoices (not the first one which is handled by checkout.session.completed)
      const billingReason = invoice.billing_reason;
      if (billingReason === "subscription_cycle") {
        const interval = invoice.lines?.data?.[0]?.price?.recurring?.interval;
        const plan = determinePlan(interval);
        const credits = creditsForPlan(plan);

        await grantCredits(deviceUUID, credits);
        await recordTransaction(eventId, deviceUUID, eventType, invoice.lines?.data?.[0]?.price?.id, credits);
        console.log(`✅ RENEWAL ${deviceUUID}: plan=${plan}, credits +${credits}`);
      }
    }

    else if (eventType === "invoice.payment_failed") {
      const invoice = event.data.object;
      const stripeSubscriptionId = invoice.subscription;
      const deviceUUID = extractDeviceUUID(invoice) || await findDeviceBySubscription(stripeSubscriptionId);

      if (deviceUUID) {
        // Don't immediately revoke premium on billing failure — Stripe retries
        // Just log it for monitoring
        console.warn(`⚠️  BILLING ISSUE ${deviceUUID}: subscription=${stripeSubscriptionId}`);
      }
    }

    else {
      console.log(`[Stripe Webhook] Unhandled event type: ${eventType}`);
    }

    return jsonOk({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function jsonOk(body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function isAlreadyProcessed(transactionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("processed_transactions")
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .single();
  if (data) {
    console.log(`⚠️  Transaction ${transactionId} already processed, skipping`);
    return true;
  }
  return false;
}

async function upsertUser(
  deviceUUID: string,
  data: {
    is_premium: boolean;
    plan: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    payment_platform?: string;
    credits: number;
  }
): Promise<void> {
  const { data: existing } = await supabase
    .from("users")
    .select("id, redesign_credits, subscription_started_at")
    .eq("device_uuid", deviceUUID)
    .single();

  if (existing) {
    const currentCredits = existing.redesign_credits || 0;
    const updateData: Record<string, any> = {
      is_premium: data.is_premium,
      plan: data.plan,
      redesign_credits: currentCredits + data.credits,
      last_credited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (data.stripe_customer_id) updateData.stripe_customer_id = data.stripe_customer_id;
    if (data.stripe_subscription_id) updateData.stripe_subscription_id = data.stripe_subscription_id;
    if (data.payment_platform) updateData.payment_platform = data.payment_platform;
    if (!existing.subscription_started_at) {
      updateData.subscription_started_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("device_uuid", deviceUUID);

    if (error) throw error;
  } else {
    // Create user if they don't exist (unlikely but safe)
    const { error } = await supabase
      .from("users")
      .insert({
        device_uuid: deviceUUID,
        is_premium: data.is_premium,
        plan: data.plan,
        redesign_credits: data.credits,
        scan_count: 0,
        current_streak: 0,
        stripe_customer_id: data.stripe_customer_id || null,
        stripe_subscription_id: data.stripe_subscription_id || null,
        payment_platform: data.payment_platform || "stripe",
        subscription_started_at: new Date().toISOString(),
        last_credited_at: new Date().toISOString(),
        last_active_date: new Date().toISOString(),
      });

    if (error) throw error;
  }
}

async function updateUserPremium(deviceUUID: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      is_premium: isPremium,
      plan: isPremium ? undefined : "free",
      updated_at: new Date().toISOString(),
    })
    .eq("device_uuid", deviceUUID);

  if (error) throw error;
}

async function grantCredits(deviceUUID: string, credits: number): Promise<void> {
  const { data: user } = await supabase
    .from("users")
    .select("redesign_credits")
    .eq("device_uuid", deviceUUID)
    .single();

  const currentCredits = user?.redesign_credits || 0;

  const { error } = await supabase
    .from("users")
    .update({
      redesign_credits: currentCredits + credits,
      last_credited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("device_uuid", deviceUUID);

  if (error) throw error;
}

async function recordTransaction(
  transactionId: string,
  deviceUUID: string,
  eventType: string,
  productId: string | null,
  credits: number
): Promise<void> {
  // Look up user ID for the transaction record
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("device_uuid", deviceUUID)
    .single();

  const { error } = await supabase
    .from("processed_transactions")
    .insert({
      transaction_id: transactionId,
      user_id: user?.id || null,
      event_type: eventType,
      product_id: productId,
      credits_granted: credits,
    });

  if (error) {
    console.error("Error recording transaction:", error);
    // Don't throw – user already got their credits
  }
}

/** Look up a device UUID by their Stripe subscription ID (fallback for invoices). */
async function findDeviceBySubscription(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;

  const { data } = await supabase
    .from("users")
    .select("device_uuid")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  return data?.device_uuid || null;
}
