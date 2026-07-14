import { supabase } from "@/integrations/supabase/client";

// Fast food image loader.
// - Signs storage URLs directly with built-in image transforms (resize + quality)
//   so the CDN serves an optimized thumbnail, not the full-res original.
// - Persists signed URLs to localStorage so repeat visits are instant.
// - Falls back to the generate-food-image edge function only when no image_url
//   exists on the row yet.

const BUCKET = "food-images";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CACHE_KEY = "food-img-cache-v2";
const SIZE = 320; // px — covers list thumbs (96-112px @ 3x) and detail hero (96px @ 3x)
const QUALITY = 72;

type Entry = { url: string; expires: number };

let mem: Record<string, Entry> | null = null;
function loadCache(): Record<string, Entry> {
  if (mem) return mem;
  try {
    mem = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch { mem = {}; }
  return mem!;
}
function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(mem || {})); } catch {}
}
function getFromCache(id: string): string | null {
  const c = loadCache();
  const e = c[id];
  if (e && e.expires > Date.now()) return e.url;
  return null;
}
function setInCache(id: string, url: string) {
  const c = loadCache();
  c[id] = { url, expires: Date.now() + (TTL_SECONDS - 60 * 60) * 1000 };
  saveCache();
}

const inflight = new Map<string, Promise<string | null>>();
const pathInflight = new Map<string, Promise<string | null>>(); // foodItemId -> path

async function fetchPath(foodItemId: string): Promise<string | null> {
  if (pathInflight.has(foodItemId)) return pathInflight.get(foodItemId)!;
  const p = (async () => {
    const { data } = await supabase
      .from("food_items")
      .select("image_url")
      .eq("id", foodItemId)
      .maybeSingle();
    return (data?.image_url as string | null) || null;
  })();
  pathInflight.set(foodItemId, p);
  return p;
}

async function signPath(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS, {
    transform: { width: SIZE, height: SIZE, resize: "cover", quality: QUALITY },
  });
  return data?.signedUrl || null;
}

async function generateViaEdge(foodItemId: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-food-image`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ food_item_id: foodItemId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.url as string) || null;
  } catch { return null; }
}

export function getFoodImageUrl(foodItemId: string): Promise<string | null> {
  const cached = getFromCache(foodItemId);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(foodItemId)) return inflight.get(foodItemId)!;

  const p = (async () => {
    const path = await fetchPath(foodItemId);
    if (path) {
      // Absolute URL (external CDN like Unsplash / loremflickr) — use as-is.
      if (/^https?:\/\//i.test(path)) { setInCache(foodItemId, path); return path; }
      const url = await signPath(path);
      if (url) { setInCache(foodItemId, url); return url; }
    }
    // No image yet — ask edge function to generate, then cache
    const url = await generateViaEdge(foodItemId);
    if (url) setInCache(foodItemId, url);
    return url;
  })();
  inflight.set(foodItemId, p);
  p.finally(() => inflight.delete(foodItemId));
  return p;
}

/** Batch-prime cache for a list of items (call once per visible list). */
export async function primeFoodImages(items: Array<{ id: string; image_url?: string | null }>) {
  const need: Array<{ id: string; path: string; absolute: boolean }> = [];
  for (const it of items) {
    if (getFromCache(it.id)) continue;
    if (it.image_url) need.push({ id: it.id, path: it.image_url, absolute: /^https?:\/\//i.test(it.image_url) });
  }
  if (!need.length) return;
  // Sign in parallel, capped at 8 concurrent
  const queue = [...need];
  const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift()!;
      const url = await signPath(next.path);
      if (url) setInCache(next.id, url);
    }
  });
  await Promise.all(workers);
}

export function primeFoodImageCache(itemId: string, url: string) {
  setInCache(itemId, url);
}
