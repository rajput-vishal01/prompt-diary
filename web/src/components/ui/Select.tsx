"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

// The Ink Glass select — replaces every native <select> (chunk 1 of the
// elevation plan). Radix supplies the semantics (ARIA combobox, arrows,
// typeahead, collision-aware positioning); this file supplies the material:
// a glass panel that materializes out of its trigger (scale + blur resolve,
// 160ms in / 120ms out via .glass-pop) with the app's 2px inset-bar
// selection vocabulary.

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  /** trigger sizing/width classes, e.g. "h-11 w-36" — matches old .input selects */
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

// Radix forbids value="" on items; the app's "none" options use it ("No
// folder", "All visibility"). Bridge with a sentinel at this boundary.
const NONE = "__none__";
const toRadix = (v: string) => (v === "" ? NONE : v);
const fromRadix = (v: string) => (v === NONE ? "" : v);

export function Select({ value, onValueChange, options, className = "", ariaLabel, disabled }: Props) {
  // render the selected label ourselves: Radix's <Value> only learns item
  // text when items MOUNT (i.e. on first open), so it SSRs — and first
  // paints — as an empty trigger. We own the options list; look it up.
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  return (
    <SelectPrimitive.Root value={toRadix(value)} onValueChange={(v) => onValueChange(fromRadix(v))} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={`input select-trigger group flex cursor-pointer items-center justify-between gap-2 text-left active:scale-[0.98] data-[state=open]:border-ink disabled:cursor-default disabled:opacity-50 ${className}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            size={14}
            className="shrink-0 text-dim transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          style={{ transformOrigin: "var(--radix-select-content-transform-origin)" }}
          className="glass glass-pop z-[70] max-h-[min(340px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[min(320px,92vw)] overflow-hidden rounded-xl"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-dim">
            <ChevronUp size={13} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={toRadix(o.value)}
                disabled={o.disabled}
                className="relative flex h-8 cursor-pointer select-none items-center rounded-lg pl-3 pr-9 text-[13px] text-ink outline-none transition-colors duration-100 data-[highlighted]:bg-white/70 data-[highlighted]:shadow-[inset_2px_0_0_#0c0a09] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              >
                <SelectPrimitive.ItemText>
                  <span className="block truncate">{o.label}</span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 text-ink">
                  <Check size={13} strokeWidth={2.5} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-dim">
            <ChevronDown size={13} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
