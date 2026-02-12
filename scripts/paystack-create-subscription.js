/**
 * Create a Paystack subscription (run from your own Node backend).
 * Requires: customer (email or CUS_xxx), plan (PLN_xxx). Customer must have a saved card.
 *
 * Env: PAYSTACK_SECRET_KEY, PAYSTACK_PLAN_CODE (or PAYSTACK_PLAN_MONTHLY_CODE / PAYSTACK_PLAN_YEARLY_CODE)
 *
 * Usage (Node):
 *   node scripts/paystack-create-subscription.js <customer_email_or_code> [plan_code]
 * Or require and call createPaystackSubscription(customer, planCode, { authorizationCode }).
 */

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PLAN_MONTHLY = process.env.PAYSTACK_PLAN_MONTHLY_CODE || process.env.PAYSTACK_PLAN_CODE;
const PLAN_YEARLY = process.env.PAYSTACK_PLAN_YEARLY_CODE;

async function createPaystackSubscription(customer, planCode, options = {}) {
  if (!PAYSTACK_SECRET) {
    throw new Error('PAYSTACK_SECRET_KEY is required');
  }
  if (!planCode) {
    throw new Error('planCode is required (e.g. PLN_xxx or use monthly/yearly to pick from env)');
  }

  const body = {
    customer: customer,
    plan: planCode,
  };
  if (options.authorizationCode) {
    body.authorization = options.authorizationCode;
  }
  if (options.startDate) {
    body.start_date = options.startDate; // ISO 8601
  }

  const res = await fetch('https://api.paystack.co/subscription', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Paystack subscription creation failed');
  }
  return data.data;
}

async function main() {
  const customer = process.argv[2];
  let plan = process.argv[3];

  if (!customer) {
    console.error('Usage: node paystack-create-subscription.js <customer_email_or_CUS_xxx> [plan_code|monthly|yearly]');
    process.exit(1);
  }

  if (!plan || plan === 'monthly') {
    plan = PLAN_MONTHLY;
  } else if (plan === 'yearly') {
    plan = PLAN_YEARLY;
  }

  if (!plan) {
    console.error('No plan code. Set PAYSTACK_PLAN_CODE or PAYSTACK_PLAN_MONTHLY_CODE, or pass plan code as 3rd arg.');
    process.exit(1);
  }

  try {
    const result = await createPaystackSubscription(customer, plan);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

// Run from CLI: node scripts/paystack-create-subscription.js <customer> [plan]
const isMain = process.argv[1]?.endsWith('paystack-create-subscription.js');
if (isMain) {
  main();
}

export { createPaystackSubscription };
