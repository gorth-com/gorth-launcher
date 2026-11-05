import { net, type Session } from "electron";
import { Readable } from "node:stream";

/** Chromium fetch rejects manual redirects; expose them to the guarded downloader. */
export function createNetworkFetch(network: Session): typeof fetch {
  return async (input, init) => {
    const request = new Request(
      input instanceof URL ? input.href : input,
      init,
    );
    if (request.redirect !== "manual") return network.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD")
      throw new Error("Manual network redirects support GET and HEAD only.");
    request.signal.throwIfAborted();
    return new Promise<Response>((resolve, reject) => {
      const client = net.request({
        session: network,
        url: request.url,
        method: request.method,
        redirect: "manual",
        useSessionCookies: false,
      });
      for (const [name, value] of request.headers)
        client.setHeader(name, value);
      const abort = () => {
        reject(
          request.signal.reason ??
            new DOMException("Request aborted", "AbortError"),
        );
        client.abort();
      };
      request.signal.addEventListener("abort", abort, { once: true });
      client.once("close", () =>
        request.signal.removeEventListener("abort", abort),
      );
      client.on("error", reject);
      client.on("redirect", (status, _method, location, responseHeaders) => {
        const headers = new Headers();
        for (const [name, values] of Object.entries(responseHeaders))
          for (const value of values) headers.append(name, value);
        headers.set("location", location);
        resolve(new Response(null, { status, headers }));
        // The caller must validate the next URL before issuing another request.
        client.abort();
      });
      client.on("response", (response) => {
        const headers = new Headers();
        for (const [name, values] of Object.entries(response.headers)) {
          for (const value of Array.isArray(values) ? values : [values])
            headers.append(name, value);
        }
        const body =
          request.method === "HEAD" ||
          [204, 205, 304].includes(response.statusCode)
            ? null
            : (Readable.toWeb(
                response as unknown as Readable,
              ) as ReadableStream<Uint8Array>);
        resolve(
          new Response(body, {
            status: response.statusCode,
            statusText: response.statusMessage,
            headers,
          }),
        );
      });
      if (request.signal.aborted) abort();
      else client.end();
    });
  };
}
