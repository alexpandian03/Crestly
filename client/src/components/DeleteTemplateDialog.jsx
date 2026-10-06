import React, { useEffect } from "react";
import { AlertTriangle, Power, Trash2 } from "lucide-react";

/**
 * The confirm step for deleting a template. An active template cannot be deleted,
 * so this also offers the one step that fixes it.
 */
export default function DeleteTemplateDialog({
  template,
  error = "",
  busy = false,
  onCancel,
  onConfirm,
  onDeactivate,
}) {
  const active = template?.isActive !== false;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const cancelClass = "btn-ghost border border-line px-4 py-2 text-sm";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-heading/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-template-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="card-surface w-full max-w-md space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-chip bg-danger/10 p-2 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="delete-template-title"
              className="text-base font-semibold text-heading"
            >
              {active
                ? "Turn this template off first"
                : "Delete this template?"}
            </h2>
            <p
              className="mt-1 text-xs text-muted-foreground truncate"
              title={template?.name}
            >
              {template?.name}
            </p>
            <p className="mt-2 text-sm text-body leading-snug">
              {active
                ? "Your team can still choose this template on the Create page. Turn it off and you can delete it."
                : "Posters already created from it will not be affected. This cannot be undone."}
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className={cancelClass}>
            Cancel
          </button>
          {active ? (
            <button
              type="button"
              onClick={onDeactivate}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              <Power className="h-4 w-4" /> Turn it off
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-btn bg-danger px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-danger/90 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> {busy ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
