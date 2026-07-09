import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LDRoot } from "@word-golf/ld";
import { App } from "./App.js";
import "./styles.css";

// Optional: set VITE_LD_CLIENT_ID in .env to connect a real LaunchDarkly app
// project. When absent, the app runs offline with safe flag defaults.
const clientSideID = import.meta.env.VITE_LD_CLIENT_ID as string | undefined;

// Feature flag: enable-observability-plugin
// Set VITE_LD_OBSERVABILITY=true to enable error tracking, web vitals, and
// traces via the @launchdarkly/observability plugin. Defaults to false (off).
const enableObservability =
  import.meta.env.VITE_LD_OBSERVABILITY === "true";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LDRoot clientSideID={clientSideID} enableObservability={enableObservability}>
      <App />
    </LDRoot>
  </StrictMode>
);
