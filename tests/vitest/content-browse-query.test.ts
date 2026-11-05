import { expect, it } from "vitest";
import { querySchema, installSchema } from "@/lib/content/schema";

const browse = {
  provider: "curseforge",
  kind: "mod",
  query: "",
  version: "",
  loader: "",
  offset: 0,
};

it("allows browsing all Minecraft versions and loaders for packs", () => {
  for (const kind of ["mod", "shader", "resourcepack"]) {
    expect(querySchema.safeParse({ ...browse, kind }).success).toBe(true);
  }
});

it("keeps validating explicit target configurations", () => {
  expect(
    querySchema.safeParse({ ...browse, version: "1.20.1", loader: "Forge" })
      .success,
  ).toBe(true);
  expect(
    querySchema.safeParse({ ...browse, version: "1.20.1", loader: "" }).success,
  ).toBe(false);
});

it("does not permit installation with an unrestricted browsing query", () => {
  expect(
    installSchema.safeParse({
      query: browse,
      projectId: "test",
      versionId: "release",
      instanceId: "instance",
    }).success,
  ).toBe(false);
});
