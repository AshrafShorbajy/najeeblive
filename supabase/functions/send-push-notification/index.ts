import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert VAPID key from URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Import the VAPID private key for signing
async function importVapidKey(privateKeyBase64: string): Promise<CryptoKey> {
  const rawKey = urlBase64ToUint8Array(privateKeyBase64);
  return await crypto.subtle.importKey(
    "pkcs8",
    rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// Send a single push notification using the Web Push protocol
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    // For Web Push, we need to use the web-push library approach
    // Since we're in Deno, we'll use fetch with the proper headers
    
    // Create JWT for VAPID
    const audience = new URL(subscription.endpoint).origin;
    const vapidHeaders = await createVapidHeaders(
      audience,
      "mailto:admin@sudtutor.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        ...vapidHeaders,
        "Content-Type": "application/octet-stream",
        TTL: "86400",
      },
      body: payload,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid
      return false;
    }

    const text = await response.text();
    console.log(`Push response: ${response.status} ${text}`);
    return response.ok;
  } catch (error) {
    console.error("Error sending push:", error);
    return false;
  }
}

async function createVapidHeaders(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
) {
  // Create a simple JWT for VAPID authentication
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encodeBase64Url = (data: string) =>
    btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = encodeBase64Url(JSON.stringify(header));
  const payloadB64 = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const privateKeyBytes = urlBase64ToUint8Array(privateKey);
  
  // The private key is 32 bytes raw - need to wrap in PKCS8
  const pkcs8 = new Uint8Array(138);
  pkcs8.set([
    48, 129, 135, 2, 1, 0, 48, 19, 6, 7, 42, 134, 72, 206, 61, 2, 1,
    6, 8, 42, 134, 72, 206, 61, 3, 1, 7, 4, 109, 48, 107, 2, 1, 1,
    4, 32,
  ]);
  pkcs8.set(privateKeyBytes, 36);
  pkcs8.set([
    161, 68, 3, 66, 0, 4,
  ], 68);
  
  // Decode public key
  const publicKeyBytes = urlBase64ToUint8Array(publicKey);
  pkcs8.set(publicKeyBytes.slice(1), 74); // skip the 0x04 prefix if present

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } catch {
    // Fallback: try raw import
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      privateKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  }

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s)
  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    // DER encoded - parse it
    rawSig = derToRaw(sigArray);
  }

  const signatureB64 = encodeBase64Url(
    String.fromCharCode(...rawSig)
  );
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    Authorization: `vapid t=${jwt}, k=${publicKey}`,
  };
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  // DER format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
  let offset = 2; // skip 0x30 and total length
  // Skip 0x02
  offset += 1;
  const rLen = der[offset];
  offset += 1;
  const rStart = rLen === 33 ? offset + 1 : offset;
  raw.set(der.slice(rStart, rStart + 32), 0);
  offset += rLen;
  // Skip 0x02
  offset += 1;
  const sLen = der[offset];
  offset += 1;
  const sStart = sLen === 33 ? offset + 1 : offset;
  raw.set(der.slice(sStart, sStart + 32), 32);
  return raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, user_id, sender_id, conversation_id, student_id, teacher_id, title, body } =
      await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine target user IDs
    let targetUserIds: string[] = [];

    if (type === "new_message" && sender_id && conversation_id) {
      // Get conversation participants, notify the one who didn't send
      const { data: conv } = await supabase
        .from("conversations")
        .select("student_id, teacher_id")
        .eq("id", conversation_id)
        .single();

      if (conv) {
        const recipientId =
          conv.student_id === sender_id ? conv.teacher_id : conv.student_id;
        targetUserIds = [recipientId];
      }
    } else if (type === "invoice_approved" && student_id && teacher_id) {
      targetUserIds = [student_id, teacher_id];
    } else if (user_id) {
      targetUserIds = [user_id];
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "إشعار جديد",
      body: body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { type, url: "/" },
    });

    let sent = 0;
    const expiredIds: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey
      );
      if (success) {
        sent++;
      } else {
        expiredIds.push(sub.id);
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(JSON.stringify({ sent, expired: expiredIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
