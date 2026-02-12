/**
 * Global subscription callback handler
 * Runs on ANY page when Paystack redirects back with a reference parameter
 * This ensures verification happens regardless of which page Paystack redirects to
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { handleSubscriptionCallback } from '@/lib/paystackSubscriptionService';
import { supabase } from '@/lib/supabaseClient';

export function SubscriptionCallbackHandler() {
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      // Check if we've already processed this callback
      const processedKey = `subscription_processed_${location.search}`;
      if (sessionStorage.getItem(processedKey)) {
        console.log('[Global Callback] Already processed this callback');
        return;
      }

      const urlParams = new URLSearchParams(location.search);
      const reference = urlParams.get('reference') || urlParams.get('trxref');

      if (!reference) {
        return; // No reference, not a subscription callback
      }

      if (isProcessing || hasProcessed) {
        return; // Already processing
      }

      console.log('[Global Callback] ========================================');
      console.log('[Global Callback] SUBSCRIPTION CALLBACK DETECTED');
      console.log('[Global Callback] Reference:', reference);
      console.log('[Global Callback] Current path:', location.pathname);
      console.log('[Global Callback] ========================================');

      setIsProcessing(true);

      try {
        // Wait a bit for session to restore after redirect
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[Global Callback] Starting verification...');
        const result = await handleSubscriptionCallback(location.search);
        
        console.log('[Global Callback] ✅ Verification successful:', result);
        
        // Mark as processed to prevent duplicate processing
        sessionStorage.setItem(processedKey, 'true');
        setHasProcessed(true);

        console.log('[Global Callback] ✅ Subscription activated successfully!');
        console.log('[Global Callback] Refreshing page to update UI...');
        
        // Refresh the whole page to ensure UI updates with new subscription status
        // Small delay to ensure database operations complete
        setTimeout(() => {
          window.location.href = window.location.pathname; // Refresh current page without query params
        }, 500);
        
      } catch (error: any) {
        console.error('[Global Callback] ❌ Verification failed:', error);
        console.error('[Global Callback] Error details:', {
          message: error.message,
          stack: error.stack,
        });
        
        // Don't mark as processed on error - allow retry
        alert(`Subscription verification failed: ${error.message}\n\nYour payment was successful. Please contact support with reference: ${reference}`);
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [location.search, isProcessing, hasProcessed]);

  // Show loading indicator while processing
  if (isProcessing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Processing Subscription</h3>
            <p className="text-sm text-gray-600">Please wait while we verify your payment...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
