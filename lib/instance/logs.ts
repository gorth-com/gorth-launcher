import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function readLogPreview(file: string) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 16 * 1024 ** 2)
      throw new Error("Log vượt giới hạn đọc 16 MB.");
    const limit = 2 * 1024 ** 2;
    const chunks: Buffer[] = [];
    let total = 0,
      retained = 0;
    const sink = new Writable({
      write(value: Buffer, _encoding, callback) {
        total += value.length;
        if (total > 64 * 1024 ** 2) {
          callback(new Error("Log giải nén vượt giới hạn 64 MB."));
          return;
        }
        chunks.push(value);
        retained += value.length;
        while (retained > limit && chunks.length) {
          const excess = retained - limit;
          const first = chunks[0];
          if (first.length <= excess) {
            retained -= first.length;
            chunks.shift();
          } else {
            chunks[0] = first.subarray(excess);
            retained -= excess;
          }
        }
        callback();
      },
    });
    const source = handle.createReadStream({ autoClose: false });
    if (/\.gz$/i.test(file)) await pipeline(source, createGunzip(), sink);
    else await pipeline(source, sink);
    return {
      content: Buffer.concat(chunks, retained).toString("utf8"),
      truncated: total > limit,
    };
  } finally {
    await handle.close();
  }
}
