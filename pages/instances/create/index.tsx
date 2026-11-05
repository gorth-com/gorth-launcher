import { useId, useState } from "react";
import { useForm, useStore } from "@gorth-io/primitive/cores/tanstack/form";
import { Plus, RefreshCw, Import } from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import { Input } from "@gorth-io/primitive/default/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@gorth-io/primitive/default/field";
import { z } from "@gorth-io/structure/cores/zod";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
  CardFooter,
} from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import {
  InstanceWorkspace,
  type InstanceWorkspaceProps,
} from "@/layouts/instance-workspace";
import { InstanceSelect } from "@/components/element/instance-select";
import { InstanceIcon, instanceIcons } from "@/utils/renderer";
import { instanceCreateSections, loaderCatalog } from "@/utils/constant";
import { supportedLoader } from "@/lib/game/catalog";
import { createInstanceSchema } from "@/lib/library/create-schema";
import { PageHeading } from "@/components/heading";
import { ContentPage } from "@/pages/content";
import { toast } from "@/providers/toaster";
import type { GameVersion, Instance, LibraryCommand } from "@/utils/interface";
type CreateCommand = Extract<LibraryCommand, { action: "create" }>;
function versionFamily(id: string) {
  const match = /^(\d+)(?:\.(\d+))?/.exec(id);
  return match?.[1] === "1" && match[2] ? `1.${match[2]}` : (match?.[1] ?? id);
}
export function CreateInstancePage(
  props: InstanceWorkspaceProps & {
    versions: GameVersion[];
    instances: Instance[];
    busy: boolean;
    onCreate: (value: CreateCommand) => Promise<boolean>;
    onRefreshVersions: () => void;
  },
) {
  const createFormId = useId();
  const [source, setSource] = useState("custom");
  const [query, setQuery] = useState("");
  const [extraFamilies, setExtraFamilies] = useState(0);
  const recentFamilies = ["26", "1.21", "1.20"];
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState(false);
  const form = useForm({
    defaultValues: {
      name: "",
      group: "",
      icon: "box",
      version: props.versions[0]?.id ?? "1.20.1",
      loader: "Vanilla",
      loaderVersion: "",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, "Nhập tên instance.").max(60),
        group: z.string().trim().max(60),
        icon: z.string(),
        version: z.string(),
        loader: z.string(),
        loaderVersion: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!supportedLoader(value)) {
        toast.add({
          title: "Chọn phiên bản Minecraft và loader được hỗ trợ.",
          type: "error",
        });
        return;
      }
      const parsed = createInstanceSchema.safeParse({
        action: "create",
        name: value.name.trim(),
        version: value.version,
        loader: value.loader,
        loaderVersion: value.loaderVersion || null,
        group: value.group.trim() || null,
        iconData: "lucide:" + value.icon,
      });
      if (!parsed.success) {
        toast.add({
          title: parsed.error.issues[0]?.message ?? "Invalid instance.",
          type: "error",
        });
        return;
      }
      await props.onCreate(parsed.data);
    },
  });
  const selectedLoader = useStore(form.store, (state) => state.values.loader);
  const availableVersions = props.versions.filter(
    (item) =>
      selectedLoader === "Vanilla" ||
      loaderCatalog.some(
        (entry) =>
          entry.loader === selectedLoader && entry.minecraft === item.id,
      ),
  );
  const olderFamilies = [
    ...new Set(availableVersions.map((item) => versionFamily(item.id))),
  ]
    .filter((family) => !recentFamilies.includes(family))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const visibleFamilies = new Set([
    ...recentFamilies,
    ...olderFamilies.slice(0, extraFamilies),
  ]);
  async function importInstance() {
    setImporting(true);
    try {
      const result = await window.electronAPI.instanceData.import();
      if (!result.ok)
        throw new Error(result.error ?? "Không import được instance.");
      if (result.data) {
        toast.add({ title: "Đã import instance.", type: "success" });
        props.onNavigate("instances");
      }
    } catch (error) {
      toast.add({
        title: error instanceof Error ? error.message : "Import thất bại.",
        type: "error",
      });
    } finally {
      setImporting(false);
    }
  }
  const groups = [
    ...new Set(
      props.instances
        .map((item) => item.group)
        .filter((value): value is string => !!value),
    ),
  ];
  return (
    <InstanceWorkspace
      {...props}
      sections={instanceCreateSections}
      section={source}
      onSectionChange={setSource}
    >
      <div className="flex flex-col gap-6">
        <PageHeading
          title="New instance"
          icon={Plus}
          actions={
            source === "custom" && (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={props.busy}
                  onClick={props.onBack}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={props.busy || importing}
                  onClick={() => void importInstance()}
                >
                  <Import />
                  Import instance
                </Button>
                <Button
                  type="submit"
                  form={createFormId}
                  disabled={props.busy || !availableVersions.length}
                >
                  <Plus />
                  Create instance
                </Button>
              </div>
            )
          }
        />
        {source === "custom" ? (
          <form
            id={createFormId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <fieldset
              disabled={props.busy}
              className="flex min-w-0 flex-col gap-6"
            >
              <Card className="gap-0 p-0">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <form.Subscribe selector={(state) => state.values.icon}>
                    {(icon) => <InstanceIcon data={"lucide:" + icon} />}
                  </form.Subscribe>
                  <FieldGroup className="min-w-0 flex-1 gap-2">
                    <form.Field name="name">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid} className="gap-1">
                            <FieldLabel htmlFor={`${createFormId}-name`}>
                              Name
                            </FieldLabel>
                            <Input
                              id={`${createFormId}-name`}
                              name={field.name}
                              onBlur={field.handleBlur}
                              aria-invalid={isInvalid}
                              aria-describedby={
                                isInvalid
                                  ? `${createFormId}-name-error`
                                  : undefined
                              }
                              required
                              maxLength={60}
                              value={field.state.value}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="My instance"
                            />
                            {isInvalid && (
                              <FieldError
                                id={`${createFormId}-name-error`}
                                errors={field.state.meta.errors}
                              />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                    <form.Field name="group">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid} className="gap-1">
                            <FieldLabel htmlFor={`${createFormId}-group`}>
                              Group
                            </FieldLabel>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="min-w-48 flex-1">
                                <InstanceSelect
                                  label="Existing group"
                                  value={field.state.value}
                                  onChange={field.handleChange}
                                  items={[
                                    { value: "", label: "No group" },
                                    ...groups.map((value) => ({
                                      label: value,
                                      value,
                                    })),
                                    ...(field.state.value &&
                                      !groups.includes(field.state.value)
                                      ? [
                                        {
                                          value: field.state.value,
                                          label: field.state.value,
                                        },
                                      ]
                                      : []),
                                  ]}
                                />
                              </div>
                              <Input
                                id={`${createFormId}-group`}
                                name={field.name}
                                onBlur={field.handleBlur}
                                aria-invalid={isInvalid}
                                aria-describedby={
                                  isInvalid
                                    ? `${createFormId}-group-error`
                                    : undefined
                                }
                                className="w-48"
                                aria-label="New group"
                                maxLength={60}
                                placeholder="New group"
                                value={field.state.value}
                                onChange={(event) =>
                                  field.handleChange(event.target.value)
                                }
                              />
                            </div>
                            {isInvalid && (
                              <FieldError
                                id={`${createFormId}-group-error`}
                                errors={field.state.meta.errors}
                              />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </FieldGroup>
                </div>
                <Separator />
                <form.Field name="icon">
                  {(field) => (
                    <div className="flex flex-wrap gap-2 p-4">
                      {Object.entries(instanceIcons).map(([key, Icon]) => (
                        <Button
                          key={key}
                          type="button"
                          size="icon"
                          aria-label={key + " instance icon"}
                          aria-pressed={field.state.value === key}
                          variant={
                            field.state.value === key ? "default" : "outline"
                          }
                          onClick={() => field.handleChange(key)}
                        >
                          <Icon />
                        </Button>
                      ))}
                    </div>
                  )}
                </form.Field>
              </Card>
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
                <Card className="py-4 min-w-0 gap-0 md:col-span-2">
                  <CardHeader className="gap-2 px-4 pb-4">
                    <CardTitle>Minecraft version</CardTitle>
                    <div className="flex gap-2">
                      <Input
                        aria-label="Search versions"
                        placeholder="Search versions…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={props.onRefreshVersions}
                      >
                        <RefreshCw />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="p-0">
                    <form.Field name="version">
                      {(field) => (
                        <div className="h-96 scroll-fade scrollbar-none overflow-y-auto xx:h-64">
                          <RadioGroup
                            className="flex flex-col gap-4 p-4 pr-6"
                            aria-label="Minecraft version"
                            value={field.state.value}
                            onValueChange={(value) => {
                              field.handleChange(String(value));
                              form.setFieldValue(
                                "loaderVersion",
                                loaderCatalog.find(
                                  (entry) =>
                                    entry.loader === selectedLoader &&
                                    entry.minecraft === String(value),
                                )?.version ?? "",
                              );
                            }}
                          >
                            {availableVersions
                              .filter((item) =>
                                visibleFamilies.has(versionFamily(item.id)),
                              )
                              .filter((item) => item.id.includes(query))
                              .map((item) => (
                                <label
                                  key={item.id}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span className="flex items-center gap-2">
                                    <RadioGroupItem value={item.id} />
                                    {item.id}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {item.type}
                                  </span>
                                </label>
                              ))}
                          </RadioGroup>
                        </div>
                      )}
                    </form.Field>
                    {!props.versions.length && (
                      <CardDescription className="p-6">
                        Chưa tải được danh sách phiên bản. Bấm Refresh để thử
                        lại.
                      </CardDescription>
                    )}
                    {props.versions.length > 0 && !availableVersions.length && (
                      <CardDescription className="p-6">
                        Không có phiên bản Minecraft được engine hỗ trợ cho
                        loader này.
                      </CardDescription>
                    )}
                  </CardContent>
                  <Separator />
                  <CardFooter className="justify-end gap-2 pt-4 px-4">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={extraFamilies >= olderFamilies.length}
                      onClick={() => setExtraFamilies((count) => count + 1)}
                    >
                      Show more
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={extraFamilies === 0}
                      onClick={() =>
                        setExtraFamilies((count) => Math.max(0, count - 1))
                      }
                    >
                      Hide less
                    </Button>
                  </CardFooter>
                </Card>
                <Card className="py-4 gap-4 min-w-0">
                  <CardHeader className="px-4">
                    <CardTitle>Mod loader</CardTitle>
                    <CardDescription>Engine support</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="flex flex-col gap-4 px-4">
                    <form.Subscribe selector={(state) => state.values.version}>
                      {(version) => (
                        <form.Field name="loader">
                          {(field) => (
                            <RadioGroup
                              className="flex flex-col gap-4"
                              aria-label="Mod loader"
                              value={field.state.value}
                              onValueChange={(value) => {
                                const loader = String(value);
                                field.handleChange(loader);
                                const compatible = props.versions.filter(
                                  (item) =>
                                    loader === "Vanilla" ||
                                    loaderCatalog.some(
                                      (entry) =>
                                        entry.loader === loader &&
                                        entry.minecraft === item.id,
                                    ),
                                );
                                const nextVersion =
                                  compatible.find((item) => item.id === version)
                                    ?.id ??
                                  compatible[0]?.id ??
                                  "";
                                form.setFieldValue("version", nextVersion);
                                const older = [
                                  ...new Set(
                                    compatible.map((item) =>
                                      versionFamily(item.id),
                                    ),
                                  ),
                                ]
                                  .filter(
                                    (family) =>
                                      !recentFamilies.includes(family),
                                  )
                                  .sort((a, b) =>
                                    b.localeCompare(a, undefined, {
                                      numeric: true,
                                    }),
                                  );
                                setExtraFamilies(
                                  Math.max(
                                    0,
                                    older.indexOf(versionFamily(nextVersion)) +
                                    1,
                                  ),
                                );
                                form.setFieldValue(
                                  "loaderVersion",
                                  loaderCatalog.find(
                                    (item) =>
                                      item.loader === loader &&
                                      item.minecraft === nextVersion,
                                  )?.version ?? "",
                                );
                              }}
                            >
                              {["Vanilla", "Fabric", "Forge", "NeoForge"].map(
                                (loader) => (
                                  <label
                                    key={loader}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <RadioGroupItem value={loader} />
                                    {loader}
                                  </label>
                                ),
                              )}
                            </RadioGroup>
                          )}
                        </form.Field>
                      )}
                    </form.Subscribe>
                  </CardContent>
                  <form.Subscribe selector={(state) => state.values}>
                    {(values) =>
                      values.loader !== "Vanilla" && (
                        <>
                          <Separator />
                          <CardFooter className="flex flex-col items-stretch gap-4 px-4">
                            {/* <CardTitle>Loader version</CardTitle> */}
                            <form.Field name="loaderVersion">
                              {(field) => (
                                <RadioGroup
                                  aria-label="Loader version"
                                  className="flex flex-col gap-4"
                                  value={field.state.value}
                                  onValueChange={(value) =>
                                    field.handleChange(String(value))
                                  }
                                >
                                  {loaderCatalog
                                    .filter(
                                      (item) =>
                                        item.loader === values.loader &&
                                        item.minecraft === values.version,
                                    )
                                    .map((item) => (
                                      <label
                                        key={item.version}
                                        className="flex items-center gap-2 text-sm"
                                      >
                                        <RadioGroupItem value={item.version} />
                                        {item.version}
                                      </label>
                                    ))}
                                </RadioGroup>
                              )}
                            </form.Field>
                          </CardFooter>
                        </>
                      )
                    }
                  </form.Subscribe>
                </Card>
              </div>
            </fieldset>
          </form>
        ) : (
          <ContentPage
            key={source}
            initialProvider={
              source === "curseforge" ? "curseforge" : "modrinth"
            }
            fixedKind="modpack"
            instances={props.instances}
            gameBusy={props.busy}
            onLibrary={() => props.onNavigate("instances")}
            hideWebview={false}
            onDetailChange={setDetail}
          />
        )}
        {detail && <span className="sr-only">Modpack details</span>}
      </div>
    </InstanceWorkspace>
  );
}
