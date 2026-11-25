import type { ShortcutDefinition } from "@gorth-com/structure/modules/desktop";
import {
  Palette,
  PanelsTopLeft,
  Settings as SettingsIcon,
  Cpu,
  Trash2,
  Clock3,
  Info,
  Box,
  Folder,
  Bell,
  Camera,
  Package,
  Sparkles,
  Terminal,
  WandSparkles,
  Download,
  Home,
  Layers,
  Database,
  Keyboard,
  UserRound,
  Network,
  Languages,
  Wrench,
  Plug,
} from "@gorth-com/primitive/cores/lucide";
import type { Settings } from "@/utils/interface";
import type { Page } from "@/utils/interface";
import type { Theme } from "@/lib/theme";
import type { ContentKind } from "@/lib/content/interface";

import type { GamePhase } from "@/utils/interface";

export const gamePhaseLabels: Record<GamePhase, string> = {
  idle: "Chưa cài đặt",
  queued: "Trong hàng đợi",
  paused: "Đã tạm dừng",
  checking: "Đang kiểm tra",
  downloading: "Đang tải",
  ready: "Đã cài đặt",
  starting: "Đang khởi chạy",
  running: "Đang chơi",
  stopping: "Đang dừng",
  cancelled: "Đã hủy",
  crashed: "Đã crash",
  error: "Có lỗi",
};

export const navigation = [
  { id: "home", label: "Tổng quan", icon: Home },
  { id: "instances", label: "Instances", icon: Layers },
  { id: "accounts", label: "Accounts", icon: UserRound },
  { id: "pack", label: "Pack", icon: Package },
  { id: "modpacks", label: "Modpacks", icon: Layers },
  { id: "downloads", label: "Tải xuống", icon: Download },
  { id: "console", label: "Console", icon: Terminal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Cài đặt", icon: SettingsIcon },
] as const satisfies ReadonlyArray<{
  id: Page;
  label: string;
  icon: typeof Box;
}>;

export const launcherSettingsSections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "content", label: "Content", icon: PanelsTopLeft },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "profile", label: "Gorth profile", icon: UserRound },
  { id: "folders", label: "Folders", icon: Folder },
  { id: "language", label: "Language", icon: Languages },
  { id: "services", label: "Services", icon: Plug },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "proxy", label: "Proxy", icon: Network },
  { id: "instance", label: "Minecraft", icon: Box },
  { id: "runtime", label: "Java", icon: Cpu },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "history", label: "Launch History", icon: Clock3 },
  { id: "about", label: "About", icon: Info },
] as const;
export type LauncherSettingsSection =
  (typeof launcherSettingsSections)[number]["id"];

export const launcherPages = [
  "instances",
  "instances/create",
  "instances/data",
  "account",
  "settings/account",
  ...launcherSettingsSections.map((item) => `settings/${item.id}` as const),
  "home",
  "library",
  "downloads",
  "accounts",
  "settings",
  "settings/help",
  "content",
  "pack",
  "instance-data",
  "shortcuts",
  "mods",
  "modpacks",
  "resourcepacks",
  "shaders",
  "console",
  "gallery",
  "notifications",
] as const satisfies readonly Page[];

export const defaultSettings: Settings = {
  sidebarCollapsible: true,
  sidebarCollapseMode: "none",
  tabLayout: "separate",
  showTitlebarLogo: true,
  memory: 4,
  javaPath: "",
  javaPaths: { "17": "", "21": "", "25": "" },
  trashRetentionDays: 30,
  keepSavesOnTrashCleanup: true,
};

export const themeLabels: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export const accountProviderNames = {
  offline: "Offline",
  ely: "Ely.by",
  gorth: "Gorth",
};

export const shortcutDefinitions: ShortcutDefinition[] = [
  {
    id: "new-instance",
    label: "New Instance…",
    defaultAccelerator: "CmdOrCtrl+N",
  },
  { id: "library", label: "Library", defaultAccelerator: "CmdOrCtrl+L" },
  { id: "downloads", label: "Downloads", defaultAccelerator: "CmdOrCtrl+J" },
  { id: "settings", label: "Settings…", defaultAccelerator: "CmdOrCtrl+," },
  { id: "home", label: "Overview", defaultAccelerator: "CmdOrCtrl+1" },
  { id: "accounts", label: "Accounts", defaultAccelerator: "CmdOrCtrl+2" },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    defaultAccelerator: "CmdOrCtrl+Shift+K",
  },
];

