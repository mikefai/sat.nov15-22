import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let passcode = "";
    try {
      const body = (await req.json()) as { passcode?: string };
      passcode = (body.passcode ?? "").trim();
    } catch {
      passcode = "";
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: cfgRow } = await adminClient
      .from("instructor_auth_config")
      .select("primary_email")
      .eq("id", 1)
      .maybeSingle();

    const primaryEmail = (cfgRow?.primary_email ?? "mikeperac@gmail.com").trim().toLowerCase();
    const emailNormalized = (user.email ?? "").trim().toLowerCase();
    const isConfirmedAllowlistedEmail =
      Boolean(user.email_confirmed_at) && emailNormalized === primaryEmail;

    let isPasscodeMatch = false;
    if (passcode.length > 0) {
      const { data: verified } = await adminClient.rpc("verify_instructor_passcode", {
        p_passcode: passcode,
      });
      isPasscodeMatch = Boolean(verified);
    }

    if (!isConfirmedAllowlistedEmail && !isPasscodeMatch) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid Instructor Access Code." }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { error: upsertErr } = await adminClient.from("admin_users").upsert(
      {
        user_id: user.id,
        reason: isConfirmedAllowlistedEmail ? "email_allowlist" : "instructor_passcode",
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      return new Response(JSON.stringify({ ok: false, error: upsertErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unexpected server error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
