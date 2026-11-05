import { createNitro, prepare, build } from "nitro/builder";

export async function buildDesktopBackend(root: string) {
  const nitro = await createNitro({ rootDir: root }, { dotenv: false });
  try {
    await prepare(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }
}
