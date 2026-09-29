import * as React from "react";
import { cn } from "@/lib/utils";

interface MasterDetailShellProps {
  /** Arbitrary sidebar content: link lists, search boxes, action buttons — caller keeps full control. */
  sidebar: React.ReactNode;
  /** Main content area, typically <Outlet />. */
  children: React.ReactNode;
  /** Escape hatch for the outer wrapper (e.g. settings.tsx's existing top padding). */
  className?: string;
}

/**
 * Shared master-detail shell for the Settings section — a fixed-width nav
 * rail beside a flexible content area. Replaces the percentage-based
 * w-1/4/w-3/4 split that used to be hand-copied into every settings route:
 * being a fraction of an unconstrained parent, it ballooned on wide
 * monitors while the actual content stayed narrow and centered.
 */
export function MasterDetailShell({ sidebar, children, className }: MasterDetailShellProps) {
  return (
    <div className={cn("flex flex-col md:flex-row", className)}>
      <aside className="flex flex-col w-full md:w-72 md:shrink-0 items-start p-4 border-b md:border-b-0 md:border-r border-gray-300 border-dashed">
        {sidebar}
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
