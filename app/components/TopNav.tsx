"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/", label: "Resumen" },
  { href: "/permisos", label: "Permisos" },
  { href: "/seguimiento", label: "Seguimiento" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded bg-white/15 text-sm">
            PS
          </span>
          Portland Saxum
        </Link>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
