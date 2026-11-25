import type { Artifact } from "@/utils/interface";
export type ContentProvider = "modrinth" | "curseforge";
export type ContentKind =
  "mod" | "modpack" | "shader" | "resourcepack" | "datapack" | "world";
export interface ContentQuery {
  provider: ContentProvider;
  kind: ContentKind;
  query: string;
  version: string;
  loader: string;
  offset: number;
  limit?: number;
  sort?: "relevance" | "downloads" | "updated";
}
export interface ContentProject {
  id: string;
  url: string;
  name: string;
  description: string;
  downloads: number;
  iconUrl?: string;
  author?: string;
  categories?: string[];
  updatedAt?: string;
  publishedAt?: string;
}
export interface ContentVersion {
  id: string;
  name: string;
  filename: string;
  gameVersions?: string[];
  loaders?: string[];
}
export interface ModpackOverview {
  name: string;
  currentVersion: string;
  source: { provider: ContentProvider; projectId: string; versionId: string } | null;
  website?: string;
  versions: ContentVersion[];
  onlineError?: string;
}
export interface ContentStatus {
  optionalMods?: { requestId: string; items: OptionalMod[] };
  logs?: string[];
  busy: boolean;
  message: string;
  completed: number;
  total: number;
  error?: string;
}
export interface ContentInstall {
  query: ContentQuery;
  projectId: string;
  versionId: string;
  instanceId?: string;
  worldName?: string;
}
export interface OptionalMod {
  id: string;
  name: string;
}
export interface ContentFile {
  websiteDownload?: string;
  directory?: "mods" | "resourcepacks" | "shaderpacks" | "datapacks";
  projectId: string;
  versionId: string;
  filename: string;
  artifact: Artifact;
  required: { projectId?: string; versionId?: string }[];
  conflicts?: string[];
}
export interface InstalledContent {
  origin?: {
    provider: ContentProvider;
    projectId?: string;
    versionId?: string;
  };
  checksum?: string;
  metadata?: InstalledModMetadata;
  id: string;
  provider: ContentProvider | null;
  kind: ContentKind;
  projectId: string | null;
  versionId: string | null;
  filename: string;
  directory: string;
  worldName?: string;
  enabled: boolean;
  managed: boolean;
  modified: boolean;
  update?: ContentVersion;
}
export interface InstalledModMetadata {
  provider?: ContentProvider;
  projectId?: string;
  versionId?: string;
  versionName?: string;
  project: ContentProject;
}
export interface ContentInventory {
  metadataError?: string;
  instanceId: string;
  worlds: string[];
  items: InstalledContent[];
}
export type ContentManageAction = "enable" | "disable" | "remove" | "update";
export interface ContentManage {
  action: ContentManageAction;
  instanceId: string;
  id: string;
}
export interface ContentResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
