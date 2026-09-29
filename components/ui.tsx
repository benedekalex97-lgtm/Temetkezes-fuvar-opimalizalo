"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Gomb
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "urgent" | "urgent-outline";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-strong shadow-card disabled:bg-ink-3/40 disabled:text-white",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-subtle disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-sunken/70 hover:text-ink disabled:text-ink-3",
  urgent: "bg-urgent text-white hover:bg-urgent-strong shadow-card disabled:opacity-50",
  "urgent-outline":
    "bg-surface text-urgent border border-urgent-line hover:bg-urgent-soft disabled:opacity-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kártya
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("rounded-xl border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Címke
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "primary" | "urgent" | "warn" | "ok" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 border-line",
  primary: "bg-primary-soft text-primary border-primary-line",
  urgent: "bg-urgent-soft text-urgent border-urgent-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  muted: "bg-surface text-ink-3 border-line",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[12px] font-medium leading-4",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[12.5px] font-medium tracking-tight", className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Párbeszédablak és oldalpanel
// ---------------------------------------------------------------------------

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEscape(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cx(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-raised outline-none sm:rounded-2xl",
          width,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1050] flex justify-end">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-[520px] flex-col bg-surface shadow-raised"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Űrlapelemek
// ---------------------------------------------------------------------------

export const inputClass =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}
