import { Spinner } from "@gorth-com/primitive/pattern/spinner";
import { Button } from "@gorth-com/primitive/custom/button";

export function LoadingScreen({ error }: { error?: string }) {
  return (
    <div
      aria-label={error ? "Unable to load application" : "Loading"}
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex h-dvh w-screen flex-col items-center justify-center gap-4 overflow-hidden bg-background text-foreground"
      role="status"
    >
      {error ? (
        <>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </>
      ) : (
        <>
          <Spinner aria-hidden="true" size={32} variant="infinite" />
          <span className="sr-only">Loading...</span>
        </>
      )}
    </div>
  );
}
