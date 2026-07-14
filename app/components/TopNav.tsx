"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { signOut } from "@/app/auth/actions";

const TABS = [
  { href: "/", label: "Resumen" },
  { href: "/permisos", label: "Permisos" },
  { href: "/pagos", label: "Pagos" },
  { href: "/seguimiento", label: "Seguimiento" },
];

export function TopNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link href="/" className="order-1 flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="Portland Saxum" className="h-6 w-auto sm:h-7" />
        </Link>
        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:ml-2 sm:w-auto">
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

        <div className="order-2 ml-auto flex shrink-0 items-center gap-3 sm:order-3">
          {userEmail && (
            <span className="hidden text-xs text-white/70 sm:inline">{userEmail}</span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
