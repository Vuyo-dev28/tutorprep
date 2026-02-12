/**
 * Paystack Subscription Service
 * Handles subscription initialization using Paystack's transaction/initialize endpoint
 * 
 * ⚠️ SECURITY WARNING: This implementation uses the secret key in the frontend.
 * For production, consider using a backend API to keep the secret key secure.
 */

import { supabase } from './supabaseClient';

export interface SubscriptionInitParams {
  email?: string;
  amount?: string | number; // Amount in kobo (e.g., "500000" for 5000.00)
  plan?: string; // Plan code (e.g., "PLN_xxxx") - defaults to VITE_PAYSTACK_PLAN_ID from env
  callback_url?: string; // Optional callback URL
  plan_type?: 'monthly' | 'yearly'; // Plan type for database tracking
  curriculum?: 'CAPS' | 'IEB'; // Curriculum for database tracking
}

export interface SubscriptionInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Initialize a Paystack subscription transaction
 * Calls Paystack API directly from the frontend
 * 
 * @param params - Subscription initialization parameters
 * @returns Promise with the Paystack initialization response
 */
export async function initializeSubscription(
  params: SubscriptionInitParams = {}
): Promise<SubscriptionInitResponse> {
  // Get Paystack secret key from environment
  const paystackSecretKey = (import.meta as any).env.VITE_PAYSTACK_SECRET_KEY as string | undefined;
  if (!paystackSecretKey) {
    throw new Error('VITE_PAYSTACK_SECRET_KEY is not configured');
  }

  // Use explicit plan ID or from params/environment
  const planId = params.plan || ((import.meta as any).env.VITE_PAYSTACK_PLAN_ID as string | undefined) || 'PLN_3pankare3c1yee8';
  if (!planId) {
    throw new Error('Plan ID is required. Provide it in params or set VITE_PAYSTACK_PLAN_ID');
  }

  // Get user email if not provided
  let email = params.email;
  if (!email && supabase) {
    console.log('[Subscribe] Getting user email from Supabase...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[Subscribe] Error getting user:', userError);
    }
    email = user?.email || undefined;
    console.log('[Subscribe] User email:', email);
  }

  if (!email) {
    console.error('[Subscribe] ERROR: Email is required');
    throw new Error('Email is required. User must be authenticated or email must be provided');
  }

  // Get user ID for metadata
  let userId: string | undefined;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    console.log('[Subscribe] User ID:', userId);
  }

  // Prepare request body
  const requestBody: Record<string, unknown> = {
    email,
    plan: planId,
    metadata: {
      user_id: userId,
      plan_type: params.plan_type || 'monthly',
      curriculum: params.curriculum,
      is_subscription: true,
    },
  };

  // Add amount if provided
  // Note: Some Paystack plans are flexible and require an amount to be sent
  // If the plan has a fixed amount, Paystack will use the plan's amount and ignore this
  // If the plan is flexible, this amount is required
  if (params.amount) {
    requestBody.amount = typeof params.amount === 'string' 
      ? parseInt(params.amount, 10) 
      : params.amount;
    console.log('[Subscribe] Amount included:', requestBody.amount);
  } else {
    console.log('[Subscribe] No amount provided, using plan amount');
  }

  // Add callback URL if provided
  if (params.callback_url) {
    requestBody.callback_url = params.callback_url;
    console.log('[Subscribe] Callback URL:', params.callback_url);
  } else {
    console.log('[Subscribe] No callback URL provided');
  }

  console.log('[Subscribe] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Subscribe] Calling Paystack API: POST /transaction/initialize');

  // Call Paystack API
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  console.log('[Subscribe] Paystack response status:', response.status, response.statusText);

  const data = await response.json();
  console.log('[Subscribe] Paystack response data:', data);

  if (!response.ok || !data.status) {
    // Log the full error for debugging
    console.error('[Subscribe] Paystack API Error:', {
      status: response.status,
      statusText: response.statusText,
      message: data.message,
      errors: data.errors,
      requestBody: requestBody,
    });
    throw new Error(data.message || 'Failed to initialize Paystack subscription');
  }

  if (!data.data?.authorization_url || !data.data?.reference) {
    console.error('[Subscribe] ERROR: Invalid response from Paystack - missing authorization_url or reference');
    console.error('[Subscribe] Response data:', data.data);
    throw new Error('Invalid response from Paystack');
  }

  console.log('[Subscribe] Success! Authorization URL:', data.data.authorization_url);
  console.log('[Subscribe] Reference:', data.data.reference);
  console.log('[Subscribe] ===== Subscription initialization complete =====');

  return {
    authorization_url: data.data.authorization_url,
    access_code: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Redirect user to Paystack payment page
 * After successful payment, user will be redirected to the callback URL
 * 
 * @param authorizationUrl - The authorization URL from initializeSubscription
 */
export function redirectToPaystack(authorizationUrl: string): void {
  console.log('[Subscribe] Redirecting to Paystack:', authorizationUrl);
  if (typeof window !== 'undefined') {
    window.location.href = authorizationUrl;
  }
}

/**
 * Verify a Paystack transaction and save it as a subscription
 * Call this after payment is successful (e.g., in callback URL handler)
 * 
 * @param reference - Transaction reference from Paystack
 * @returns Promise with verification result
 */
/**
 * Wait for user session to be ready after redirect
 * This is critical because Paystack redirect can happen before session restores
 */
async function waitForUserSession(maxAttempts = 10, delayMs = 500): Promise<{ id: string; email: string | undefined }> {
  console.log('[Subscription] Waiting for user session to be ready...');
  
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  for (let i = 0; i < maxAttempts; i++) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user && !error) {
      console.log(`[Subscription] ✅ User session ready after ${i + 1} attempt(s):`, user.id);
      return { id: user.id, email: user.email };
    }
    
    if (i < maxAttempts - 1) {
      console.log(`[Subscription] Session not ready, attempt ${i + 1}/${maxAttempts}, waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error('User session not ready after redirect. Please refresh the page.');
}

export async function verifyAndSaveSubscription(
  reference: string
): Promise<{ 
  success: boolean; 
  subscriptionCode?: string;
  customerCode?: string;
  authorizationCode?: string;
}> {
  console.log('[Subscription] ========================================');
  console.log('[Subscription] Starting verification for reference:', reference);
  console.log('[Subscription] ========================================');
  
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const paystackSecretKey = (import.meta as any).env.VITE_PAYSTACK_SECRET_KEY as string | undefined;
  if (!paystackSecretKey) {
    throw new Error('VITE_PAYSTACK_SECRET_KEY is not configured');
  }

  // CRITICAL: Wait for user session to be ready after Paystack redirect
  console.log('[Subscription] Step 1: Waiting for user session...');
  const user = await waitForUserSession();
  console.log('[Subscription] ✅ User session ready:', user.id, user.email);
  

  // Verify transaction with Paystack
  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const verifyData = await verifyResponse.json();
  console.log('[Subscription] Paystack verification response:', verifyData);

  if (!verifyResponse.ok || !verifyData.status) {
    console.error('[Subscription] Verification failed:', verifyData);
    throw new Error(verifyData.message || 'Failed to verify transaction');
  }

  const transaction = verifyData.data;
  console.log('[Subscription] Transaction data:', {
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    subscription: transaction.subscription,
    metadata: transaction.metadata,
    customer: transaction.customer,
  });

  if (transaction.status !== 'success') {
    console.error('[Subscription] Transaction not successful:', transaction.status);
    throw new Error(`Payment was not successful. Status: ${transaction.status}`);
  }

  // Check if this is a subscription transaction
  const metadata = transaction.metadata || {};
  const isSubscription = metadata.is_subscription === true || transaction.subscription;
  console.log('[Subscription] Is subscription?', isSubscription, 'Metadata:', metadata);

  if (!isSubscription) {
    console.warn('[Subscription] Transaction is not marked as subscription, but continuing...');
    // Don't throw - allow it to proceed as subscription might be created by plan
  }

  // Extract subscription information
  const subscriptionCode = transaction.subscription?.subscription_code;
  const customerCode = transaction.customer?.customer_code;
  const authorizationCode = transaction.authorization?.authorization_code;
  const planType = metadata.plan_type || 'monthly';
  const curriculum = metadata.curriculum;

  // Calculate period end based on plan type
  const periodEnd = new Date();
  if (planType === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Ensure curriculum is valid - table requires NOT NULL, so default to CAPS if missing
  const validCurriculum = (curriculum === 'CAPS' || curriculum === 'IEB') 
    ? curriculum 
    : 'CAPS'; // Default to CAPS if not provided (table requires NOT NULL)

  // Ensure plan type is valid
  const validPlanType = (planType === 'monthly' || planType === 'yearly') 
    ? planType 
    : 'monthly';

  console.log('[Subscription] ===== Starting database updates =====');
  console.log('[Subscription] Data to save:', {
    user_id: user.id,
    plan: validPlanType,
    curriculum: validCurriculum,
    reference: reference,
    amount: transaction.amount,
    period_end: periodEnd.toISOString(),
  });

  // CRITICAL: Verify user session is still valid before database operations
  console.log('[Subscription] Step 3: Verifying user session before database operations...');
  const { data: { user: verifyUser }, error: verifyError } = await supabase.auth.getUser();
  if (verifyError || !verifyUser || verifyUser.id !== user.id) {
    console.error('[Subscription] ❌ User session invalid during database update');
    console.error('[Subscription] Expected user:', user.id);
    console.error('[Subscription] Got user:', verifyUser?.id);
    throw new Error('User session expired during update. Please refresh and contact support with reference: ' + reference);
  }
  console.log('[Subscription] ✅ User session verified:', verifyUser.id);

  // Update tables the same way as term purchases - simple insert/upsert pattern
  // 1. Save to subscription payments table (same pattern as past_paper_payments.insert)
  console.log('[Subscription] Step 1: Inserting payment record...');
  console.log('[Subscription] RLS Check: auth.uid() should equal', user.id);
  
  const { data: paymentData, error: paymentError } = await supabase
    .from('past_paper_subscription_payments')
    .insert({
      user_id: user.id,
      plan: validPlanType,
      curriculum: validCurriculum,
      reference: reference,
      amount: transaction.amount,
      currency: transaction.currency || 'ZAR',
      status: 'success',
    })
    .select();

  if (paymentError) {
    console.error('[Subscription] ❌ Payment insert FAILED:', paymentError);
    console.error('[Subscription] Error code:', paymentError.code);
    console.error('[Subscription] Error details:', paymentError.details);
    console.error('[Subscription] Error hint:', paymentError.hint);
    console.error('[Subscription] Current auth.uid():', (await supabase.auth.getUser()).data.user?.id);
    console.error('[Subscription] Attempted user_id:', user.id);
    
    // Check if it's an RLS policy issue
    if (paymentError.code === '42501' || paymentError.message?.includes('permission') || paymentError.message?.includes('policy')) {
      throw new Error(`RLS Policy Error: ${paymentError.message}. Check that 'Users can insert own subscription payments' policy allows inserts for user_id = auth.uid()`);
    }
    
    throw new Error(`Failed to save payment: ${paymentError.message} (Code: ${paymentError.code})`);
  }
  console.log('[Subscription] ✅ Payment saved successfully:', paymentData);

  // 2. Save/update subscription record (same pattern as past_paper_term_access.upsert)
  console.log('[Subscription] Step 2: Upserting subscription record...');
  console.log('[Subscription] RLS Check: auth.uid() should equal', user.id);
  
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from('past_paper_subscriptions')
    .upsert({
      user_id: user.id,
      curriculum: validCurriculum,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      paystack_subscription_code: subscriptionCode || null,
      paystack_customer_code: customerCode || null,
      updated_at: new Date().toISOString(),
    }, { 
      onConflict: 'user_id',
    })
    .select();

  if (subscriptionError) {
    console.error('[Subscription] ❌ Subscription upsert FAILED:', subscriptionError);
    console.error('[Subscription] Error code:', subscriptionError.code);
    console.error('[Subscription] Error details:', subscriptionError.details);
    console.error('[Subscription] Error hint:', subscriptionError.hint);
    console.error('[Subscription] Current auth.uid():', (await supabase.auth.getUser()).data.user?.id);
    console.error('[Subscription] Attempted user_id:', user.id);
    
    // Check if it's an RLS policy issue
    if (subscriptionError.code === '42501' || subscriptionError.message?.includes('permission') || subscriptionError.message?.includes('policy')) {
      throw new Error(`RLS Policy Error: ${subscriptionError.message}. Check that 'Users can insert own subscription' and 'Users can update own subscription' policies allow operations for user_id = auth.uid()`);
    }
    
    throw new Error(`Failed to save subscription: ${subscriptionError.message} (Code: ${subscriptionError.code})`);
  }
  console.log('[Subscription] ✅ Subscription saved successfully:', subscriptionData);
  console.log('[Subscription] ===== Database updates complete =====');

  return {
    success: true,
    subscriptionCode: subscriptionCode,
    customerCode: customerCode,
    authorizationCode: authorizationCode,
  };
}

/**
 * Handle Paystack callback after payment
 * Call this function when user returns from Paystack payment page
 * Extracts reference from URL and verifies/saves the subscription
 * 
 * @param searchParams - URL search params (e.g., from window.location.search or URLSearchParams)
 * @returns Promise with verification result
 */
export async function handleSubscriptionCallback(
  searchParams: URLSearchParams | string
): Promise<{ 
  success: boolean; 
  subscriptionCode?: string;
  customerCode?: string;
  authorizationCode?: string;
}> {
  // Parse search params if string
  const params = typeof searchParams === 'string' 
    ? new URLSearchParams(searchParams) 
    : searchParams;

  // Paystack uses both 'reference' and 'trxref' parameters
  const reference = params.get('reference') || params.get('trxref');
  console.log('[Subscription] Extracted reference from callback:', reference);
  console.log('[Subscription] All params:', Array.from(params.entries()));
  
  if (!reference) {
    throw new Error('No reference found in callback URL. Available params: ' + Array.from(params.keys()).join(', '));
  }

  return verifyAndSaveSubscription(reference);
}

/**
 * Complete subscription flow: initialize and redirect
 * 
 * @param params - Subscription initialization parameters
 */
export async function subscribe(params: SubscriptionInitParams = {}): Promise<void> {
  console.log('[Subscribe] ========================================');
  console.log('[Subscribe] SUBSCRIBE BUTTON CLICKED');
  console.log('[Subscribe] ========================================');
  try {
    const response = await initializeSubscription(params);
    console.log('[Subscribe] Initialization successful, redirecting...');
    redirectToPaystack(response.authorization_url);
  } catch (error: any) {
    console.error('[Subscribe] ERROR in subscribe function:', error);
    throw error;
  }
}
