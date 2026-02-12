# Paystack Subscriptions API – Past Papers

This project does **not** use Supabase Edge Functions for Paystack. Past paper access uses **one-time payments** from the frontend (Paystack inline popup); on success the app updates `past_paper_subscriptions` in the client.

If you want **recurring** charges via Paystack’s [Subscriptions API](https://paystack.com/docs/subscriptions/), implement the calls from **your own backend** (e.g. Node, Next API routes, or another server) and keep the secret key server-side.

## Current flow (no Edge Functions)

- User clicks Subscribe (monthly/yearly) → Paystack inline popup (one-time charge) → on success the frontend upserts `past_paper_subscriptions` with `current_period_end` (e.g. now + 1 month or + 1 year).
- No recurring charges; user pays again when the period ends if you prompt them.

## Optional: recurring with your own backend

To use Paystack’s Subscriptions API (recurring billing), use a **backend you control** (no Edge Functions).

### 1. Create plans in Paystack

Create one plan per billing interval (e.g. monthly and yearly).

**Dashboard:** Paystack Dashboard → Plans → Create plan (name, amount in kobo, interval `monthly` or `annually`, currency). Copy the **Plan code** (e.g. `PLN_xxxx`).

**Or Plan API:**

```bash
# Monthly (e.g. ZAR 199.00 = 19900 kobo)
curl -X POST https://api.paystack.co/plan \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Past Papers Monthly", "amount": 19900, "interval": "monthly", "currency": "ZAR"}'

# Yearly (e.g. ZAR 1990.00 = 199000 kobo)
curl -X POST https://api.paystack.co/plan \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Past Papers Yearly", "amount": 199000, "interval": "annually", "currency": "ZAR"}'
```

Save each `plan_code` (e.g. `PLN_gx2wn530m0i3w3m`).

### 2. Create subscription from your backend

Call Paystack with your **secret key** (never expose it in the frontend).

**Using the project script (Node, ESM):**

```bash
# Set env then run (customer = email or CUS_xxx, plan = PLN_xxx or "monthly"/"yearly" to use env plan code)
export PAYSTACK_SECRET_KEY=sk_xxx
export PAYSTACK_PLAN_CODE=PLN_3pankare3c1yee8   # or PAYSTACK_PLAN_MONTHLY_CODE / PAYSTACK_PLAN_YEARLY_CODE
node scripts/paystack-create-subscription.js customer@email.com monthly
```

Or from your own Node backend, require/import and call:

```js
import { createPaystackSubscription } from './scripts/paystack-create-subscription.js';
const data = await createPaystackSubscription('CUS_xxx', 'PLN_3pankare3c1yee8', { authorizationCode: 'AUTH_xxx' });
```

**Raw Node (https) example:**

```js
const https = require('https');
const params = JSON.stringify({
  customer: 'CUS_xnxdt6s1zg1f4nx',
  plan: 'PLN_gx2wn530m0i3w3m'
});
const options = {
  hostname: 'api.paystack.co',
  port: 443,
  path: '/subscription',
  method: 'POST',
  headers: {
    Authorization: 'Bearer SECRET_KEY',
    'Content-Type': 'application/json'
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => console.log(JSON.parse(data)));
}).on('error', console.error);
req.write(params);
req.end();
```

- **customer:** User’s email or Paystack customer code (`CUS_xxx`).
- **plan:** Plan code from step 1 (e.g. `PLN_3pankare3c1yee8`).
- **authorization:** (Optional) Reusable authorization from a previous successful charge. If omitted, Paystack uses the customer’s most recent authorization.

On success, Paystack returns subscription details (e.g. `subscription_code`, `next_payment_date`). Your backend can then update `past_paper_subscriptions` (e.g. via Supabase with the service role or a DB client) with `paystack_subscription_code` and `current_period_end` from `next_payment_date`.

### 3. Customer and authorization

- Paystack needs a **customer** with a **saved card** (authorization) to create a subscription.
- Get `authorization_code` from the [Verify Transaction](https://paystack.com/docs/transactions/verify/) response (or webhook) after any successful charge; store it per user and pass it as `authorization` when creating a subscription.

### 4. Webhooks (recommended)

Subscribe to subscription events (e.g. renewal, disable) and update `past_paper_subscriptions` in your backend so access stays in sync with Paystack.

### 5. Database

The migration `add_paystack_subscription_code_to_past_paper_subscriptions.sql` adds `paystack_subscription_code` and `paystack_customer_code` to `past_paper_subscriptions` for when you use the Subscriptions API from your own backend.

## Summary

- **Current:** One-time Paystack payments from the frontend; no Edge Functions.
- **Recurring:** Use Paystack Subscriptions API from **your own backend**; create plans, then `POST /subscription` with secret key and update `past_paper_subscriptions` from that backend.
