"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// remounts on every dashboard navigation — one quick fade-rise per page
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 6 },
        // clearProps: a leftover inline transform would make this wrapper a
        // containing block that hijacks any fixed-position descendant
        { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", clearProps: "transform,opacity" },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="h-full">
      {children}
    </div>
  );
}
