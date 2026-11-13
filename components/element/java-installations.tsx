import { ScrollArea, ScrollBar } from "@gorth-io/primitive/default/scroll-area";
import { useState } from "react";
import { Input } from "@gorth-io/primitive/default/input";
import { Button } from "@gorth-io/primitive/custom/button";
import { RotateCw } from "@gorth-io/primitive/cores/lucide";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@gorth-io/primitive/default/card";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@gorth-io/primitive/default/dialog";
import { Separator } from "@gorth-io/primitive/default/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@gorth-io/primitive/default/table";
import type { JavaInstallation } from "@/lib/library/game-preferences";

interface JavaInstallationsProps {
  items: JavaInstallation[];
  loading: boolean;
  major?: number;
  variant?: "page" | "dialog";
  selectedPath?: string;
  title?: string;
  onRefresh: () => void;
  onSelect: (installation: JavaInstallation) => void;
}

interface JavaInstallationsViewProps {
  title: string;
  variant: "page" | "dialog";
  query: string;
  loading: boolean;
  filtered: JavaInstallation[];
  selected?: JavaInstallation;
  setQuery: (value: string) => void;
  setChoice: (value: string) => void;
  onRefresh: () => void;
  onSelect: (installation: JavaInstallation) => void;
}

export function JavaInstallations({
  items,
  loading,
  major,
  variant = "page",
  selectedPath = "",
  title = "Installed Java runtimes",
  onRefresh,
  onSelect,
}: JavaInstallationsProps) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const available = items.filter((item) => !major || item.major === major);
  const path =
    choice ??
    (selectedPath || available.find((item) => item.systemDefault)?.path || "");
  const selected = available.find((item) => item.path === path);
  const filtered = available.filter((item) =>
    `${item.version} ${item.architecture} ${item.vendor} ${item.path}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const Layout =
    variant === "dialog" ? JavaInstallationsDialog : JavaInstallationsCard;
  return (
    <Layout
      title={title}
      variant={variant}
      query={query}
      loading={loading}
      filtered={filtered}
      selected={selected}
      setQuery={setQuery}
      setChoice={setChoice}
      onRefresh={onRefresh}
      onSelect={onSelect}
    />
  );
}

export function JavaInstallationsSearch({
  variant,
  query,
  loading,
  setQuery,
  onRefresh,
}: Pick<
  JavaInstallationsViewProps,
  "variant" | "query" | "loading" | "setQuery" | "onRefresh"
>) {
  return (
    <div
      className={`flex min-w-0 gap-2 ${variant === "page" ? "w-[360px] max-w-full" : "w-full"}`}
    >
      <Input
        className="min-w-0 flex-1"
        aria-label="Search Java installations"
        placeholder="Search version, architecture, vendor or path…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="shrink-0"
        aria-label="Refresh Java installations"
        disabled={loading}
        onClick={onRefresh}
      >
        <RotateCw className={loading ? "animate-spin" : undefined} />
      </Button>
    </div>
  );
}

export function JavaInstallationsTable({
  variant,
  selected,
  filtered,
  loading,
  setChoice,
}: Pick<
  JavaInstallationsViewProps,
  "variant" | "selected" | "filtered" | "loading" | "setChoice"
>) {
  const Container = variant === "dialog" ? ScrollArea : "div";
  return (
    <>
      <Container
        className={
          variant === "dialog"
            ? "h-[min(20rem,45dvh)] min-w-0 [&_[data-slot=table-container]]:overflow-visible"
            : "min-w-0"
        }
      >
        <RadioGroup
          aria-label="Java installation"
          value={selected?.path ?? ""}
          onValueChange={(value) => setChoice(String(value))}
        >
          <Table className="[&_td]:px-4 [&_th]:px-4">
            <TableHeader>
              <TableRow className="h-14">
                <TableHead className="w-14">
                  <span className="sr-only">Select runtime</span>
                </TableHead>
                <TableHead className="w-28">Version</TableHead>
                <TableHead className="w-28">Architecture</TableHead>
                <TableHead className="w-28">Vendor</TableHead>
                <TableHead className="">Path</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow
                  key={item.path}
                  className="h-14 cursor-pointer"
                  data-state={
                    selected?.path === item.path ? "selected" : undefined
                  }
                  onClick={() => setChoice(item.path)}
                >
                  <TableCell>
                    <RadioGroupItem
                      value={item.path}
                      aria-label={`Select Java ${item.version} at ${item.path}`}
                    />
                  </TableCell>
                  <TableCell>{item.version}</TableCell>
                  <TableCell>{item.architecture}</TableCell>
                  <TableCell>{item.vendor}</TableCell>
                  <TableCell className="max-w-xl truncate" title={item.path}>
                    {item.path}
                    {item.systemDefault && (
                      <span className="ml-2 text-muted-foreground">
                        (System default)
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RadioGroup>
        {variant === "dialog" && <ScrollBar orientation="horizontal" />}
      </Container>
      {!filtered.length && (
        <p className="p-4 text-sm text-muted-foreground">
          {loading
            ? "Scanning installed runtimes…"
            : "No matching Java installation found. Use Browse or Refresh."}
        </p>
      )}
    </>
  );
}

export function JavaInstallationsUseButton({
  loading,
  selected,
  onSelect,
}: Pick<JavaInstallationsViewProps, "loading" | "selected" | "onSelect">) {
  return (
    <Button
      type="button"
      disabled={loading || !selected}
      onClick={() => {
        if (selected) onSelect(selected);
      }}
    >
      Use Java
    </Button>
  );
}

export function JavaInstallationsDialog(props: JavaInstallationsViewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription>
          Select a runtime, then choose Use Java to apply it.
        </DialogDescription>
        <JavaInstallationsSearch {...props} />
      </DialogHeader>
      <Separator />
      <div className="min-h-0">
        <JavaInstallationsTable {...props} />
      </div>
      <Separator />
      <DialogFooter>
        <JavaInstallationsUseButton {...props} />
      </DialogFooter>
    </>
  );
}

export function JavaInstallationsCard(props: JavaInstallationsViewProps) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 p-4">
        <CardTitle>{props.title}</CardTitle>
        <JavaInstallationsSearch {...props} />
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <JavaInstallationsTable {...props} />
      </CardContent>
      <Separator />
      <CardFooter className="justify-end p-4">
        <JavaInstallationsUseButton {...props} />
      </CardFooter>
    </Card>
  );
}
