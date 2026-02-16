import { supabase } from "@/integrations/supabase/client";

/**
 * Request camera permission on Android WebView (Median.co).
 * Must be called from a user gesture (click/tap) before showing a file input.
 * This ensures the camera option appears in the Android file picker.
 * Silently ignored on browsers that don't need it.
 */
export async function requestCameraPermission(): Promise<void> {
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop tracks immediately – we only needed the permission prompt
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch {
    // Permission denied or not available – that's fine, file picker still works for gallery
    console.log("Camera permission not granted or not available");
  }
}

/**
 * Sanitise a filename coming from a WebView file picker.
 * Some Android WebViews return empty or garbage names.
 */
function safeFileName(file: File): string {
  const name = file.name;
  if (name && name !== "undefined" && name !== "null" && name.length > 0) {
    // Remove problematic characters
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  // Fallback: derive extension from MIME type
  const ext = (file.type || "application/octet-stream").split("/").pop() || "bin";
  return `file_${Date.now()}.${ext}`;
}

/**
 * Read a File into a Uint8Array using FileReader (maximum WebView compat).
 * Falls back to file.arrayBuffer() if FileReader is unavailable.
 */
function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result));
        } else {
          reject(new Error("FileReader did not return ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
      reader.readAsArrayBuffer(file);
    } else if (typeof file.arrayBuffer === "function") {
      file.arrayBuffer().then(ab => resolve(new Uint8Array(ab)), reject);
    } else {
      reject(new Error("No method available to read file"));
    }
  });
}

/**
 * Upload a file to Supabase Storage in a way that works reliably
 * on Android WebViews (Median.co / GoNative).
 *
 * 1. Reads via FileReader (broadest WebView support)
 * 2. Sanitises filename to avoid encoding issues
 * 3. Provides a safe content-type fallback
 */
export async function uploadFileCompat(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ publicUrl: string }> {
  // Read file content
  const uint8 = await readFileAsUint8Array(file);

  // Determine a safe content type
  const contentType = file.type && file.type.length > 0
    ? file.type
    : "application/octet-stream";

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, uint8, {
      contentType,
      upsert: options?.upsert ?? false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { publicUrl };
}

/**
 * Helper to build a safe storage path for receipt uploads.
 * Handles cases where file.name is undefined/empty on Android WebView.
 */
export function buildReceiptPath(userId: string, file: File): string {
  return `${userId}/${Date.now()}-${safeFileName(file)}`;
}
