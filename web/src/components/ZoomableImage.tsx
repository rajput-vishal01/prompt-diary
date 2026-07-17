"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, X } from "lucide-react";

/** Full-screen viewer: dark glass veil, image materializes center-stage.
 *  Esc / click anywhere / the X closes. Portaled to body so it escapes any
 *  overflow-hidden pane. */
export function Lightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-ink/80 p-4 backdrop-blur-md md:p-10"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[94vw] rounded-xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            initial={reduce ? false : { scale: 0.96, filter: "blur(6px)" }}
            animate={{ scale: 1, filter: "blur(0px)" }}
            exit={reduce ? undefined : { scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          />
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.97]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** An <img> with a hover-revealed expand chip and click-to-fullscreen.
 *  buttonPosition "tl" keeps clear of panes that already own the top-right
 *  corner (Remove buttons). */
export function ZoomableImage({
  src,
  alt,
  imgClassName,
  wrapClassName,
  buttonPosition = "tr",
}: {
  src: string;
  alt: string;
  imgClassName?: string;
  wrapClassName?: string;
  buttonPosition?: "tr" | "tl";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`group/zoom relative block ${wrapClassName ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`cursor-zoom-in ${imgClassName ?? ""}`}
        onClick={() => setOpen(true)}
      />
      <button
        type="button"
        aria-label="View full screen"
        className={`absolute top-2 flex h-7 w-7 items-center justify-center rounded-md bg-ink/60 text-white opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-150 focus-visible:opacity-100 active:scale-[0.97] group-hover/zoom:opacity-100 ${
          buttonPosition === "tl" ? "left-2" : "right-2"
        }`}
        onClick={() => setOpen(true)}
      >
        <Maximize2 size={13} />
      </button>
      <Lightbox src={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </span>
  );
}
