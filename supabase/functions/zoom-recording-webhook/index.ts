import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Zoom sends a validation challenge on webhook setup
    if (body.event === "endpoint.url_validation") {
      const crypto = globalThis.crypto;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(Deno.env.get("ZOOM_WEBHOOK_SECRET") || ""),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body.payload.plainToken));
      const hashHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

      return new Response(JSON.stringify({
        plainToken: body.payload.plainToken,
        encryptedToken: hashHex,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle recording completed event
    if (body.event === "recording.completed") {
      const meetingId = String(body.payload?.object?.id);
      const recordingFiles = body.payload?.object?.recording_files || [];

      // Find the shared screen or active speaker recording (MP4)
      const mp4Recording = recordingFiles.find(
        (f: any) => f.file_type === "MP4" && f.status === "completed"
      );

      if (!mp4Recording || !meetingId) {
        console.log("No MP4 recording found or no meeting ID");
        return new Response(JSON.stringify({ status: "skipped" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build the recording play URL
      const recordingUrl = mp4Recording.play_url || mp4Recording.download_url;

      if (!recordingUrl) {
        console.log("No recording URL available");
        return new Response(JSON.stringify({ status: "no_url" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update booking with recording URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
        .from("bookings")
        .update({ recording_url: recordingUrl })
        .eq("zoom_meeting_id", meetingId);

      if (error) {
        console.error("Error updating booking with recording URL:", error);
        throw error;
      }

      console.log(`Recording URL saved for meeting ${meetingId}`);
      return new Response(JSON.stringify({ status: "saved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ignored" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
