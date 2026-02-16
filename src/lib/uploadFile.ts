import { supabase } from "@/integrations/supabase/client";

/**
 * Read a File into a Uint8Array using FileReader (maximum WebView compat).
 * Falls back to file.arrayBuffer() if FileReader is unavailable.
 */
function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // Prefer FileReader – works in every WebView including Median.co / GoNative
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
 * on Android WebViews (Median.co / GoNative) by reading the File
 * via FileReader first, then uploading the resulting Uint8Array.
 */
export async function uploadFileCompat(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ publicUrl: string }> {
  const uint8 = await readFileAsUint8Array(file);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, uint8, {
      contentType: file.type || "application/octet-stream",
      upsert: options?.upsert ?? false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { publicUrl };
}
