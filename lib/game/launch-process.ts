import { legacyArguments } from "./install";

// Keep Java's argument array intact, including paths with spaces and tokens.
// The caller spawns this command with shell:false and never logs its arguments.
export function launchProcess(
  java: string,
  args: string[],
  wrapperCommand = "",
) {
  const wrapper = legacyArguments(wrapperCommand);
  return {
    executable: wrapper[0] ?? java,
    arguments: wrapper.length ? [...wrapper.slice(1), java, ...args] : args,
  };
}
