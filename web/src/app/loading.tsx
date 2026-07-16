// Route-transition fallback for the whole app — a calm breathing wordmark
// instead of a blank flash or a spinner.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <span className="pd-breathe font-display text-2xl font-light tracking-tight text-ink">
        Prompt <span className="text-accent">Diary</span>
      </span>
    </div>
  );
}
