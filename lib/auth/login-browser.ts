import { app } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type LoginBrowser = "default" | "gorth";
function filename() {
  return path.join(app.getPath("userData"), "login-browser.v1.json");
}
export function getLoginBrowser(): LoginBrowser {
  if (!existsSync(filename())) return "default";
  const value: unknown = JSON.parse(readFileSync(filename(), "utf8"));
  if (value !== "default" && value !== "gorth")
    throw new Error("Invalid saved login browser setting.");
  return value;
}
export function setLoginBrowser(value: unknown) {
  if (value !== "default" && value !== "gorth")
    throw new Error("Invalid login browser.");
  mkdirSync(app.getPath("userData"), { recursive: true });
  const temporary = filename() + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, filename());
}
// Only OS navigation is customized. requestAuth still generates SDK PKCE/state.
export function getLoginSignInURL(authOrigin: string, browser: LoginBrowser) {
  const target = new URL("/auth/desktop", authOrigin);
  if (browser === "default") return target.href;
  const route = new URL("com.gorth.browser://auth/open");
  route.searchParams.set("url", target.href);
  return route.href;
}
