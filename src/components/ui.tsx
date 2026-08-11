import type { ReactNode } from "react";

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

/** Basisstijl zonder breedte, zodat een aanroeper zelf w-* kan bepalen. */
export const controlClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

export const inputClass = `w-full ${controlClass}`;

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    warning:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    error:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
    success:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  } as const;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-[var(--muted)]">{children}</div>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Voortgangsbalk voor een saldo; waarden boven 100% lopen zichtbaar over. */
export function ProgressBar({
  value,
  max,
  colorHex,
}: {
  value: number;
  max: number;
  colorHex?: string | null;
}) {
  const percent = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const over = max > 0 && value > max;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${percent}%`,
          backgroundColor: over ? "#dc2626" : (colorHex ?? "var(--accent)"),
        }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
