"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// The Ink Glass tooltip — retires native title= on icon-only controls
// (chunk 3). One TipProvider at the root gives the canonical feel: 300ms
// delay on the FIRST tooltip, then instant for neighbors while the pointer
// keeps moving (skipDelayDuration). Content is a small glass chip that
// materializes from the trigger side via .glass-pop.

export function TipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={500}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          style={{ transformOrigin: "var(--radix-tooltip-content-transform-origin)" }}
          className="glass glass-pop z-[80] max-w-[240px] select-none rounded-lg px-2.5 py-1 text-xs font-medium text-ink"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
