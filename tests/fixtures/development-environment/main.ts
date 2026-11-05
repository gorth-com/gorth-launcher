import { app } from "electron";
import path from "node:path";
import { authUrl } from "@/utils/environment";

const directory = process.argv.at(-1)!;
if (
  !path.isAbsolute(directory) ||
  !path.basename(directory).startsWith("gorth-env-native-")
)
  throw new Error("Isolated profile required");
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const timeout = setTimeout(() => app.exit(1), 10_000);
app.once("quit", () => clearTimeout(timeout));
void app.whenReady().then(() => {
  console.log(
    "GORTH_ENV_MAIN=" +
      JSON.stringify({
        privateAvailable:
          process.env.GORTH_TEST_PRIVATE === "$fixture$main-only",
        publicAvailable: authUrl === "https://fixture.invalid",
      }),
  );
  app.quit();
});
