// Supabase Edge Function for RevenueCat Webhook
// Deploy this to: supabase/functions/revenuecat-webhook/index.ts
//
// To deploy:
// supabase functions deploy revenuecat-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Credit amounts per plan (subscriptions)
const CREDIT_AMOUNTS: Record<string, number> = {
  yearly: 200,
  monthly: 15,
  weekly: 3,
};

// One-time credit purchase products
// Map product IDs to credit amounts
const ONE_TIME_CREDITS: Record<string, number> = {
  // Your actual product IDs from RevenueCat
  "com.stylst.app.redesigns.3pack": 3,
  "com.stylst.app.redesigns.10pack": 10,
  "com.stylst.app.redesigns.25pack": 25,

  // Fallback patterns (in case product IDs change)
  "redesigns.3pack": 3,
  "redesigns.10pack": 10,
  "redesigns.25pack": 25,
  "3pack": 3,
  "10pack": 10,
  "25pack": 25,
};

function determineCredits(productId: string, eventType: string): number {
  const lowerProduct = productId.toLowerCase();

  // For NON_RENEWING_PURCHASE, check one-time credit products first
  if (eventType === "NON_RENEWING_PURCHASE") {
    // Check if it matches a one-time credit product
    for (const [key, credits] of Object.entries(ONE_TIME_CREDITS)) {
      if (lowerProduct.includes(key) || lowerProduct === key) {
        return credits;
      }
    }

    // If product ID contains a number, try to extract it
    // e.g., "stylst_redesign_50_credits" -> 50
    const numberMatch = lowerProduct.match(/(\d+)/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1], 10);
      // Reasonable range for credit purchases (1-500)
      if (number >= 1 && number <= 500) {
        return number;
      }
    }
  }

  // For subscriptions (INITIAL_PURCHASE, RENEWAL, etc.)
  if (lowerProduct.includes("yearly") || lowerProduct.includes("year")) {
    return CREDIT_AMOUNTS.yearly;
  }
  if (lowerProduct.includes("monthly") || lowerProduct.includes("month")) {
    return CREDIT_AMOUNTS.monthly;
  }
  if (lowerProduct.includes("weekly") || lowerProduct.includes("week")) {
    return CREDIT_AMOUNTS.weekly;
  }

  // Default to yearly amount if unclear
  return CREDIT_AMOUNTS.yearly;
}

