"use client";

import { GradualBlur } from "@/components/bits";

// The persistent viewport-bottom veil: content progressively dissolves as it
// exits the screen. On every public-facing page; never on the dashboard
// (a tool must not blur its own working rows).
export function PageVeil() {
  return (
    <GradualBlur
      target="page"
      position="bottom"
      height="4rem"
      strength={1.2}
      divCount={4}
      curve="ease-out"
      opacity={0.95}
      // pointer-events none inside; keep it under overlays (palette 90+, toast 100)
      style={{ zIndex: 30 }}
    />
  );
}
