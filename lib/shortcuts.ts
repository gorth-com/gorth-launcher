import { reservedShortcuts } from "@/utils/constant";
import {
  createShortcutValidator,
  type Shortcut,
} from "@gorth-com/structure/modules/desktop";
export {
  normalizeAccelerator,
  shortcutIdentity,
  type Shortcut,
  type ShortcutDefinition,
} from "@gorth-com/structure/modules/desktop";

// App/OS menu policy stays local; shared core normalizes and checks collisions.

export function validateShortcutChange(
  shortcuts: Shortcut[],
  id: string,
  value: string,
  isMac: boolean,
) {
  return createShortcutValidator({ isMac, reserved: reservedShortcuts })(
    shortcuts,
    id,
    value,
  );
}
