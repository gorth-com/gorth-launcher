import { expect, it } from "vitest";
import { querySchema } from "@/lib/content/schema";
import { curseforgeClasses, curseforgePaths } from "@/utils/constant";

it("supports CurseForge Worlds browsing without version or loader filters", () => {
  const query = {
    provider: "curseforge",
    kind: "world",
    query: "skyblock",
    version: "",
    loader: "",
    offset: 0,
  };
  expect(querySchema.safeParse(query).success).toBe(true);
  expect(
    querySchema.safeParse({ ...query, provider: "modrinth" }).success,
  ).toBe(false);
  expect(curseforgeClasses.world).toBe(17);
  expect(curseforgePaths.world).toBe("worlds");
});
