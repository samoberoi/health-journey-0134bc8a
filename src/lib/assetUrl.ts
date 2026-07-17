import { isNative } from "@/lib/biometric";

// On Capacitor (iOS/Android) the app is served from capacitor://localhost,
// so root-relative Lovable CDN paths like `/__l5e/assets-v1/...` don't resolve.
// Prefix them with the published Lovable project origin.
const NATIVE_ASSET_ORIGIN = "https://325598b4-464e-4467-b131-0a537fd2ecec.lovableproject.com";

export function resolveAssetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (isNative() && url.startsWith("/")) return `${NATIVE_ASSET_ORIGIN}${url}`;
  return url;
}
