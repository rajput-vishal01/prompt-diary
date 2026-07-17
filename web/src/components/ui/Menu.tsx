"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

// The Ink Glass dropdown menu — replaces every hand-rolled absolute-span menu
// (chunk 2). Radix supplies outside-click, Esc, arrow/typeahead navigation,
// focus return, and collision-aware flipping (which retires the old
// "menuOpensUp" measurement hack); this file supplies the material and the
// app's inset-bar selection vocabulary. Shares .glass-pop with Select.

export function Menu({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          style={{ transformOrigin: "var(--radix-dropdown-menu-content-transform-origin)" }}
          className="glass glass-pop z-[70] max-h-[min(320px,var(--radix-dropdown-menu-content-available-height))] min-w-40 max-w-[280px] overflow-y-auto rounded-xl p-1.5"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  children,
  danger = false,
  onSelect,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] outline-none transition-colors duration-100 ${
        danger
          ? "text-danger data-[highlighted]:bg-danger/10"
          : "text-ink data-[highlighted]:bg-white/70 data-[highlighted]:shadow-[inset_2px_0_0_#0c0a09]"
      }`}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />;
}
