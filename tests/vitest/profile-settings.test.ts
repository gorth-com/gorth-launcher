import { expect, it } from "vitest";
import { settingsSchema } from "@/lib/library/settings-schema";
import { launcherPages, launcherSettingsSections, navigation } from "@/utils/constant";

it("keeps local profile preferences in the validated settings payload", () => {
  expect(settingsSchema.parse({ memory: 4, javaPath: "" }).profileIcon).toBe("user");
  const value = settingsSchema.parse({ memory: 4, javaPath: "", profileName: " My profile ", profileIcon: "rocket" });
  expect(value.profileName).toBe("My profile");
  expect(value.profileIcon).toBe("rocket");
  expect(settingsSchema.parse({ memory: 4, javaPath: "" }).profileName).toBe("Personal");
  expect(() => settingsSchema.parse({ memory: 4, javaPath: "", profileName: " " })).toThrow();
});

it("separates settings profile from main accounts while preserving old URLs", () => {
  expect(launcherSettingsSections.some(item => item.id === "profile")).toBe(true);
  expect(navigation.some(item => item.id === "accounts")).toBe(true);
  expect(launcherPages).toEqual(expect.arrayContaining(["settings/profile", "settings/account", "accounts", "account"]));
});