function determinePlan(productId: string): string {
  const lowerProduct = productId.toLowerCase();
  if (lowerProduct.includes("yearly") || lowerProduct.includes("year")) {
    return "yearly";
  }
  if (lowerProduct.includes("monthly") || lowerProduct.includes("month")) {
    return "monthly";
  }
  if (lowerProduct.includes("weekly") || lowerProduct.includes("week")) {
    return "weekly";
  }
  return "yearly";
}

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload = await req.json();
    console.log("RevenueCat webhook received:", JSON.stringify(payload, null, 2));

    const { event } = payload;

    // Handle different event types
    if (!event || !event.type) {
      console.warn("No event type in payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const eventType = event.type;
    const appUserId = event.app_user_id; // This is the device UUID
    const productId = event.product_id;
    const transactionId = event.id || event.transaction_id || `${appUserId}-${eventType}-${Date.now()}`;

    console.log(`Processing ${eventType} for user: ${appUserId}, transaction: ${transactionId}, product: ${productId}`);

    // Check if this transaction has already been processed
    const { data: existingTransaction } = await supabase
      .from("processed_transactions")
      .select("transaction_id")
      .eq("transaction_id", transactionId)
      .single();

    if (existingTransaction) {
      console.log(`⚠️ Transaction ${transactionId} already processed, skipping to prevent duplicate credits`);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Events that grant/activate premium status
    const isPremiumEvent = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE",
    ].includes(eventType);

    // Events that remove premium status
    const isUnpremiumEvent = [
      "CANCELLATION",
      "EXPIRATION",
      "BILLING_ISSUE",
    ].includes(eventType);

    if (isPremiumEvent) {
      const creditsToGrant = determineCredits(productId, eventType);
      const plan = determinePlan(productId);
      const isInitialPurchase = eventType === "INITIAL_PURCHASE";
      const isOneTimePurchase = eventType === "NON_RENEWING_PURCHASE";

      console.log(`Granting ${creditsToGrant} credits for ${eventType} (product: ${productId})`);

      // Check if user exists and get their UUID
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, device_uuid, redesign_credits, subscription_started_at")
        .eq("device_uuid", appUserId)
        .single();

      if (existingUser) {
        // UPDATE existing user
        const currentCredits = existingUser.redesign_credits || 0;
        const newCredits = currentCredits + creditsToGrant;

        const updateData: any = {
          redesign_credits: newCredits,
          last_credited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Only update premium status and plan for subscriptions (not one-time purchases)
        if (!isOneTimePurchase) {
          updateData.is_premium = true;
          updateData.plan = plan;

          // Only set subscription_started_at on INITIAL_PURCHASE
          if (isInitialPurchase && !existingUser.subscription_started_at) {
            updateData.subscription_started_at = new Date().toISOString();
          }
        }

        const { error: updateError } = await supabase
          .from("users")
          .update(updateData)
          .eq("device_uuid", appUserId);

        if (updateError) {
          console.error("Error updating user:", updateError);
          throw updateError;
        }

        // Record the transaction in processed_transactions table
        const { error: txError } = await supabase
          .from("processed_transactions")
          .insert({
            transaction_id: transactionId,
            user_id: existingUser.id, // Use the UUID from users table
            event_type: eventType,
            product_id: productId,
            credits_granted: creditsToGrant,
          });

        if (txError) {
          console.error("Error recording transaction:", txError);
          // Don't throw - user already got their credits
        }

        const eventLabel = isOneTimePurchase ? 'CREDIT PURCHASE' : (isInitialPurchase ? 'NEW SUBSCRIBER' : 'RENEWAL');
        console.log(`✅ ${eventLabel} ${appUserId}: credits +${creditsToGrant} → ${newCredits} total${!isOneTimePurchase ? `, plan=${plan}` : ''}`);
      } else {
        // INSERT new user (shouldn't happen often, but just in case)
        const insertData: any = {
          device_uuid: appUserId,
          redesign_credits: creditsToGrant,
          scan_count: 0,
          current_streak: 0,
          last_credited_at: new Date().toISOString(),
          last_active_date: new Date().toISOString(),
        };

        // Only set premium fields for subscriptions
        if (!isOneTimePurchase) {
          insertData.is_premium = true;
          insertData.plan = plan;
          insertData.subscription_started_at = isInitialPurchase ? new Date().toISOString() : null;
        }

        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError) {
          console.error("Error inserting user:", insertError);
          throw insertError;
        }

        // Record the transaction in processed_transactions table
        await supabase
          .from("processed_transactions")
          .insert({
            transaction_id: transactionId,
            user_id: newUser.id, // Use the UUID from the newly created user
            event_type: eventType,
            product_id: productId,
            credits_granted: creditsToGrant,
          });

        const createLabel = isOneTimePurchase ? 'CREDIT PURCHASE' : 'NEW SUBSCRIBER';
        console.log(`✅ Created user ${appUserId} (${createLabel}): credits=${creditsToGrant}${!isOneTimePurchase ? `, premium=true, plan=${plan}` : ''}`);
      }
    } else if (isUnpremiumEvent) {
      // Remove premium status but keep credits
      const { error: updateError } = await supabase
        .from("users")
        .update({
          is_premium: false,
          plan: "free",
          updated_at: new Date().toISOString(),
        })
        .eq("device_uuid", appUserId);

      if (updateError) {
        console.error("Error removing premium:", updateError);
        throw updateError;
      }

      console.log(`✅ Removed premium from user ${appUserId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
