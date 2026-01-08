import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Usa SECRET + SERVICE ROLE (solo server, MAI nel client)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Legge il RAW body (serve per verificare la signature Stripe)
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function upsertCustomerMapping({ userId, customerId }) {
  // tabella: stripe_customers(user_id, customer_id)
  const { error } = await supabaseAdmin
    .from("stripe_customers")
    .upsert({ user_id: userId, customer_id: customerId }, { onConflict: "user_id" });

  if (error) throw new Error(`Supabase upsert stripe_customers failed: ${error.message}`);
}

async function getUserIdByCustomer(customerId) {
  const { data, error } = await supabaseAdmin
    .from("stripe_customers")
    .select("user_id")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(`Supabase select stripe_customers failed: ${error.message}`);
  return data?.user_id || null;
}

async function upsertSubscriptionRow({ userId, sub }) {
  // tabella: subscriptions(user_id, subscription_id, status, price_id, current_period_end, cancel_at_period_end, updated_at)
  const priceId = sub?.items?.data?.[0]?.price?.id ?? null;

  const payload = {
    user_id: userId,
    subscription_id: sub.id,
    status: sub.status,
    price_id: priceId,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(payload, { onConflict: "subscription_id" });

  if (error) throw new Error(`Supabase upsert subscriptions failed: ${error.message}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      /**
       * Quando l’utente completa il checkout (abbonamento)
       * IMPORTANTISSIMO: quando crei la Checkout Session devi passare:
       * metadata: { supabase_user_id: "<uuid>" }
       */
      case "checkout.session.completed": {
        const session = event.data.object;

        // session.customer può essere string o oggetto
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const userId = session?.metadata?.supabase_user_id;

        // Se non hai messo metadata, qui non sapremo a chi associare il pagamento
        if (userId && customerId) {
          await upsertCustomerMapping({ userId, customerId });
        }

        // Se è un abbonamento, salva anche la subscription
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId, {
              expand: ["items.data.price"],
            });

            // Preferisci userId da metadata; altrimenti prova a risalire dal customer mapping
            let finalUserId = userId;
            if (!finalUserId && customerId) finalUserId = await getUserIdByCustomer(customerId);

            if (finalUserId) await upsertSubscriptionRow({ userId: finalUserId, sub });
          }
        }

        break;
      }

      /**
       * Aggiornamenti subscription (rinnovi, upgrade/downgrade, cancel, ecc.)
       */
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;

        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const userId = customerId ? await getUserIdByCustomer(customerId) : null;

        if (userId) {
          const fullSub = await stripe.subscriptions.retrieve(sub.id, {
            expand: ["items.data.price"],
          });
          await upsertSubscriptionRow({ userId, sub: fullSub });
        }

        break;
      }

      /**
       * Se un pagamento fallisce, di solito Stripe mette la subscription in past_due/unpaid
       * (noi comunque ci aggiorniamo con customer.subscription.updated)
       */
      case "invoice.payment_failed":
      case "invoice.payment_succeeded":
        // opzionale: log
        break;

      default:
        // Eventi non gestiti
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    return res.status(500).send("Webhook handler failed");
  }
}
