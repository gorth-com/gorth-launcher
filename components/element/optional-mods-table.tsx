import {
  ScrollArea,
  ScrollBar,
} from "@gorth-com/primitive/default/scroll-area";
import { useState } from "react";
import {
  useTable,
  tableFeatures,
  rowSelectionFeature,
  type RowSelectionState,
} from "@gorth-com/primitive/cores/tanstack/table";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@gorth-com/primitive/default/table";
import { Checkbox } from "@gorth-com/primitive/default/checkbox";
import { Button } from "@gorth-com/primitive/custom/button";
import { DialogFooter } from "@gorth-com/primitive/default/dialog";
import { Separator } from "@gorth-com/primitive/default/separator";
import { toast } from "@/providers/toaster";
import type { OptionalMod } from "@/lib/content/interface";

const columns = [{ id: "select" }, { accessorKey: "name" }];
const features = tableFeatures({ rowSelectionFeature });
export function OptionalModsTable({
  requestId,
  items,
  onCancel,
}: {
  requestId: string;
  items: OptionalMod[];
  onCancel: () => void;
}) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pending, setPending] = useState(false);
  const table = useTable({
    features,
    data: items,
    columns,
    getRowId: (item) => item.id,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    enableRowSelection: true,
  });
  async function confirm() {
    setPending(true);
    try {
      const result = await window.electronAPI.content.selectOptional(
        requestId,
        table.getSelectedRowModel().rows.map((row) => row.id),
      );
      if (!result.ok) throw new Error(result.error);
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không lưu được lựa chọn mod.",
      });
      setPending(false);
    }
  }
  return (
    <>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=table-container]]:overflow-visible">
        <Table className="[&_td]:px-4 [&_th]:px-4">
          <TableHeader>
            <TableRow className="h-14">
              <TableHead className="w-14">
                <Checkbox
                  aria-label="Chọn tất cả mod tùy chọn"
                  checked={table.getIsAllRowsSelected()}
                  indeterminate={table.getIsSomeRowsSelected()}
                  disabled={pending || !items.length}
                  onCheckedChange={(checked) =>
                    table.toggleAllRowsSelected(checked)
                  }
                />
              </TableHead>
              <TableHead>Mod</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-14 cursor-pointer"
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={() => {
                  if (!pending) row.toggleSelected();
                }}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Bật ${row.original.name}`}
                    checked={row.getIsSelected()}
                    disabled={pending}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                  />
                </TableCell>
                <TableCell className="break-all">{row.original.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Separator />
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={pending} onClick={() => void confirm()}>
          Tiếp tục
        </Button>
      </DialogFooter>
    </>
  );
}
