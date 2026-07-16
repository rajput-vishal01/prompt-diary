import Link from "next/link";

// Shared editorial frame for every status surface — 404, error boundaries,
// hard-empty states. One component so they read as one system. `compact` drops
// the wordmark + full-height so it can sit inside the dashboard shell.
export function StatusScreen({
  code,
  title,
  message,
  compact = false,
  children,
}: {
  code?: string;
  title: string;
  message: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto flex ${
        compact ? "min-h-[60vh]" : "min-h-screen"
      } w-full max-w-lg flex-col items-center justify-center px-6 text-center`}
    >
      {!compact && (
        <Link href="/" className="mb-12 font-display text-xl font-light tracking-tight text-ink">
          Prompt <span className="text-accent">Diary</span>
        </Link>
      )}
      {code && (
        <p className="font-display text-[76px] font-light leading-none tracking-[-0.04em] text-line-strong">
          {code}
        </p>
      )}
      <h1 className="mt-4 text-balance font-display text-3xl font-light tracking-[-0.01em] text-ink">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-dim">{message}</p>
      {children && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
      )}
    </div>
  );
}
