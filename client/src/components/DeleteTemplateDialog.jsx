import React, { useEffect } from "react";
import { AlertTriangle, Power, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-template-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[#DC2626] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2
              id="delete-template-title"
              className="text-base font-semibold text-[#111827]"
            >
              {active
                ? "Turn this template off first"
                : "Delete this template?"}
            </h2>
            <p
              className="mt-1 text-xs text-[#6B7280] truncate"
              title={template?.name}
            >
              {template?.name}
            </p>
            <p className="mt-2 text-sm text-[#4B5563] leading-snug">
              {active
                ? "Your team can still choose this template on the Create page. Turn it off and you can delete it."
                : "Posters already created from it will not be affected. This cannot be undone."}
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-9 px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            Cancel
          </Button>
          {active ? (
            <Button
              type="button"
              onClick={onDeactivate}
              disabled={busy}
              className="h-9 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium gap-1.5 shadow-none disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              <span>Turn it off</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="h-9 px-3 rounded-[6px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium gap-1.5 shadow-none disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{busy ? "Deleting…" : "Delete"}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
