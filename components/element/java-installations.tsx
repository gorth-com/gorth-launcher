import { useState } from "react";
import { Input } from "@gorth-io/primitive/default/input";
import { Button } from "@gorth-io/primitive/custom/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@gorth-io/primitive/default/table";
import type { JavaInstallation } from "@/lib/library/game-preferences";

interface JavaInstallationsProps {
  items: JavaInstallation[];
  loading: boolean;
  major?: number;
  variant?: "page" | "dialog";
  onRefresh: () => void;
  onSelect: (installation: JavaInstallation) => void;
}
export function JavaInstallations({ items, loading, major, variant = "page", onRefresh, onSelect }: JavaInstallationsProps) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => (!major || item.major === major) &&
    `${item.version} ${item.architecture} ${item.vendor} ${item.path}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex gap-2"><Input className="min-w-0 flex-1" aria-label="Search Java installations" placeholder="Search version, architecture, vendor or path…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Button type="button" variant="outline" disabled={loading} onClick={onRefresh}>Refresh</Button></div>
    <div className={variant === "dialog" ? "scroll-fade scrollbar-none max-h-[min(20rem,45dvh)] overflow-auto py-2" : "min-w-0"}>
      <Table><TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Architecture</TableHead><TableHead>Vendor</TableHead><TableHead>Path</TableHead><TableHead><span className="sr-only">Select runtime</span></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map((item) => <TableRow key={item.path}><TableCell>{item.version}</TableCell><TableCell>{item.architecture}</TableCell><TableCell>{item.vendor}</TableCell><TableCell className="break-all whitespace-normal">{item.path}</TableCell><TableCell><Button type="button" variant="outline" onClick={() => onSelect(item)}>Use</Button></TableCell></TableRow>)}</TableBody>
      </Table>
    </div>
    {!filtered.length && <p className="text-sm text-muted-foreground">{loading ? "Scanning installed runtimes…" : major ? `No Java ${major} installation matches. Use Browse or Refresh.` : "No matching Java installation found. Use Browse or Refresh."}</p>}
  </div>;
}
