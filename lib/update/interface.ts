export type UpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";
export interface UpdateState {
  version: string;
  status: UpdateStatus;
  availableVersion?: string;
  message: string;
}
