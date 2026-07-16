import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.byebyediabetes",
  appName: "bye bye diabetes",
  webDir: "dist",
  // NOTE: No `server.url` — the app runs the locally bundled build from `dist/`,
  // so users get a native app experience with no Lovable sandbox flash.
  // If you want live hot-reload during development, temporarily add:
  //   server: { url: "https://325598b4-464e-4467-b131-0a537fd2ecec.lovableproject.com?forceHideBadge=true", cleartext: true }
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0B1220",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
  ios: {
    preferredContentMode: "mobile",
    backgroundColor: "#0B1220",
  },
  android: {
    backgroundColor: "#0B1220",
  },
};

export default config;
