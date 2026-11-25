import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthContext, useAuth } from "@/hooks/use-auth";
import { PortalProvider } from "@/providers/portal";
import { ToasterProvider } from "@/providers/toaster";
import { LoginBrowserSettings } from "@/components/element/login-browser-settings";
import { LoadingScreen } from "@/components/element/loading-screen";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { Button } from "@gorth-com/primitive/custom/button";
import "@/styles/globals.css";

Object.assign(window, {
  electronAPI: {
    portal: { update: () => {}, onBlur: () => () => {} },
    auth: { setLoginBrowser: async () => ({ error: "Fixture save failed" }) },
  },
});
function Content() {
  const [loadingError, setLoadingError] = useState("");
  const [count, setCount] = useState(0);
  useFeedbackToast(loadingError);
  return (
    <>
      <LoginBrowserSettings />
      <Button onClick={() => setCount(count + 1)}>Repeat render</Button>
      <Button onClick={() => setLoadingError("Fixture database unavailable")}>
        Fail startup
      </Button>
      {loadingError && <LoadingScreen error={loadingError} />}
    </>
  );
}
function Fixture() {
  const auth = {
    auth: { loginBrowser: "default" },
    busy: false,
  } as unknown as ReturnType<typeof useAuth>;
  return (
    <AuthContext.Provider value={auth}>
      <PortalProvider>
        <ToasterProvider>
          <Content />
        </ToasterProvider>
      </PortalProvider>
    </AuthContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
