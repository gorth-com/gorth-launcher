import { expect, it } from "vitest";
import { createLauncherRouter } from "@/lib/navigation";
import { createInstanceSchema } from "@/lib/library/create-schema";
it("registers concrete instance routes and legacy redirect targets", () => {
 const router=createLauncherRouter(()=>null);
 for(const path of ["/instances","/instances/create","/instances/data","/instances/edit/$uuid"]) expect(router.routesByPath).toHaveProperty(path);
 for(const [legacy,target] of [["/library","/instances"],["/instance-data","/instances/data"]]){
  const handler=router.routesByPath[legacy]?.options.beforeLoad;
  expect(handler).toBeTypeOf("function");
  let redirect:unknown;
  try {handler?.({} as never);} catch(error){redirect=error;}
  expect(redirect).toMatchObject({options:{to:target,replace:true}});
 }
});
it("validates create metadata together with the supported runtime", () => {
  const input = {
    action: "create",
    name: "  My world  ",
    version: "1.20.1",
    loader: "Vanilla",
    group: "  Friends ",
    iconData: "lucide:star",
  };
  const parsed = createInstanceSchema.parse(input);
  expect(parsed.name).toBe("My world");
  expect(parsed.group).toBe("Friends");
  expect(parsed.iconData).toBe("lucide:star");
  for (const value of [
    { ...input, name: " " },
    { ...input, iconData: "https://bad.example/icon.svg" },
    { ...input, loader: "Vanilla", loaderVersion: "bad" },
    { ...input, group: "a".repeat(61) },
  ])
    expect(createInstanceSchema.safeParse(value).success).toBe(false);
});
