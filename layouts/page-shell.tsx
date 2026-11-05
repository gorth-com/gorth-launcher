import type { ReactNode } from "react";

export function PageShell({
  children,
  aside,
  heading,
}: {
  children: ReactNode;
  aside?: ReactNode;
  heading?: ReactNode;
}) {
  return aside || heading ? (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <section className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {children}
      </section>
      <aside className="flex min-w-0 flex-col gap-6">
        {heading}
        {aside}
      </aside>
    </div>
  ) : (
    <section className="flex flex-col gap-4">{children}</section>
  );
}
