// Segment loading fallback inside the dashboard shell (the sidebar stays put).
// A quiet manuscript skeleton echoing the list surface most pages render.
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="skeleton h-9 w-44" />
      <div className="skeleton mt-6 h-11 w-full" />
      <div className="panel mt-4 divide-y divide-line">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex h-16 items-center gap-4 px-4">
            <span className="min-w-0 flex-1">
              <span className="skeleton block h-4 w-2/5" />
              <span className="skeleton mt-2 block h-3 w-3/5" />
            </span>
            <span className="skeleton h-5 w-12 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
