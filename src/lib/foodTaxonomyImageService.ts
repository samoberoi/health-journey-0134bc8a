import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const MAX_W = 800;
const MAX_H = 800;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

async function compress(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const sw = img.naturalWidth || MAX_W;
  const sh = img.naturalHeight || MAX_H;
  const scale = Math.min(1, MAX_W / sw, MAX_H / sh);
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, tw, th);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", 0.82);
  });
}

async function uploadTo(folder: string, entityId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
  const safeId = (entityId || "new").replace(/[^a-zA-Z0-9_-]/g, "-");
  const blob = await compress(file);
  const path = `${folder}/${safeId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false, contentType: "image/jpeg", cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function uploadCategoryImage(id: string, file: File) {
  return uploadTo("food-taxonomy/categories", id, file);
}
export function uploadFilterImage(id: string, file: File) {
  return uploadTo("food-taxonomy/filters", id, file);
}
