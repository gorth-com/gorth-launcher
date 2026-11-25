import { useCallback, useState, type ComponentProps } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@gorth-com/primitive/custom/tabs";
import { ContentPage } from "@/pages/content";

const packTabs = [
  { value: "mod", label: "Mods" },
  { value: "resourcepack", label: "Resource Packs" },
  { value: "shader", label: "Shader Packs" },
  { value: "datapack", label: "Data Packs" },
  { value: "world", label: "Worlds" },
] as const;

export function PackPage({
  initialKind = "mod",
  onDetailChange,
  ...props
}: Omit<
  ComponentProps<typeof ContentPage>,
  "fixedKind" | "catalogMode" | "catalogTabs"
> & {
  initialKind?: "mod" | "resourcepack" | "shader" | "datapack" | "world";
}) {
  const [kind, setKind] = useState<string>(initialKind);
  const [instanceId, setInstanceId] = useState("");
  const [detail, setDetail] = useState(false);
  const handleDetailChange = useCallback(
    (active: boolean) => {
      setDetail(active);
      onDetailChange(active);
    },
    [onDetailChange],
  );
  return (
    <section
      className={
        detail
          ? "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          : "flex min-w-0 flex-col gap-6"
      }
    >
      <Tabs
        value={kind}
        onValueChange={setKind}
        className={detail ? "min-h-0 flex-1 gap-0" : "gap-6"}
      >
        {packTabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={detail ? "min-h-0 flex-1" : undefined}
          >
            <ContentPage
              {...props}
              onDetailChange={handleDetailChange}
              initialProvider="curseforge"
              selectedInstanceId={instanceId}
              onInstanceChange={(id) => {
                setInstanceId(id);
                props.onInstanceChange?.(id);
              }}
              fixedKind={tab.value}
              catalogMode
              catalogTabs={
                <TabsList className="grid w-full max-w-[916px] min-w-0 grid-cols-5 gap-1 p-0">
                  {packTabs.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="w-full min-w-0 overflow-hidden px-1 text-xs sm:text-sm"
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
