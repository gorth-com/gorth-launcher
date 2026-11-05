import { createPortal } from "react-dom";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { PoolContext } from "@/providers/portal";
import { confirmations } from "@/lib/confirmation";
import { toast } from "@/providers/toaster";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/custom/alert-dialog";

function ConfirmationSurface() {
  const request = useSyncExternalStore(
    confirmations.subscribe,
    confirmations.current,
    () => null,
  );
  const pool = useContext(PoolContext);
  const [entry, setEntry] =
    useState<ReturnType<NonNullable<typeof pool>["take"]>>(null);
  const [ready, setReady] = useState(false);
  const active = !!request;
  useLayoutEffect(() => {
    if (!active) return;
    const next = pool?.take();
    if (!next) {
      if (request) confirmations.answer(request.id, false);
      toast.add({
        title: "Unable to open confirmation dialog. Please try again.",
        type: "error",
      });
      return;
    }
    setEntry(next);
    return () => {
      setReady(false);
      setEntry(null);
      pool?.release(next);
    };
  }, [active, pool]);
  useLayoutEffect(() => {
    if (!entry || entry.window.closed) return;
    const doc = entry.window.document;
    let disposed = false;
    const syncTheme = () => {
      doc.documentElement.className = document.documentElement.className;
      doc.documentElement.style.colorScheme =
        document.documentElement.style.colorScheme;
    };
    syncTheme();
    const base = doc.createElement("base");
    base.href = document.baseURI;
    const sheets = Array.from(
      document.head.querySelectorAll('style,link[rel="stylesheet"]'),
    ).map((node) => node.cloneNode(true));
    const loaded = sheets.flatMap((node) =>
      node.nodeName === "LINK"
        ? [
            new Promise<void>((resolve) => {
              node.addEventListener("load", () => resolve(), { once: true });
              node.addEventListener("error", () => resolve(), { once: true });
            }),
          ]
        : [],
    );
    doc.head.replaceChildren(base, ...sheets);
    void Promise.all(loaded).then(() => {
      if (!disposed) setReady(true);
    });
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [entry]);
  useLayoutEffect(() => {
    if (!entry || !ready) return;
    const update = () =>
      window.electronAPI.portal.update(entry.id, {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [entry, ready]);
  if (!request || !entry || entry.window.closed || !ready) return null;
  const settle = (answer: boolean) => confirmations.answer(request.id, answer);
  return createPortal(
    <AlertDialog
      key={request.id}
      open
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent
        container={entry.window.document.body}
        initialFocus={() =>
          entry.window.document.querySelector<HTMLButtonElement>(
            '[data-slot="alert-dialog-cancel"]',
          )
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {request.description ??
              "Chỉ tiếp tục nếu bạn chắc chắn muốn thực hiện thao tác này."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {request.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={request.destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {request.confirmLabel ?? "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
    entry.window.document.body,
  );
}
export function ConfirmationProvider({
  children,
}: {
  children: import("react").ReactNode;
}) {
  useEffect(() => {
    const api = window.electronAPI.confirmation;
    if (!api) return () => confirmations.cancelAll();
    const unsubscribe = api.onRequest((request) => {
      void confirmations
        .ask(request, request.id)
        .then((answer) => api.answer(request.id, answer));
    });
    const unsubscribeCancel = api.onCancel((id) =>
      confirmations.answer(id, false),
    );
    return () => {
      unsubscribe();
      unsubscribeCancel();
      confirmations.cancelAll();
    };
  }, []);
  return (
    <>
      {children}
      <ConfirmationSurface />
    </>
  );
}
