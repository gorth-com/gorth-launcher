export interface FolderLocation {
  id: string;
  label: string;
  path: string;
  activePath: string;
  editable: boolean;
  description?: string;
}
export interface FolderSnapshot {
  folders: FolderLocation[];
  restartRequired: boolean;
}
