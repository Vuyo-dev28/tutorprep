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

    const { reference } = await req.json();
    if (!reference) {
      throw new Error("Missing reference");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      throw new Error("Unauthorized");
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });
    const verifyJson = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyJson?.status) {
      throw new Error(verifyJson?.message || "Failed to verify Paystack payment");
    }

    const data = verifyJson.data;
    if (data.status !== "success") {
      throw new Error("Payment not successful");
    }

    const metadata = data.metadata || {};
    const term_number = metadata.term_number;
    const curriculum = metadata.curriculum;
    const user_id = metadata.user_id;
    if (!term_number || !curriculum || !user_id) {
      throw new Error("Missing metadata in Paystack response");
    }
    if (user_id !== userData.user.id) {
      throw new Error("User mismatch");
    }

    const amountByTerm = (term: number) => {
      const value = term === 1 ? termAmount1 : term === 2 ? termAmount2 : term === 3 ? termAmount3 : term === 4 ? termAmount4 : "";
      return value || termAmount;
    };
    const planByTerm = (term: number) => {
      const value = term === 1 ? termPlanCode1 : term === 2 ? termPlanCode2 : term === 3 ? termPlanCode3 : term === 4 ? termPlanCode4 : "";
      return value || paystackPlanCode;
    };

    const expectedAmount = parseInt(amountByTerm(Number(term_number)), 10);
    const expectedPlan = planByTerm(Number(term_number));
    if (!expectedPlan && Number.isFinite(expectedAmount) && data.amount !== expectedAmount) {
      throw new Error("Payment amount mismatch");
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    await service.from("past_paper_payments")
      .update({
        status: "success",
        subscription_code: data.subscription?.subscription_code ?? null,
        customer_code: data.customer?.customer_code ?? null,
        authorization_code: data.authorization?.authorization_code ?? null,
      })
      .eq("reference", reference);

    await service.from("past_paper_term_access")
      .upsert({
        user_id,
        term_number,
        curriculum,
      }, { onConflict: "user_id,term_number,curriculum" });

    return new Response(JSON.stringify({ status: "success" }), {
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
