"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, GripVertical, MoreHorizontal, Plus } from "lucide-react";

// One tree component, reused by My Prompts / Projects / Teams.
// Row anatomy (default):  [chevron 12] [icon 14] [label] [spacer] [badge]
// Row anatomy (hover):    [⠿] [chevron] [icon] [label] [spacer] [+] [⋯]

export interface TreeNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string; // Enter / click navigates
  badge?: React.ReactNode; // count / status — rendered only if present
  children?: TreeNode[];
  fixed?: boolean; // pinned pseudo-folder: no drag, no rename, no delete
  canRename?: boolean;
  canDelete?: boolean;
  canDrag?: boolean; // top-level reorder
  acceptsDrop?: boolean; // leaf rows can be dropped INTO this node
  childCount?: number; // for the inline delete confirm copy
  onAdd?: () => void; // immediate "+" (e.g. new prompt in folder)
  onAddChild?: (name: string) => void | Promise<void>; // inline-named "+"
}

export interface TreeSectionProps {
  id: string; // persistence key
  title: string;
  titleHref: string;
  nodes: TreeNode[];
  activeId?: string | null;
  isTitleActive?: boolean;
  onNavigate: (href: string) => void;
  onRename?: (node: TreeNode, name: string) => void | Promise<void>;
  onDelete?: (node: TreeNode) => void | Promise<void>;
  onReorder?: (ids: string[]) => void; // new top-level order
  onDropInto?: (dragId: string, targetId: string) => void; // nest / move
  onCreate?: (name: string) => void | Promise<void>; // section-header "+"
  emptyLabel?: string;
}

type DropZone = { id: string; zone: "before" | "after" | "into" } | null;

const openKey = (id: string) => `pd-tree-${id}`;

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

// inline borderless input used by rename + create — Enter commits, Esc reverts
function InlineInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      className="w-full min-w-0 bg-transparent text-sm text-ink outline-none"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          const v = e.currentTarget.value.trim();
          if (v) onCommit(v);
          else onCancel();
        }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={onCancel}
    />
  );
}

// everything a row needs from its section — passed down so TreeRow can stay a
// stable top-level component (defining it inside TreeSection would remount
// every row on any state change: hover flicker, focus loss)
interface RowCtx {
  expanded: Set<string>;
  activeId?: string | null;
  renamingId: string | null;
  confirmingId: string | null;
  menuId: string | null;
  drop: DropZone;
  toggleNode: (id: string) => void;
  setRenamingId: (id: string | null) => void;
  setConfirmingId: (id: string | null) => void;
  setMenuId: (fn: (m: string | null) => string | null) => void;
  onNavigate: (href: string) => void;
  onRename?: TreeSectionProps["onRename"];
  onDelete?: TreeSectionProps["onDelete"];
  onRowKeyDown: (e: React.KeyboardEvent, node: TreeNode) => void;
  rowDragOver: (e: React.DragEvent, node: TreeNode, isLeaf: boolean) => void;
  rowDrop: (node: TreeNode) => void;
  clearDropFor: (id: string) => void;
  startDrag: (node: TreeNode, isLeaf: boolean) => void;
  endDrag: () => void;
}

