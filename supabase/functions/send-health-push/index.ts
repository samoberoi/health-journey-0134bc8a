import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") ?? "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") ?? "";
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY") ?? "";
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "app.lovable.byebyediabetes";
const APNS_ENVIRONMENT = (Deno.env.get("APNS_ENVIRONMENT") ?? "sandbox").toLowerCase();

type ApnsAttempt = {
  ok: boolean;
  status: number;
  environment: "sandbox" | "production";
  response: Record<string, unknown> | null;
};

type PushBody = {
  title?: unknown;
  body?: unknown;
  actionUrl?: unknown;
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedJwt: { token: string; exp: number } | null = null;

async function createApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - 60 > now) return cachedJwt.token;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(APNS_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = base64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const claims = base64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, exp: now + 45 * 60 };
  return token;
}

function validText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > max) return null;
  return clean;
}

function parseApnsResponse(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function apnsHosts(): Array<{ environment: "sandbox" | "production"; host: string }> {
  const production = { environment: "production" as const, host: "api.push.apple.com" };
  const sandbox = { environment: "sandbox" as const, host: "api.sandbox.push.apple.com" };
  return APNS_ENVIRONMENT === "production" ? [production, sandbox] : [sandbox, production];
}

async function sendApnsAttempt(token: string, jwt: string, payload: Record<string, unknown>, target: { environment: "sandbox" | "production"; host: string }): Promise<ApnsAttempt> {
  const res = await fetch(`https://${target.host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, environment: target.environment, response: parseApnsResponse(text) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
      return json(503, { ok: false, error: "APNs credentials are not configured yet" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json(401, { ok: false, error: "Missing auth token" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(bearer);
    if (userError || !userData.user) return json(401, { ok: false, error: "Invalid auth token" });

    const raw = (await req.json().catch(() => null)) as PushBody | null;
    const title = validText(raw?.title, 120);
    const body = validText(raw?.body, 500);
    const actionUrl = typeof raw?.actionUrl === "string" ? raw.actionUrl.slice(0, 240) : "/home?tab=profile";
    if (!title || !body) return json(400, { ok: false, error: "Title and body are required" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tokens, error: tokenError } = await admin
      .from("device_push_tokens")
      .select("id, token, platform")
      .eq("user_id", userData.user.id)
      .eq("platform", "ios");

    if (tokenError) throw tokenError;
    if (!tokens?.length) return json(200, { ok: true, sent: 0, note: "No iOS device token registered" });

    const jwt = await createApnsJwt();
    const hosts = apnsHosts();
    const payload = {
      aps: {
        alert: { title, body },
        sound: "default",
        badge: 1,
        "interruption-level": "time-sensitive",
        "relevance-score": 1,
      },
      action_url: actionUrl,
      type: "health_alert",
    };

    const results = await Promise.all((tokens as Array<{ id: string; token: string }>).map(async (row) => {
      const attempts: ApnsAttempt[] = [];
      const first = await sendApnsAttempt(row.token, jwt, payload, hosts[0]);
      attempts.push(first);

      const firstReason = typeof first.response?.reason === "string" ? first.response.reason : "";
      if (!first.ok && firstReason === "BadDeviceToken") {
        attempts.push(await sendApnsAttempt(row.token, jwt, payload, hosts[1]));
      }

      const success = attempts.find((attempt) => attempt.ok);
      const last = attempts[attempts.length - 1];
      const lastReason = typeof last.response?.reason === "string" ? last.response.reason : "";
      if (!success && (last.status === 410 || lastReason === "Unregistered" || (lastReason === "BadDeviceToken" && attempts.length > 1))) {
        await admin.from("device_push_tokens").delete().eq("id", row.id);
      }
      console.log("APNs push attempt", { ok: Boolean(success), attempts: attempts.map((a) => ({ status: a.status, environment: a.environment, reason: a.response?.reason ?? null })) });
      return { ok: Boolean(success), status: success?.status ?? last.status, environment: success?.environment ?? last.environment, response: success?.response ?? last.response, attempts };
    }));

    return json(200, {
      ok: results.some((r) => r.ok),
      sent: results.filter((r) => r.ok).length,
      attempted: results.length,
      environment: APNS_ENVIRONMENT,
      results,
    });
  } catch (error) {
    console.error("send-health-push error", error);
    return json(500, { ok: false, error: (error as Error).message });
  }
});
