export default function desktopError(error: {
  status?: number;
  statusCode?: number;
}) {
  const status = error.status ?? error.statusCode ?? 500;
  return new Response(
    status >= 500
      ? "Desktop service unavailable."
      : status === 413
        ? "Request body too large."
        : "Request rejected.",
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
