import {
  mkdtemp,
  writeFile,
  rm,
  chmod,
  mkdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import {
  inspectJava,
  checkJava,
  ensureJava,
  discoverJava,
} from "@/lib/game/java";
import { javaPreferencesSchema } from "@/lib/library/game-preferences";
it("discovers symlinked Java installations without looping or merging distinct vendors", async () => {
  if (process.platform === "win32")
    throw new Error("This executable fixture requires a POSIX host.");
  const root = await mkdtemp(path.join(tmpdir(), "gorth-java-discovery-"));
  try {
    await mkdir(path.join(root, "runtime"));
    for (const vendor of ["VendorA", "VendorB"]) {
      const home = path.join(root, vendor);
      await mkdir(path.join(home, "bin"), { recursive: true });
      const file = path.join(home, "bin/java");
      await writeFile(
        file,
        `#!/bin/sh\nprintf '%s\\n' 'java.version = 21.0.1' 'java.vendor = ${vendor}' 'os.arch = amd64'\n`,
      );
      await chmod(file, 0o755);
      await symlink(home, path.join(root, "runtime", vendor));
    }
    await symlink(
      path.join(root, "VendorA"),
      path.join(root, "runtime", "duplicate"),
    );
    await symlink(
      path.join(root, "runtime"),
      path.join(root, "runtime", "cycle"),
    );
    const found = (await discoverJava(root)).filter((item) =>
      ["VendorA", "VendorB"].includes(item.vendor),
    );
    expect(found).toHaveLength(2);
    expect(found.map((item) => item.vendor)).toEqual(["VendorA", "VendorB"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
it("probes a selected executable without a shell and enforces required version", async () => {
  if (process.platform === "win32")
    throw new Error("This executable fixture requires a POSIX host.");
  const root = await mkdtemp(path.join(tmpdir(), "gorth-java-probe-"));
  const executable = path.join(root, "fixture-java");
  try {
    await writeFile(
      executable,
      "#!/bin/sh\nprintf '%s\\n' 'java.version = 17.0.1' 'java.vendor = Fixture Vendor' 'os.arch = " +
        (process.arch === "arm64" ? "aarch64" : "amd64") +
        "'\n",
    );
    await chmod(executable, 0o755);
    expect(await inspectJava(executable)).toMatchObject({
      major: 17,
      vendor: "Fixture Vendor",
    });
    expect(await checkJava(executable, 17)).toBe(executable);
    await expect(checkJava(executable, 21)).rejects.toThrow("Java 21");
    expect(
      await ensureJava(
        root,
        executable,
        AbortSignal.timeout(5000),
        () => {},
        21,
        javaPreferencesSchema.parse({
          skipCompatibilityChecks: true,
          autoDetect: false,
        }),
      ),
    ).toBe(executable);
    await expect(
      ensureJava(
        root,
        executable,
        AbortSignal.timeout(5000),
        () => {},
        21,
        javaPreferencesSchema.parse({ autoDetect: false }),
      ),
    ).rejects.toThrow("Java 21");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
