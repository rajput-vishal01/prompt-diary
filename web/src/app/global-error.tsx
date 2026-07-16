"use client";

// Last-resort boundary: catches errors in the root layout itself, so it must
// render its own <html>/<body> and cannot rely on the app's fonts or CSS.
// Editorial Ink palette is inlined so it renders even if everything else fails.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
          color: "#0c0a09",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 300,
              fontSize: 30,
              letterSpacing: "-0.01em",
            }}
          >
            Something broke badly
          </h1>
          <p
            style={{
              marginTop: 12,
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#57534e",
            }}
          >
            The app hit an error it couldn&apos;t recover from. Reloading usually clears it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: "#292524",
              color: "#fff",
              border: 0,
              borderRadius: 9999,
              padding: "9px 20px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontFamily: "monospace", fontSize: 11, color: "#57534e" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
