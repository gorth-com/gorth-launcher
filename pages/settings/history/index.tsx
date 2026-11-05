import { useMemo } from "react";
import type { ColumnDef } from "@gorth-io/primitive/cores/tanstack/table";
import { DataTable, dataTableFeatures } from "@/components/custom/data-table";
import type { PlaySession } from "@/utils/interface";
import { formatDateTime, formatMinutes, formatPlayTime } from "@/utils/formatter";

const columns: ColumnDef<typeof dataTableFeatures, PlaySession>[] = [
  { accessorKey: "instanceId", header: "Instance" },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => formatDateTime(row.original.startedAt),
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => formatMinutes(row.original.duration, "min"),
  },
  {
    accessorKey: "crashed",
    header: "Status",
    cell: ({ row }) => (row.original.crashed ? "Crash" : "Exited"),
  },
];
function getSearchText(item: PlaySession) {
  return item.instanceId + " " + (item.crashed ? "Crash" : "Exited");
}
export function LaunchHistory({ history, locale, hours = false, showTime = true }: { history: PlaySession[]; locale?: string; hours?: boolean; showTime?: boolean }) {
  const localizedColumns = columns.map((column) => "accessorKey" in column && column.accessorKey === "startedAt"
    ? { ...column, cell: ({ row }: { row: { original: PlaySession } }) => formatDateTime(row.original.startedAt, locale) }
    : "accessorKey" in column && column.accessorKey === "duration"
      ? { ...column, cell: ({ row }: { row: { original: PlaySession } }) => showTime ? formatPlayTime(row.original.duration, hours) : "—" }
      : column);
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.startedAt - a.startedAt),
    [history],
  );
  return (
    <DataTable
      data={sorted}
      columns={localizedColumns}
      getSearchText={getSearchText}
      searchLabel="Search launch history"
      emptyLabel={
        history.length ? "No matching sessions." : "Chưa có phiên chơi."
      }
    />
  );
}
