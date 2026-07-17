"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpecularButton, Strands } from "@/components/bits";

// the landing hero's pastel orb palette, played quietly
const STRAND_COLORS = ["#34d399", "#fb923c", "#a78bfa", "#38bdf8"];

// SSR renders the motion-safe fallback; WebGL mounts only after the
// client confirms motion is welcome (same pattern as the landing page)
function useMotionOK() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return ok;
}

/** A quiet ribbon of strands dissolving down behind the share-page
 *  masthead — the one kinetic note a public share page gets. */
export function ShareHeaderBand() {
  const motionOK = useMotionOK();
  if (!motionOK) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 overflow-hidden opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]"
    >
      <Strands
        colors={STRAND_COLORS}
        count={3}
        speed={0.2}
        amplitude={0.7}
        waviness={0.8}
        thickness={0.5}
        glow={1.6}
        taper={2}
        spread={1}
        intensity={0.35}
      />
    </div>
  );
}

/** Footer CTA — the landing's ink specular pill; plain pill under
 *  reduced motion and during SSR. */
export function ShareCta({ label }: { label: string }) {
  const router = useRouter();
  const motionOK = useMotionOK();
  if (!motionOK) {
    return (
      <Link
        href="/"
        className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ink"
      >
        {label}
      </Link>
    );
  }
  return (
    <SpecularButton
      size="sm"
      radius={999}
      tint="#0c0a09"
      tintOpacity={0.92}
      textColor="#fafafa"
      lineColor="#ffffff"
      baseColor="#57534e"
      intensity={1}
      shineSize={12}
      shineFade={42}
      thickness={1}
      followMouse
      proximity={200}
      onClick={() => router.push("/")}
    >
      {label}
    </SpecularButton>
  );
}
