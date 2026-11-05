import { Fragment, useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@gorth-io/primitive/cores/tanstack/query";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Input } from "@gorth-io/primitive/default/input";
import { Separator } from "@gorth-io/primitive/default/separator";
import { Button } from "@gorth-io/primitive/custom/button";
import { FolderOpen } from "@gorth-io/primitive/cores/lucide";
import { toast } from "@/providers/toaster";

export function FoldersCard() {
  const client = useQueryClient();
  const folders = useQuery({
    queryKey: ["folders"],
    queryFn: () => window.electronAPI.folders.list(),
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (folders.error)
      toast.add({ title: "Could not load folders", type: "error" });
  }, [folders.error]);
  const choose = useMutation({
    mutationFn: (id: string) => window.electronAPI.folders.choose(id),
    onSuccess: (value) => {
      if (!value) return;
      client.setQueryData(["folders"], value);
      toast.add({
        title: value.restartRequired
          ? "Folder saved — restart required"
          : "Folder saved",
        description: value.restartRequired
          ? "Existing files are not moved. Copy the required data before restarting."
          : undefined,
        type: "success",
      });
    },
    onError: () =>
      toast.add({
        title: "Could not change folder",
        description: "Choose a dedicated writable directory and try again.",
        type: "error",
      }),
  });
  const open = useMutation({
    mutationFn: (id: string) => window.electronAPI.folders.open(id),
    onError: () => toast.add({ title: "Could not open folder", type: "error" }),
  });
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {folders.isPending && (
        <div className="p-4">
          <CardDescription>Loading folders…</CardDescription>
        </div>
      )}
      {folders.data?.folders.map((folder, index) => (
        <Fragment key={folder.id}>
          {index > 0 && <Separator />}
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
              <CardTitle>{folder.label}</CardTitle>
              {folder.description && (
                <CardDescription>{folder.description}</CardDescription>
              )}
              {folder.path !== folder.activePath && (
                <CardDescription>
                  After restart · current: {folder.activePath}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                aria-label={folder.label + " path"}
                value={folder.path}
                className={
                  folder.editable
                    ? "min-w-0 flex-1 cursor-pointer"
                    : "min-w-0 flex-1"
                }
                title={
                  folder.editable ? "Choose folder" : "Application-managed path"
                }
                onClick={
                  folder.editable && !choose.isPending
                    ? () => choose.mutate(folder.id)
                    : undefined
                }
                onKeyDown={(event) => {
                  if (
                    folder.editable &&
                    !choose.isPending &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    choose.mutate(folder.id);
                  }
                }}
              />
              <Button
                variant="outline"
                disabled={open.isPending || choose.isPending}
                onClick={() => open.mutate(folder.id)}
              >
                <FolderOpen className="size-4" />
                Open
              </Button>
            </div>
          </div>
        </Fragment>
      ))}
    </Card>
  );
}
