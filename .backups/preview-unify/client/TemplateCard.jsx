import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Copy,
  MoreVertical,
  PencilLine,
  Power,
  Trash2,
} from "lucide-react";
import TemplateThumb from "./TemplateThumb";
import { TEMPLATE_SAMPLE_CONTENT } from "../data/demoPosters";
import { timeAgo } from "../utils/timeAgo";

const GAP = 6;
const EDGE = 8;

/**
 * The card menu is painted outside the card because the card clips its own content,
 * so it lives in a portal and follows the button while the page scrolls. It opens
 * upwards when the bottom of the screen is too close.
 */
function ActionMenu({ triggerRef, onClose, children }) {
  const menuRef = useRef(null);
  const [point, setPoint] = useState(null);

  useEffect(() => {
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      /* clientWidth/clientHeight, not innerWidth/innerHeight: a classic scrollbar is
         part of innerWidth but not the box a fixed element is placed in. */
      const view = document.documentElement;
      setPoint({
        left: rect.right,
        top: rect.bottom + GAP,
        flipTo: rect.top - GAP,
        width: view.clientWidth,
        height: view.clientHeight,
        roomAbove: rect.top - GAP - EDGE,
        roomBelow: view.clientHeight - rect.bottom - GAP - EDGE,
      });
    };
    place();
    const closeOnPointer = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      onClose();
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", closeOnPointer);
    /* Key activation fires click without mousedown, so listen to both: this is what
     * closes this menu when another card's button is opened. */
    document.addEventListener("click", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", closeOnPointer);
      document.removeEventListener("click", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [onClose, triggerRef]);

  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !point) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.max(
      EDGE,
      Math.min(point.left - width, point.width - width - EDGE),
    );
    let top;
    if (height <= point.roomBelow)
      top = Math.min(point.top, point.height - height - EDGE);
    else if (height <= point.roomAbove) top = point.flipTo - height;
    else top = EDGE;
    setStyle({ top, left });
  }, [point]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      style={style || { top: -9999, left: 0, visibility: "hidden" }}
      className="fixed z-[60] w-56 rounded-card border border-line bg-canvas py-1 shadow-soft"
    >
      {children}
    </div>,
    document.body,
  );
}

/** One template: a live miniature of the layout plus the management actions. */
export default function TemplateCard({
  template,
  brandKit,
  busy = false,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const active = template.isActive !== false;

  const run = (action) => {
    setMenuOpen(false);
    action();
  };

  const itemClass =
    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-body hover:bg-section hover:text-heading disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <article className="card-surface flex flex-col overflow-hidden">
      <div className="bg-preview p-3 flex justify-center pointer-events-none select-none">
        <TemplateThumb
          brandKit={brandKit}
          template={template}
          content={TEMPLATE_SAMPLE_CONTENT}
          width={132}
        />
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-heading truncate"
              title={template.name}
            >
              {template.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {template.size?.width || 1080} × {template.size?.height || 1350}
              {template.updatedAt
                ? ` · updated ${timeAgo(template.updatedAt)}`
                : ""}
            </p>
          </div>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Actions for ${template.name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="rounded-btn border border-line p-1.5 text-heading transition-colors hover:border-primary"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span className="rounded-chip bg-section border border-line px-2 py-0.5 text-[11px] font-medium text-body">
            {template.category || "Event"}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[11px] font-semibold ${
              active
                ? "bg-success/10 text-success"
                : "bg-section text-muted-foreground border border-line"
            }`}
          >
            {active && <CheckCircle2 className="h-3 w-3" />}
            {active ? "Active" : "Inactive"}
          </span>
          {template.isDefault && (
            <span className="rounded-chip bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Default
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Version {template.version || 1}
          </span>
        </div>

        {busy && <p className="text-[11px] text-muted-foreground">Working…</p>}
      </div>

      {menuOpen && (
        <ActionMenu triggerRef={triggerRef} onClose={() => setMenuOpen(false)}>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => run(onEdit)}
            disabled={busy}
          >
            <PencilLine className="h-4 w-4 shrink-0" /> Edit layout
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => run(onDuplicate)}
            disabled={busy}
          >
            <Copy className="h-4 w-4 shrink-0" /> Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => run(onToggleActive)}
            disabled={busy}
          >
            <Power className="h-4 w-4 shrink-0" />{" "}
            {active ? "Deactivate" : "Activate"}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-danger hover:bg-danger/5 hover:text-danger`}
            onClick={() => run(onDelete)}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4 shrink-0" /> Delete
          </button>
        </ActionMenu>
      )}
    </article>
  );
}