function TreeRow({
  node,
  depth,
  isLeaf,
  ctx,
}: {
  node: TreeNode;
  depth: number;
  isLeaf: boolean;
  ctx: RowCtx;
}) {
  const isOpen = ctx.expanded.has(node.id);
  const isActive = ctx.activeId === node.id;
  const hasChildren = !!node.children?.length;
  const drop = ctx.drop;

  if (ctx.confirmingId === node.id) {
    // lightweight inline confirm replaces the row — no modal
    return (
      <div className="flex h-8 items-center gap-2 rounded-md bg-danger/5 px-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-danger">
          Delete{node.childCount ? ` and its ${node.childCount} items?` : ` “${node.label}”?`}
        </span>
        <button
          className="shrink-0 font-medium text-danger hover:underline"
          onClick={() => {
            ctx.setConfirmingId(null);
            void ctx.onDelete?.(node);
          }}
        >
          Delete
        </button>
        <button className="shrink-0 text-dim hover:text-ink" onClick={() => ctx.setConfirmingId(null)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onDragOver={(e) => ctx.rowDragOver(e, node, isLeaf)}
      onDragLeave={() => ctx.clearDropFor(node.id)}
      onDrop={() => ctx.rowDrop(node)}
    >
      {/* reorder indicator lines */}
      {drop?.id === node.id && drop.zone === "before" && (
        <div className="absolute -top-px left-1 right-1 h-0.5 rounded bg-brass" />
      )}
      {drop?.id === node.id && drop.zone === "after" && (
        <div className="absolute -bottom-px left-1 right-1 h-0.5 rounded bg-brass" />
      )}
      <div
        data-tree-row
        tabIndex={-1}
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        className={`group/row relative flex h-8 cursor-pointer items-center gap-1 rounded-md pr-1.5 text-sm outline-none transition-colors duration-[120ms] ease-out focus-visible:bg-hover ${
          isActive ? "bg-ink/[0.06] font-medium text-ink" : "text-dim hover:bg-ink/[0.04] hover:text-ink"
        } ${drop?.id === node.id && drop.zone === "into" ? "ring-2 ring-inset ring-brass" : ""}`}
        style={{ paddingLeft: 4 }}
        onClick={() => {
          if (ctx.renamingId === node.id) return;
          if (node.href) ctx.onNavigate(node.href);
          else if (hasChildren) ctx.toggleNode(node.id);
        }}
        onKeyDown={(e) => ctx.onRowKeyDown(e, node)}
      >
        {/* active indicator — the only saturated accent on this surface */}
        {isActive && <span className="absolute -left-1 top-1.5 h-5 w-[3px] rounded-full bg-brass" />}

        {/* drag handle fades in on hover, far left */}
        {node.canDrag && !node.fixed && (
          <span
            draggable
            className="w-0 shrink-0 cursor-grab overflow-hidden text-dim/60 opacity-0 transition-all duration-[120ms] group-hover/row:w-3 group-hover/row:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              ctx.startDrag(node, isLeaf);
            }}
            onDragEnd={ctx.endDrag}
          >
            <GripVertical size={12} />
          </span>
        )}

        {/* chevron: only when the node has children */}
        {hasChildren ? (
          <button
            aria-label={isOpen ? "Collapse" : "Expand"}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-dim hover:bg-ink/[0.06]"
            onClick={(e) => {
              e.stopPropagation();
              ctx.toggleNode(node.id);
            }}
          >
            <ChevronRight
              size={12}
              className={`transition-transform duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="flex w-4 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
          {node.icon}
        </span>

        {ctx.renamingId === node.id ? (
          <InlineInput
            initial={node.label}
            onCommit={(v) => {
              ctx.setRenamingId(null);
              if (v !== node.label) void ctx.onRename?.(node, v);
            }}
            onCancel={() => ctx.setRenamingId(null)}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={(e) => {
              if (!node.canRename) return;
              e.preventDefault();
              e.stopPropagation();
              ctx.setRenamingId(node.id);
            }}
          >
            {node.label}
          </span>
        )}

        {/* right side: badge by default, actions on hover */}
        {node.badge && (
          <span className="shrink-0 text-xs tabular-nums text-dim group-hover/row:hidden">
            {node.badge}
          </span>
        )}
        <span className="hidden shrink-0 items-center gap-0.5 group-hover/row:flex">
          {(node.onAdd || node.onAddChild) && (
            <button
              aria-label="New inside"
              className="rounded p-0.5 text-dim hover:bg-ink/[0.06] hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                node.onAdd?.();
                if (node.onAddChild && !ctx.expanded.has(node.id)) ctx.toggleNode(node.id);
              }}
            >
              <Plus size={13} />
            </button>
          )}
          {(node.canRename || node.canDelete) && (
            <span className="relative">
              <button
                aria-label="More actions"
                className={`rounded p-0.5 text-dim hover:bg-ink/[0.06] hover:text-ink ${ctx.menuId === node.id ? "bg-ink/[0.06]" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.setMenuId((m) => (m === node.id ? null : node.id));
                }}
              >
                <MoreHorizontal size={13} />
              </button>
              {ctx.menuId === node.id && (
                <>
                  <span
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx.setMenuId(() => null);
                    }}
                  />
                  <span className="absolute right-0 top-6 z-50 flex w-32 flex-col overflow-hidden rounded-lg border border-line bg-raised py-1 shadow-soft">
                    {node.canRename && (
                      <button
                        className="px-3 py-1.5 text-left text-sm text-ink hover:bg-hover"
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx.setMenuId(() => null);
                          ctx.setRenamingId(node.id);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    {node.canDelete && (
                      <button
                        className="px-3 py-1.5 text-left text-sm text-danger hover:bg-hover"
                        onClick={(e) => {
                          e.stopPropagation();
                          ctx.setMenuId(() => null);
                          if (node.childCount) ctx.setConfirmingId(node.id);
                          else void ctx.onDelete?.(node);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </>
              )}
            </span>
          )}
        </span>
      </div>

      {/* children: 16px indent per level + 1px nesting guide at 8% ink */}
      {hasChildren && isOpen && (
        <div className="relative border-l border-ink/[0.08] pl-0.5" style={{ marginLeft: 16 + depth * 16 }}>
          {node.children!.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} isLeaf ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeSection({
  id,
  title,
  titleHref,
  nodes,
  activeId,
  isTitleActive,
  onNavigate,
  onRename,
  onDelete,
  onReorder,
  onDropInto,
  onCreate,
  emptyLabel,
}: TreeSectionProps) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const dragRef = useRef<{ id: string; isLeaf: boolean } | null>(null);
  const [drop, setDrop] = useState<DropZone>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // expanded state persists per user — never reset on reload
  useEffect(() => {
    setExpanded(loadSet(openKey(id)));
    setSectionOpen(localStorage.getItem(`${openKey(id)}-section`) !== "0");
  }, [id]);

  const toggleSection = () => {
    setSectionOpen((o) => {
      localStorage.setItem(`${openKey(id)}-section`, o ? "0" : "1");
      return !o;
    });
  };

  const toggleNode = useCallback(
    (nodeId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        localStorage.setItem(openKey(id), JSON.stringify([...next]));
        return next;
      });
    },
    [id],
  );

  // ---------- keyboard: ↑↓ move, → expand, ← collapse, Enter open, F2 rename ----------

  const focusRow = (delta: number) => {
    const rows = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-tree-row]") ?? [])];
    const idx = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[Math.min(rows.length - 1, Math.max(0, idx + delta))];
    next?.focus();
  };

  const onRowKeyDown = (e: React.KeyboardEvent, node: TreeNode) => {
    if (renamingId) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusRow(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusRow(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (node.children?.length && !expanded.has(node.id)) toggleNode(node.id);
        else focusRow(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (expanded.has(node.id)) toggleNode(node.id);
        else focusRow(-1);
        break;
      case "Enter":
        e.preventDefault();
        if (node.href) onNavigate(node.href);
        break;
      case "F2":
        e.preventDefault();
        if (node.canRename) setRenamingId(node.id);
        break;
    }
  };

  // ---------- drag & drop (HTML5, handle-initiated) ----------

  const topIds = nodes.filter((n) => !n.fixed).map((n) => n.id);

  const rowDragOver = (e: React.DragEvent, node: TreeNode, isLeaf: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.id === node.id) return;
    // leaves move INTO droppable parents; top-level rows reorder around each other
    if (drag.isLeaf) {
      if (!node.acceptsDrop || !onDropInto) return;
      e.preventDefault();
      setDrop({ id: node.id, zone: "into" });
      return;
    }
    if (isLeaf || node.fixed || !onReorder) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDrop({ id: node.id, zone: y < rect.height / 2 ? "before" : "after" });
  };

  const rowDrop = (node: TreeNode) => {
    const drag = dragRef.current;
    if (!drag || !drop || drop.id !== node.id) return;
    if (drop.zone === "into") {
      onDropInto?.(drag.id, node.id);
    } else if (onReorder) {
      const without = topIds.filter((x) => x !== drag.id);
      const at = without.indexOf(node.id);
      if (at !== -1) {
        without.splice(drop.zone === "before" ? at : at + 1, 0, drag.id);
        onReorder(without);
      }
    }
    setDrop(null);
    dragRef.current = null;
  };

  const ctx: RowCtx = {
    expanded,
    activeId,
    renamingId,
    confirmingId,
    menuId,
    drop,
    toggleNode,
    setRenamingId,
    setConfirmingId,
    setMenuId,
    onNavigate,
    onRename,
    onDelete,
    onRowKeyDown,
    rowDragOver,
    rowDrop,
    clearDropFor: (nodeId) => setDrop((d) => (d?.id === nodeId ? null : d)),
    startDrag: (node, isLeaf) => {
      dragRef.current = { id: node.id, isLeaf };
    },
    endDrag: () => {
      dragRef.current = null;
      setDrop(null);
    },
  };

  return (
    <div ref={rootRef} role="tree" aria-label={title}>
      {/* section header */}
      <div className="group/head flex h-8 items-center gap-1 rounded-md pr-1.5 transition-colors duration-[120ms] hover:bg-ink/[0.04]">
        <button
          aria-label={`Toggle ${title}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-dim hover:bg-ink/[0.06]"
          onClick={toggleSection}
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${sectionOpen ? "rotate-90" : ""}`}
          />
        </button>
        <button
          className={`relative min-w-0 flex-1 truncate text-left text-sm font-medium ${isTitleActive ? "text-ink" : "text-ink/80 hover:text-ink"}`}
          onClick={() => onNavigate(titleHref)}
        >
          {isTitleActive && <span className="absolute -left-6 top-0.5 h-4 w-[3px] rounded-full bg-brass" />}
          {title}
        </button>
        {onCreate && (
          <button
            aria-label={`New in ${title}`}
            className="rounded p-0.5 text-dim opacity-0 transition-opacity duration-[120ms] hover:bg-ink/[0.06] hover:text-ink group-hover/head:opacity-100"
            onClick={() => {
              setCreating(true);
              if (!sectionOpen) toggleSection();
            }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {sectionOpen && (
        <div className="mb-1 mt-0.5">
          {nodes.map((node) => (
            <TreeRow key={node.id} node={node} depth={0} isLeaf={false} ctx={ctx} />
          ))}
          {creating && (
            // new child is named inline BEFORE it exists — commit creates it
            <div className="flex h-8 items-center gap-1 rounded-md bg-ink/[0.04] pl-9 pr-2">
              <InlineInput
                initial=""
                onCommit={(v) => {
                  setCreating(false);
                  void onCreate?.(v);
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}
          {nodes.length === 0 && !creating && (
            <button
              className="flex h-8 w-full items-center gap-1.5 rounded-md pl-9 text-sm text-dim hover:bg-ink/[0.04] hover:text-ink"
              onClick={() => (onCreate ? setCreating(true) : undefined)}
            >
              {emptyLabel ?? "Nothing here yet"}
              {onCreate && <Plus size={12} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
