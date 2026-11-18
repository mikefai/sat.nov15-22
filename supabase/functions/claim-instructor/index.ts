import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SHA-256 digest of the default Instructor Access Code (no plaintext secret stored in code)
const DEFAULT_PASSCODE_SHA256 =
  "981ee4bbbc91015966cdfad9a47a809f4c42e019e0ed5adfc859c8c4b0230262";
const PRIMARY_INSTRUCTOR_EMAIL = "mikeperac@gmail.com";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    const emailNormalized = (user.email ?? "").trim().toLowerCase();
    const isAllowlistedEmail = emailNormalized === PRIMARY_INSTRUCTOR_EMAIL;

    const customSecret = (Deno.env.get("INSTRUCTOR_ACCESS_CODE") ?? "").trim();
    let isPasscodeMatch = false;
    if (passcode.length > 0) {
      if (customSecret.length > 0) {
        isPasscodeMatch = passcode === customSecret;
      } else {
        const digest = await sha256Hex(passcode);
        isPasscodeMatch = digest === DEFAULT_PASSCODE_SHA256;
      }
    }

    if (!isAllowlistedEmail && !isPasscodeMatch) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid Instructor Access Code." }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertErr } = await adminClient.from("admin_users").upsert(
      {
        user_id: user.id,
        reason: isAllowlistedEmail ? "email_allowlist" : "instructor_passcode",
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
