import { afterEach, expect, it, vi } from "vitest";
import { rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { directory } from "../electron-auth-mock";
import {
  getLoginBrowser,
  setLoginBrowser,
  getLoginSignInURL,
} from "@/lib/auth/login-browser";
vi.mock("electron", () => import("../electron-auth-mock"));
afterEach(() =>
  rmSync(path.join(directory, "login-browser.v1.json"), { force: true }),
);
it("defaults to the system browser and persists only the validated preference", () => {
  expect(getLoginBrowser()).toBe("default");
  setLoginBrowser("gorth");
  expect(getLoginBrowser()).toBe("gorth");
  expect(
    JSON.parse(
      readFileSync(path.join(directory, "login-browser.v1.json"), "utf8"),
    ),
  ).toBe("gorth");
  expect(() => setLoginBrowser("https://attacker.test")).toThrow();
  expect(getLoginBrowser()).toBe("gorth");
  setLoginBrowser("default");
  expect(getLoginBrowser()).toBe("default");
});
it("changes only the public SDK sign-in destination, never OAuth token endpoints", () => {
  expect(getLoginSignInURL("https://website.example.test", "default")).toBe(
    "https://website.example.test/auth/desktop",
  );
  const route = new URL(
    getLoginSignInURL("https://website.example.test", "gorth"),
  );
  expect(route.protocol).toBe("com.gorth.browser:");
  expect(route.hostname + route.pathname).toBe("auth/open");
  expect(route.searchParams.get("url")).toBe(
    "https://website.example.test/auth/desktop",
  );
  expect(Array.from(route.searchParams.keys())).toEqual(["url"]);
});
