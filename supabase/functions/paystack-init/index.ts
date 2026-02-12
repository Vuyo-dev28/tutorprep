import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const termAmount = Deno.env.get("PAYSTACK_TERM_AMOUNT") ?? "";
const paystackPlanCode = Deno.env.get("PAYSTACK_PLAN_CODE") ?? "";
const termPlanCode1 = Deno.env.get("PAYSTACK_PLAN_CODE_TERM_1") ?? "";
const termPlanCode2 = Deno.env.get("PAYSTACK_PLAN_CODE_TERM_2") ?? "";
const termPlanCode3 = Deno.env.get("PAYSTACK_PLAN_CODE_TERM_3") ?? "";
const termPlanCode4 = Deno.env.get("PAYSTACK_PLAN_CODE_TERM_4") ?? "";
const termAmount1 = Deno.env.get("PAYSTACK_TERM_AMOUNT_1") ?? "";
const termAmount2 = Deno.env.get("PAYSTACK_TERM_AMOUNT_2") ?? "";
const termAmount3 = Deno.env.get("PAYSTACK_TERM_AMOUNT_3") ?? "";
const termAmount4 = Deno.env.get("PAYSTACK_TERM_AMOUNT_4") ?? "";
const paystackCallback = Deno.env.get("PAYSTACK_CALLBACK_URL") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Supabase env not configured");
    }
    if (!paystackSecret) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }
    if (!termAmount && !termAmount1 && !termAmount2 && !termAmount3 && !termAmount4) {
      throw new Error("PAYSTACK_TERM_AMOUNT not configured");
    }

    const { term_number, curriculum, callback_url } = await req.json();
    if (!term_number || !curriculum) {
      throw new Error("Missing term_number or curriculum");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      throw new Error("Unauthorized");
    }

    const email = userData.user.email;
    if (!email) {
      throw new Error("User email not available");
    }

    const amountByTerm = (term: number) => {
      const value = term === 1 ? termAmount1 : term === 2 ? termAmount2 : term === 3 ? termAmount3 : term === 4 ? termAmount4 : "";
      return value || termAmount;
    };
    const planByTerm = (term: number) => {
      const value = term === 1 ? termPlanCode1 : term === 2 ? termPlanCode2 : term === 3 ? termPlanCode3 : term === 4 ? termPlanCode4 : "";
      return value || paystackPlanCode;
    };

    const amountStr = amountByTerm(Number(term_number));
    const amount = parseInt(amountStr, 10);
    if (!Number.isFinite(amount)) {
      throw new Error("PAYSTACK_TERM_AMOUNT must be an integer amount in kobo");
    }
    const planCode = planByTerm(Number(term_number));

    const callbackUrl = callback_url || paystackCallback;
    if (!callbackUrl) {
      throw new Error("Callback URL not configured");
    }

    const initBody: Record<string, unknown> = {
      email,
      amount,
      currency: "ZAR",
      callback_url: callbackUrl,
      metadata: {
        user_id: userData.user.id,
        term_number,
        curriculum,
      },
    };

    if (planCode) {
      initBody.plan = planCode;
    }

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });

    const initJson = await initResponse.json();
    if (!initResponse.ok || !initJson?.status) {
      throw new Error(initJson?.message || "Failed to initialize Paystack");
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    await service.from("past_paper_payments").insert({
      user_id: userData.user.id,
      term_number,
      curriculum,
      reference: initJson.data.reference,
      amount,
      currency: "ZAR",
      status: "initialized",
    });

    return new Response(JSON.stringify(initJson.data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
