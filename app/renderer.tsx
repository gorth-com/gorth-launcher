import { StrictMode } from "react";
import { ConfirmationProvider } from "@/providers/confirmation";
import { QueryProvider } from "@/providers/query";
import { createRoot } from "react-dom/client";
import { PortalProvider } from "@/providers/portal";
import { MenuPortal } from "@/providers/menu";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import { LauncherRouter } from "@/providers/router";
import { AuthProvider } from "@/providers/auth";
import "@/styles/globals.css";
import "@/lib/http/renderer";
const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <QueryProvider>
      <PortalProvider>
        <TooltipProvider>
          <ToasterProvider>
            <ConfirmationProvider>
              <AuthProvider>
                <LauncherRouter />
                <MenuPortal />
              </AuthProvider>
            </ConfirmationProvider>
          </ToasterProvider>
        </TooltipProvider>
      </PortalProvider>
    </QueryProvider>
  </StrictMode>,
);
