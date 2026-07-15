"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Ink dot follows the pointer tightly; a hairline ring trails on a softer
// ease and swells over interactive elements. Desktop fine-pointers only;
// reduced-motion and touch devices never see it.
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add("has-cursor");

    const dotX = gsap.quickTo(dot, "x", { duration: 0.09, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.09, ease: "power3.out" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3.out" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3.out" });

    let revealed = false;
    const move = (e: MouseEvent) => {
      if (!revealed) {
        revealed = true;
        // set, not tween: visibility must never depend on a ticking rAF
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY, opacity: 1 });
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    };

    const INTERACTIVE = "a, button, [role='button'], input, textarea, select, label, [data-cursor='hover']";
    const over = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      ring.classList.toggle("is-hover", !!t?.closest(INTERACTIVE));
    };

    const hide = () => gsap.set([dot, ring], { opacity: 0 });
    const show = () => revealed && gsap.set([dot, ring], { opacity: 1 });

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    document.documentElement.addEventListener("mouseleave", hide);
    document.documentElement.addEventListener("mouseenter", show);

    return () => {
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      document.documentElement.removeEventListener("mouseleave", hide);
      document.documentElement.removeEventListener("mouseenter", show);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="pd-cursor-ring" aria-hidden>
        <div className="pd-cursor-ring-visual" />
      </div>
      <div ref={dotRef} className="pd-cursor-dot" aria-hidden />
    </>
  );
}
