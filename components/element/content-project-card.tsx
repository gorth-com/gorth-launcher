import { Clock, Download } from "@gorth-io/primitive/cores/lucide";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@gorth-io/primitive/custom/avatar";
import { Badge } from "@gorth-io/primitive/custom/badge";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { formatDate, formatInitials, formatNumber } from "@/utils/formatter";
import type { ContentProject, ContentQuery } from "@/lib/content/interface";

interface ContentProjectCardProps {
  project: ContentProject;
  query: ContentQuery;
  layout: "list" | "grid";
  busy: boolean;
  onOpen: () => void;
  onInstall: () => void;
}

export function ContentProjectCard({
  project,
  query,
  layout,
  busy,
  onOpen,
  onInstall,
}: ContentProjectCardProps) {
  const vertical = layout === "grid";
  const categories = project.categories ?? [];
  const date = project.publishedAt ?? project.updatedAt;
  const iconUrl = project.iconUrl?.startsWith("https://")
    ? project.iconUrl
    : undefined;
  return (
    <Card className="gap-4 p-4">
      <CardContent
        className={`flex min-w-0 gap-4 p-0 ${vertical ? "h-full flex-col" : "flex-col sm:flex-row sm:items-start"}`}
      >
        <Avatar
          className={`rounded-2xl ${vertical ? "aspect-square size-auto w-full" : "size-32"}`}
        >
          <AvatarImage
            src={iconUrl}
            alt={project.name}
            className="rounded-2xl"
          />
          <AvatarFallback className="rounded-2xl text-2xl">
            {formatInitials(project.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 self-stretch">
          <div
            className={`flex items-start justify-between gap-4 ${vertical ? "flex-col" : "flex-wrap"}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle>
                <button
                  type="button"
                  className="text-left hover:underline"
                  disabled={busy}
                  onClick={onOpen}
                >
                  {project.name}
                </button>
              </CardTitle>
              {project.author && (
                <CardDescription className="truncate">
                  By {project.author}
                </CardDescription>
              )}
              <CardDescription className="line-clamp-2 break-words">
                {project.description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={onOpen}
                title="Choose a release on the project page"
              >
                <Download /> Download
              </Button>
              <Button variant="default" disabled={busy} onClick={onInstall}>
                Install
              </Button>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {categories.slice(0, vertical ? 1 : 2).map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
            {categories.length > (vertical ? 1 : 2) && (
              <Badge variant="secondary">
                +{categories.length - (vertical ? 1 : 2)}
              </Badge>
            )}
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Download className="size-3.5" />
              {formatNumber(project.downloads)}
            </span>
            {date && Number.isFinite(Date.parse(date)) && (
              <span
                title={project.publishedAt ? "Published" : "Updated"}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Clock className="size-3.5" />
                {formatDate(new Date(date))}
              </span>
            )}
            {query.loader && <Badge variant="secondary">{query.loader}</Badge>}
            {query.version && (
              <Badge variant="secondary">{query.version}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
