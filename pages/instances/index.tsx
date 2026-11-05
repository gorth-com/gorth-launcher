import { InstanceSelect } from "@/components/element/instance-select";
import {
  FolderInput,
  Grid2X2,
  Layers,
  List,
  Plus,
  Search,
} from "@gorth-io/primitive/cores/lucide";
import { useState } from "react";
import { PageHeading } from "@/components/heading";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import {
  InstanceCards,
  type InstanceCardsProps,
} from "@/components/element/instance-cards";
import type { Instance } from "@/lib/launcher";
import { Card } from "@gorth-io/primitive/default/card";
interface LibraryPageProps extends Pick<
  InstanceCardsProps,
  "onSelect" | "onPlay" | "playDisabled" | "statusLabel" | "playTimeLabel"
> {
  instances: Instance[];
  query: string;
  filter: string;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onCreate: () => void;
  onImportOrphans?: () => void;
  importDisabled?: boolean;
}
export function LibraryPage({
  instances,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onCreate,
  onImportOrphans,
  importDisabled = false,
  onSelect,
  onPlay,
  playDisabled,
  statusLabel,
  playTimeLabel,
}: LibraryPageProps) {
  const [layout, setLayout] = useState("grid");
  const visible = instances.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        item.loader === filter ||
        (filter.startsWith("group:") && item.group === filter.slice(6))),
  );
  const groups = [
    ...new Set(instances.map((item) => item.group).filter(Boolean)),
  ];
  return (
    <section className="grid grid-cols-3 gap-6">
      <section className="flex min-w-0 flex-col col-span-2 gap-6">
        <PageHeading
          title="Instances"
          icon={Layers}
          actions={
            <div className="flex items-center gap-2">
              <Button
                className="gap-2"
                variant="outline"
                disabled={importDisabled}
                onClick={onImportOrphans}
              >
                <FolderInput />
                Nhập instance mồ côi
              </Button>
              <Button className="gap-2" onClick={onCreate}>
                <Plus />
                Tạo instance
              </Button>
            </div>
          }
        />
        <form
          role="search"
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onQueryChange(query.trim());
          }}
        >
          <div className="w-45 shrink-0">
            <InstanceSelect
              label="Lọc mod loader"
              value={filter}
              onChange={onFilterChange}
              items={[
                {
                  value: "all",
                  label: `Tất cả mod loader (${instances.length})`,
                },
                ...["Vanilla", "Fabric", "Forge", "NeoForge"].map((value) => ({
                  value,
                  label: `${value} (${instances.filter((item) => item.loader === value).length})`,
                })),
                ...groups.map((group) => ({
                  value: "group:" + group,
                  label: `Nhóm: ${group} (${instances.filter((item) => item.group === group).length})`,
                })),
              ]}
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              aria-label="Tìm instance"
              placeholder="Tìm instance…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            aria-label="Search"
            className="shrink-0"
          >
            <Search />
          </Button>
          <div
            role="group"
            aria-label="Instance layout"
            className="ml-auto flex shrink-0 items-center gap-2"
          >
            <Button
              type="button"
              className="size-9"
              size="icon"
              aria-label="Grid"
              aria-pressed={layout === "grid"}
              variant={layout === "grid" ? "default" : "outline"}
              onClick={() => setLayout("grid")}
            >
              <Grid2X2 />
            </Button>
            <Button
              type="button"
              className="size-9"
              size="icon"
              aria-label="List"
              aria-pressed={layout === "list"}
              variant={layout === "list" ? "default" : "outline"}
              onClick={() => setLayout("list")}
            >
              <List />
            </Button>
          </div>
        </form>
        {visible.length ? (
          <InstanceCards
            items={visible}
            onSelect={onSelect}
            onPlay={onPlay}
            playDisabled={playDisabled}
            statusLabel={statusLabel}
            playTimeLabel={playTimeLabel}
            layout={layout === "list" ? "list" : "grid"}
          />
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center [&_h3]:font-semibold [&_p]:max-w-md [&_p]:text-sm [&_p]:leading-6 [&_p]:text-muted-foreground">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&>svg]:size-5">
              <Layers />
            </span>
            <h3>
              {instances.length
                ? "Không tìm thấy instance"
                : "Thư viện đang trống"}
            </h3>
            <p>
              {instances.length
                ? "Thử tên khác hoặc thay đổi bộ lọc."
                : "Mỗi instance có phiên bản và cấu hình riêng."}
            </p>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                if (instances.length) {
                  onQueryChange("");
                  onFilterChange("all");
                } else onCreate();
              }}
            >
              {instances.length ? "Xóa bộ lọc" : "Tạo instance"}
            </Button>
          </div>
        )}
      </section>
      <section className="flex min-w-0 flex-col gap-6">
        <Card className="h-full">

        </Card>
      </section>
    </section>
  );
}
