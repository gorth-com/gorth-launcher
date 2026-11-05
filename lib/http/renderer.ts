import { callerClient } from "@/utils/caller";

// Electron's renderer owns its Chromium session. Cache options in the shared
// caller must not select Axios's fetch adapter instead of that session's XHR.
callerClient.interceptors.request.use((config) => {
  if (!config.adapter || config.adapter === "fetch") config.adapter = "xhr";
  return config;
});
