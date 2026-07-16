import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.byebyediabetes",
  appName: "bye bye diabetes",
  webDir: "dist",
  server: {
    url: "https://325598b4-464e-4467-b131-0a537fd2ecec.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
