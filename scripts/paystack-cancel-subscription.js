/**
 * Disable/cancel a Paystack subscription.
 *
 * Env: PAYSTACK_SECRET_KEY
 *
 * Usage (Node):
 *   node scripts/paystack-cancel-subscription.js <subscription_code> <token>
 *
 * Example:
 *   node scripts/paystack-cancel-subscription.js SUB_vsyqdmlzble3uii d7gofp6yppn3qz7
 *
 * Get subscription code from your DB (past_paper_subscriptions.paystack_subscription_code)
 * or from Paystack Dashboard. Token is the customer's email token from the subscription.
 */

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

async function disablePaystackSubscription(code, token) {
  if (!PAYSTACK_SECRET) {
    throw new Error('PAYSTACK_SECRET_KEY is required');
  }
  if (!code || !code.startsWith('SUB_')) {
    throw new Error('Valid subscription code (SUB_xxx) is required');
  }
  if (!token) {
    throw new Error('Token (email token) is required');
  }

  const res = await fetch('https://api.paystack.co/subscription/disable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, token }),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Paystack subscription disable failed');
  }
  return data.data;
}

async function main() {
  const code = process.argv[2];
  const token = process.argv[3];

  if (!code || !token) {
    console.error('Usage: node paystack-cancel-subscription.js <SUB_xxx> <token>');
    console.error('Example: node paystack-cancel-subscription.js SUB_vsyqdmlzble3uii d7gofp6yppn3qz7');
    process.exit(1);
  }

  try {
    const result = await disablePaystackSubscription(code, token);
    console.log('Subscription disabled successfully.');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1]?.endsWith('paystack-cancel-subscription.js');
if (isMain) {
  main();
}

export { disablePaystackSubscription };
