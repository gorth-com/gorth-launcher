import { expect, it } from "vitest";
import { javaPathForMajor } from "@/lib/library/java-paths";
import { settingsSchema } from "@/lib/library/settings-schema";
import { effectiveGameSettings } from "@/lib/library/game-preferences";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
it("preserves older settings and all three independent version paths", () => {
  expect(settingsSchema.parse({ memory: 4, javaPath: "" }).javaPaths).toEqual({ "17": "", "21": "", "25": "" });
  const settings = settingsSchema.parse({ memory: 4, javaPath: "/default/java", javaPaths: { "17": "/17/java", "21": "/21/java", "25": "/25/java" } });
  const instance = defaultInstanceSettings(settings);
  expect(instance.javaPath).toBe("");
  const effective = effectiveGameSettings(settings, instance);
  for (const version of [17, 21, 25]) expect(javaPathForMajor(effective, version)).toBe(`/${version}/java`);
  expect(javaPathForMajor(effective, 16)).toBe("/17/java");
  expect(javaPathForMajor(effective, 8)).toBe("/default/java");
  expect(javaPathForMajor({ ...effective, javaPath: "/instance/java" }, 21)).toBe("/instance/java");
});
it("falls back to default and existing automatic discovery for empty paths", () => {
  expect(javaPathForMajor({ javaPath: "", javaPaths: { "17": " ", default: "/default/java" } }, 17)).toBe("/default/java");
  expect(javaPathForMajor({ javaPath: "" }, 25)).toBe("");
});
