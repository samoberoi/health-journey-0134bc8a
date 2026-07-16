import { createRoot } from "react-dom/client";
import "./index.css";
import {
  hydrateNativePersistence,
  installNativePersistenceLifecycleFlush,
  installNativePersistenceMirror,
} from "@/lib/nativePersistence";

// Global typography — Montserrat
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";

async function bootstrap() {
  await hydrateNativePersistence();
  installNativePersistenceMirror();
  installNativePersistenceLifecycleFlush();
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
