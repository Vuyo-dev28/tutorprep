# Paystack Subscription Usage

This document explains how to use the Paystack subscription flow implemented in this project.

## Overview

The subscription flow uses Paystack's `/transaction/initialize` endpoint with a plan to create subscriptions. The implementation calls Paystack API directly from the frontend.

⚠️ **Security Note**: This implementation uses the secret key in the frontend. For production applications, consider using a backend API to keep the secret key secure.

## Setup

### 1. Configure Environment Variables

Add these to your `.env` file:

```bash
# Paystack Public Key (for PaystackPop inline payments)
VITE_PAYSTACK_PUBLIC_KEY=pk_test_your-public-key-here

# Paystack Secret Key (for subscription initialization)
# ⚠️ WARNING: This will be exposed in your frontend bundle
VITE_PAYSTACK_SECRET_KEY=sk_test_your-secret-key-here

# Paystack Plan ID (your subscription plan code)
VITE_PAYSTACK_PLAN_ID=PLN_xxxx
```

### 2. Create a Plan in Paystack

1. Go to [Paystack Dashboard](https://dashboard.paystack.com/#/plans)
2. Create a new plan with your desired amount and billing interval
3. Copy the Plan Code (e.g., `PLN_xxxx`)
4. Add it to your Supabase Edge Function secrets as `PAYSTACK_PLAN_ID`

## Usage

### Basic Example

```typescript
import { subscribe } from '@/lib/paystackSubscriptionService';

// Simple subscription with default plan from environment
await subscribe();
```

### Advanced Example

```typescript
import { initializeSubscription, redirectToPaystack } from '@/lib/paystackSubscriptionService';

try {
  // Initialize subscription with custom parameters
  const response = await initializeSubscription({
    email: 'customer@email.com', // Optional - defaults to authenticated user's email
    amount: '500000', // Optional - amount in kobo (500000 = 5000.00)
    plan: 'PLN_xxxx', // Optional - defaults to PAYSTACK_PLAN_ID from env
    callback_url: 'https://your-domain.com/subscription/callback', // Optional
  });

  // Redirect user to Paystack payment page
  redirectToPaystack(response.authorization_url);

  // Or handle the response manually
  console.log('Reference:', response.reference);
  console.log('Access Code:', response.access_code);
} catch (error) {
  console.error('Subscription failed:', error);
}
```

### React Component Example

```typescript
import { useState } from 'react';
import { subscribe } from '@/lib/paystackSubscriptionService';

function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      await subscribe({
        // Optional: override default plan
        plan: 'PLN_xxxx',
        plan_type: 'monthly', // or 'yearly'
        curriculum: 'CAPS', // or 'IEB'
        callback_url: 'https://your-domain.com/subscription/callback',
      });
      // User will be redirected to Paystack, then to callback_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleSubscribe} disabled={loading}>
        {loading ? 'Processing...' : 'Subscribe Now'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

## How It Works

1. **User clicks subscribe** → Frontend calls `subscribe()` or `initializeSubscription()`
2. **Service calls Paystack API** → Directly calls `/transaction/initialize` with plan using secret key
3. **User redirected** → User is redirected to Paystack payment page
4. **Payment completion** → User is redirected back to your callback URL (if configured)
5. **Verify and save** → Call `handleSubscriptionCallback()` or `verifyAndSaveSubscription()` to save to subscription tables

## Important: Handling the Callback

After payment, you **must** verify the transaction and save it to the subscription tables. The service provides two ways to do this:

### Option 1: Handle Callback URL (Recommended)

When Paystack redirects back to your callback URL, handle it like this:

```typescript
import { handleSubscriptionCallback } from '@/lib/paystackSubscriptionService';
import { useEffect } from 'react';

function SubscriptionCallbackPage() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = await handleSubscriptionCallback(window.location.search);
        if (result.success) {
          // Redirect to success page
          window.location.href = '/subscription/success';
        }
      } catch (error) {
        console.error('Subscription verification failed:', error);
        // Redirect to error page
        window.location.href = '/subscription/error';
      }
    };

    handleCallback();
  }, []);

  return <div>Processing subscription...</div>;
}
```

### Option 2: Verify Manually

If you have the reference from elsewhere:

```typescript
import { verifyAndSaveSubscription } from '@/lib/paystackSubscriptionService';

// After payment success
const result = await verifyAndSaveSubscription(reference);
if (result.success) {
  console.log('Subscription saved:', result.subscriptionCode);
}
```

## API Reference

### `initializeSubscription(params?)`

Initializes a Paystack subscription transaction.

**Parameters:**
- `params.email` (optional) - Customer email (defaults to authenticated user's email)
- `params.amount` (optional) - Amount in kobo as string or number (e.g., "500000")
- `params.plan` (optional) - Plan code (defaults to `PAYSTACK_PLAN_ID` from env)
- `params.callback_url` (optional) - Callback URL after payment

**Returns:** Promise with `{ authorization_url, access_code, reference }`

**Throws:** Error if initialization fails

### `redirectToPaystack(authorizationUrl)`

Redirects the user to Paystack payment page.

**Parameters:**
- `authorizationUrl` - The authorization URL from `initializeSubscription`

### `verifyAndSaveSubscription(reference)`

Verifies a Paystack transaction and saves it to subscription tables.

**Parameters:**
- `reference` - Transaction reference from Paystack

**Returns:** Promise with `{ success: boolean, subscriptionCode?: string }`

**Throws:** Error if verification fails or transaction is not a subscription

### `handleSubscriptionCallback(searchParams)`

Handles Paystack callback URL and verifies/saves subscription.

**Parameters:**
- `searchParams` - URL search params (string or URLSearchParams object)

**Returns:** Promise with `{ success: boolean, subscriptionCode?: string }`

**Throws:** Error if reference not found or verification fails

### `subscribe(params?)`

Convenience function that initializes and redirects in one call.

**Parameters:** Same as `initializeSubscription`

**Note:** After payment, you must call `handleSubscriptionCallback()` or `verifyAndSaveSubscription()` to save the subscription to the database.

## Security Notes

⚠️ **Important**: This implementation uses the Paystack secret key in the frontend, which means:
- The secret key will be included in your JavaScript bundle
- Anyone can view it in the browser's developer tools
- This is acceptable for development but not recommended for production

**For Production**: Consider implementing a backend API endpoint that:
- Keeps the secret key server-side
- Handles the Paystack API calls
- Returns only the authorization URL to the frontend

## Next Steps

After payment completion, you should:

1. **Verify the transaction** - Use Paystack webhooks or verify the transaction reference
2. **Update user subscription** - Update your database with subscription status
3. **Handle renewals** - Set up webhooks to handle subscription renewals automatically

See `docs/PAYSTACK_SUBSCRIPTIONS.md` for more details on handling recurring subscriptions.
