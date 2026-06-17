import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LDRoot } from "@word-golf/ld";
import { App } from "./App.js";
import "./styles.css";

// Optional: set VITE_LD_CLIENT_ID in .env to connect a real LaunchDarkly app
// project. When absent, the app runs offline with safe flag defaults.
const clientSideID = import.meta.env.VITE_LD_CLIENT_ID as string | undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LDRoot clientSideID={clientSideID}>
      <App />
    </LDRoot>
  </StrictMode>
);