export const updateRepository = {
  owner: "gorth-io",
  repository: "gorth-launcher",
} as const;

// Deliberately curated releases, not a moving 'latest' channel.
export const loaderCatalog = [
  { loader: "Forge", minecraft: "1.20.1", version: "47.4.28" },
  { loader: "Forge", minecraft: "1.20.1", version: "47.4.10" },
  { loader: "Forge", minecraft: "1.20.1", version: "47.4.0" },
  { loader: "Forge", minecraft: "1.19.2", version: "43.5.0" },
  { loader: "NeoForge", minecraft: "1.20.1", version: "47.1.106" },
  { loader: "NeoForge", minecraft: "1.21.1", version: "21.1.217" },
  { loader: "Fabric", minecraft: "1.20.1", version: "0.16.14" },
  // Fabulously Optimized 6.5.0 release pins this version on Minecraft 1.21.1.
  { loader: "Fabric", minecraft: "1.21.1", version: "0.19.3" },
  { loader: "Fabric", minecraft: "1.21.1", version: "0.16.14" },
] as const;

export const contentIcons = {
  mod: Package,
  modpack: Layers,
  resourcepack: Sparkles,
  shader: WandSparkles,
  datapack: Database,
  world: Database,
};

export const contentLabels: Record<ContentKind, string> = {
  mod: "Mod",
  modpack: "Modpack",
  shader: "Shader",
  resourcepack: "Texture pack",
  datapack: "Data pack",
  world: "World",
};

export const curseforgeClasses: Record<ContentKind, number> = {
  mod: 6,
  modpack: 4471,
  shader: 6552,
  resourcepack: 12,
  datapack: 6945,
  world: 17,
};

export const curseforgePaths: Record<ContentKind, string> = {
  mod: "mc-mods",
  modpack: "modpacks",
  shader: "shaders",
  resourcepack: "texture-packs",
  datapack: "data-packs",
  world: "worlds",
};

export const curseforgeLoaderIds: Record<string, number> = {
  Forge: 1,
  Fabric: 4,
  NeoForge: 6,
};

export const artifactHosts = new Set([
  "piston-meta.mojang.com",
  "launchermeta.mojang.com",
  "piston-data.mojang.com",
  "launcher.mojang.com",
  "libraries.minecraft.net",
  "resources.download.minecraft.net",
  "api.adoptium.net",
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "authlib-injector.yushi.moe",
  "meta.fabricmc.net",
  "maven.fabricmc.net",
  "maven.minecraftforge.net",
  "maven.neoforged.net",
  "cdn.modrinth.com",
  "edge.forgecdn.net",
  "mediafilez.forgecdn.net",
  "media.forgecdn.net",
  "raw.githubusercontent.com",
  "gitlab.com",
]);

export const reservedShortcuts = [
  "CmdOrCtrl+C",
  "CmdOrCtrl+V",
  "CmdOrCtrl+X",
  "CmdOrCtrl+A",
  "CmdOrCtrl+Z",
  "CmdOrCtrl+Shift+Z",
  "CmdOrCtrl+Q",
  "CmdOrCtrl+H",
  "CmdOrCtrl+M",
  "CmdOrCtrl+Shift+W",
  "CmdOrCtrl+Alt+I",
  "Ctrl+Shift+I",
  "F11",
];
import {
  Flame as FlameIcon,
  FileText as NotesIcon,
  Server as ServerIcon,
} from "@gorth-com/primitive/cores/lucide";

export const instanceCreateSections = [
  { id: "custom", title: "Custom", icon: Box },
  { id: "modrinth", title: "Modrinth", icon: Package },
  { id: "curseforge", title: "CurseForge", icon: FlameIcon },
] as const;
export const instanceEditSections = [
  { id: "overview", title: "Overview", icon: Box },
  { id: "console", title: "Minecraft log", icon: Terminal },
  { id: "version", title: "Version", icon: Layers },
  { id: "mod", title: "Mods", icon: Package },
  { id: "resourcepack", title: "Resource packs", icon: Sparkles },
  { id: "shader", title: "Shader packs", icon: WandSparkles },
  { id: "notes", title: "Notes", icon: NotesIcon },
  { id: "worlds", title: "Worlds", icon: Database },
  { id: "servers", title: "Servers", icon: ServerIcon },
  { id: "screenshots", title: "Screenshots", icon: Camera },
  { id: "settings", title: "Settings", icon: SettingsIcon },
  { id: "logs", title: "Other logs", icon: Clock3 },
] as const;
