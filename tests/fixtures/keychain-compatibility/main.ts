import { app, safeStorage } from "electron";
import path from "node:path";

const directory = process.argv.at(-1)!;
if (
  !app.commandLine.hasSwitch("use-mock-keychain") ||
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-keychain-compat-")
)
  throw new Error("An isolated profile and mock Keychain are required.");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const timer = setTimeout(() => app.exit(1), 15000);
void app
  .whenReady()
  .then(async () => {
    const plaintext = "isolated-compatibility-fixture";
    const legacy = safeStorage.encryptString(plaintext);
    const asynchronous = await safeStorage.encryptStringAsync(plaintext);
    let legacyReadsAsync = false;
    try {
      legacyReadsAsync = safeStorage.decryptString(asynchronous) === plaintext;
    } catch {
      /* Observable compatibility result. */
    }
    const asyncReadsLegacy =
      (await safeStorage.decryptStringAsync(legacy)).result === plaintext;
    console.log(
      "GORTH_KEYCHAIN_COMPAT=" +
        JSON.stringify({
          legacyReadsAsync,
          asyncReadsLegacy,
          legacyPrefix: legacy.subarray(0, 3).toString("ascii"),
        }),
    );
  })
  .then(
    () => app.quit(),
    (error) => {
      console.error(String(error));
      app.exit(1);
    },
  )
  .finally(() => clearTimeout(timer));
