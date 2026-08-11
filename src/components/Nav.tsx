"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overzicht" },
  { href: "/maand", label: "Maand invoeren" },
  { href: "/saldo", label: "Saldo" },
  { href: "/salaris", label: "Salaris" },
  { href: "/mail", label: "Mail" },
  { href: "/contracten", label: "Contracten" },
  { href: "/kinderen", label: "Kinderen" },
  { href: "/instellingen", label: "Instellingen" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2">
        <span className="mr-4 py-1 text-sm font-semibold">Verlofregistratie</span>
        {links.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--foreground)] dark:hover:bg-slate-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
