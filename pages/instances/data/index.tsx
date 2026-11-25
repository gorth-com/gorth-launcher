import { confirmAction } from "@/lib/confirmation";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/heading";
import { InstanceLogs } from "@/components/element/instance-logs";
import { InstanceScreenshots } from "@/components/element/instance-screenshots";
import { Database } from "@gorth-com/primitive/cores/lucide";
import { InstanceSelect } from "@/components/element/instance-select";
import {
  Archive,
  Camera,
  Download,
  Import,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Trash2,
} from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@gorth-com/primitive/default/card";
import { Input } from "@gorth-com/primitive/default/input";
import { Textarea } from "@gorth-com/primitive/default/textarea";
import type { Instance } from "@/utils/interface";
import { formatDateTime, formatInstanceFileSize } from "@/utils/formatter";
import type {
  InstanceDataCommand,
  InstanceDataSnapshot,
} from "@/lib/instance/interface";

export function InstanceDataPage({
  instances,
  busy,
  onChanged,
  fixedInstanceId,
  section,
}: {
  instances: Instance[];
  busy: boolean;
  onChanged: () => void;
  fixedInstanceId?: string;
  section?: "notes" | "worlds" | "servers" | "screenshots" | "logs";
}) {
  const [id, setId] = useState(fixedInstanceId ?? instances[0]?.id ?? ""),
    [data, setData] = useState<InstanceDataSnapshot | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [serverName, setServerName] = useState(""),
    [serverAddress, setServerAddress] = useState("");
  useFeedbackToast(error);
  const revision = useRef(0);
  const load = async (next = id) => {
    const request = ++revision.current;
    if (!next) {
      setData(null);
      return;
    }
    setWorking(true);
    try {
      const result = await window.electronAPI.instanceData.snapshot(next);
      if (request !== revision.current) return;
      if (result.ok && result.data) {
        setData(result.data);
        setError("");
      } else setError(result.error ?? "Không đọc được dữ liệu.");
    } catch {
      if (request === revision.current)
        setError("Không đọc được dữ liệu instance.");
    } finally {
      if (request === revision.current) setWorking(false);
    }
  };
  useEffect(() => {
    if (!instances.some((x) => x.id === id)) setId(instances[0]?.id ?? "");
  }, [instances, id]);
  useEffect(() => {
    void load(id);
    return () => {
      revision.current++;
    };
  }, [id]);
  const run = async (command: InstanceDataCommand, confirm?: string) => {
    if (confirm && !(await confirmAction(confirm))) return;
    setWorking(true);
    setError("");
    try {
      const result = await window.electronAPI.instanceData.command(command);
      if (result.ok && result.data) {
        setData(result.data.snapshot);
        setError("");
      } else setError(result.error ?? "Thao tác thất bại.");
    } catch {
      setError("Không thực hiện được thao tác dữ liệu instance.");
    } finally {
      setWorking(false);
    }
  };
  const transfer = async (kind: "import" | "export") => {
    setWorking(true);
    setError("");
    try {
      const result =
        kind === "import"
          ? await window.electronAPI.instanceData.import()
          : await window.electronAPI.instanceData.export(id);
      if (!result.ok) setError(result.error ?? "Thao tác thất bại.");
      else if (result.data) {
        setError(
          kind === "export" ? `Đã xuất: ${result.data}` : "Đã import instance.",
        );
        onChanged();
        await load();
      }
    } catch {
      setError("Không nhập hoặc xuất được dữ liệu instance.");
    } finally {
      setWorking(false);
    }
  };
  const disabled = busy || working;
  if (section === "logs")
    return data ? (
      <InstanceLogs
        instanceId={id}
        logs={data.logs}
        busy={busy || working}
        onSnapshot={setData}
        onReload={() => void load()}
        fill
      />
    ) : (
      <p role="status">Đang đọc danh sách log…</p>
    );
  return (
    <div className="flex flex-col gap-6">
      {!fixedInstanceId && (
        <PageHeading title="Instance data" icon={Database} />
      )}
      <div className="flex flex-wrap gap-2">
        {!fixedInstanceId && (
          <div className="min-w-48 flex-1">
            <InstanceSelect
              label="Choose instance"
              value={id}
              onChange={(value) => {
                setId(value);
                setData(null);
              }}
              disabled={!!fixedInstanceId || disabled}
              items={
                instances.length
                  ? instances.map((item) => ({
                      value: item.id,
                      label: item.name + " · " + item.version,
                    }))
                  : [{ value: "", label: "No instances" }]
              }
            />
          </div>
        )}
        <Button
          className="h-9"
          variant="outline"
          disabled={disabled || !id}
          onClick={() => void load()}
        >
          <RefreshCw />
          Làm mới
        </Button>
        {!fixedInstanceId && (
          <Button
            className="h-9"
            variant="outline"
            disabled={disabled}
            onClick={() => void transfer("import")}
          >
            <Import />
            Import Prism / MultiMC / FTB
          </Button>
        )}
        {!fixedInstanceId && (
          <Button
            className="h-9"
            disabled={disabled || !id}
            onClick={() => void transfer("export")}
          >
            <Download />
            Xuất instance / modpack
          </Button>
        )}
      </div>

      {!data ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {instances.length
              ? "Đang đọc dữ liệu…"
              : "Hãy tạo hoặc import một instance."}
          </CardContent>
        </Card>
      ) : (
        <>
          {(!section || section === "notes") && (
            <Card>
              <CardHeader>
                <CardTitle>Ghi chú instance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Textarea
                  className="min-h-28"
                  value={data.notes}
                  maxLength={100000}
                  onChange={(e) => setData({ ...data, notes: e.target.value })}
                />
                <Button
                  className="h-9"
                  disabled={disabled}
                  onClick={() =>
                    void run({
                      action: "notes.save",
                      instanceId: id,
                      notes: data.notes,
                    })
                  }
                >
                  <Save />
                  Lưu ghi chú
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {(!section || section === "worlds") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive />
                    World & backup
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {!data.worlds.length && (
                    <p className="text-sm text-muted-foreground">
                      Chưa có world.
                    </p>
                  )}
                  {data.worlds.map((world) => (
                    <div
                      key={world.name}
                      className="flex flex-col gap-2 rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{world.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatInstanceFileSize(world.size)} ·{" "}
                            {formatDateTime(world.modifiedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="h-9"
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              void run({
                                action: "world.backup",
                                instanceId: id,
                                world: world.name,
                              })
                            }
                          >
                            <Archive />
                            Backup
                          </Button>
                          <Button
                            className="h-9"
                            size="icon"
                            variant="destructive"
                            disabled={disabled}
                            aria-label="Xóa world"
                            onClick={() =>
                              void run(
                                {
                                  action: "world.delete",
                                  instanceId: id,
                                  world: world.name,
                                },
                                `Xóa world “${world.name}”? Hãy backup trước nếu cần.`,
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {world.backups.map((backup) => (
                        <div
                          key={backup.name}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">
                            {backup.name} ·{" "}
                            {formatInstanceFileSize(backup.size)}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              className="h-9"
                              size="sm"
                              variant="ghost"
                              disabled={disabled}
                              onClick={() =>
                                void run(
                                  {
                                    action: "world.restore",
                                    instanceId: id,
                                    world: world.name,
                                    backup: backup.name,
                                  },
                                  `Khôi phục “${world.name}” từ backup này? Bản hiện tại sẽ được backup tự động.`,
                                )
                              }
                            >
                              <RotateCcw />
                              Khôi phục
                            </Button>
                            <Button
                              className="h-9"
                              size="icon"
                              variant="ghost"
                              disabled={disabled}
                              aria-label="Xóa backup"
                              onClick={() =>
                                void run(
                                  {
                                    action: "backup.delete",
                                    instanceId: id,
                                    world: world.name,
                                    backup: backup.name,
                                  },
                                  "Xóa backup này?",
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {(!section || section === "servers") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server />
                    Server list
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input
                      className="h-9"
                      placeholder="Tên server"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                    />
                    <Input
                      className="h-9"
                      placeholder="play.example.net"
                      value={serverAddress}
                      onChange={(e) => setServerAddress(e.target.value)}
                    />
                    <Button
                      className="h-9"
                      disabled={
                        disabled || !serverName.trim() || !serverAddress.trim()
                      }
                      onClick={async () => {
                        await run({
                          action: "server.save",
                          instanceId: id,
                          index: null,
                          server: { name: serverName, address: serverAddress },
                        });
                        setServerName("");
                        setServerAddress("");
                      }}
                    >
                      Thêm
                    </Button>
                  </div>
                  {data.servers.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                      key={`${item.address}-${index}`}
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.address}
                        </p>
                      </div>
                      <Button
                        className="h-9"
                        size="icon"
                        variant="ghost"
                        disabled={disabled}
                        aria-label="Xóa server"
                        onClick={() =>
                          void run({
                            action: "server.delete",
                            instanceId: id,
                            index,
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {(!section || section === "screenshots") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera />
                    Screenshots
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <InstanceScreenshots
                    instanceId={id}
                    shots={data.screenshots}
                    disabled={disabled}
                    onOpen={(name) =>
                      void run({
                        action: "screenshot.open",
                        instanceId: id,
                        name,
                      })
                    }
                    onReveal={(name) =>
                      void run({
                        action: "screenshot.reveal",
                        instanceId: id,
                        name,
                      })
                    }
                    onDelete={(name) =>
                      void run(
                        { action: "screenshot.delete", instanceId: id, name },
                        "Xóa screenshot này?",
                      )
                    }
                  />
                </CardContent>
              </Card>
            )}
            {!section && (
              <div className="min-w-0 xl:col-span-2">
                <InstanceLogs
                  instanceId={id}
                  logs={data.logs}
                  busy={busy || working}
                  onSnapshot={setData}
                  onReload={() => void load()}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
