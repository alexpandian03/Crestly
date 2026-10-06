import React, { useEffect, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import TemplatePreview from "../TemplatePreview";
import { fullDateTime, timeAgo } from "../../utils/timeAgo";

/**
 * Saved versions of one template: what changed, who saved it, a look at it, and a
 * restore that puts it back into the editor as a new version.
 */
export default function VersionDrawer({
  versions,
  currentVersion,
  brandKit,
  namesById,
  currentUserId,
  restoring,
  onClose,
  onRestore,
}) {
  const [previewOf, setPreviewOf] = useState(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = [...(versions || [])].sort(
    (a, b) => (b.version || 0) - (a.version || 0),
  );
  const ordered = [
    { version: currentVersion, note: "What you see now", current: true },
    ...list,
  ];

  const whoOf = (id) => {
    const key = String(id?._id || id || "");
    if (!key) return "";
    if (currentUserId && key === String(currentUserId)) return "You";
    return namesById[key] || "";
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close the list of saved versions"
        onClick={onClose}
        className="absolute inset-0 bg-heading/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saved versions"
        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-line bg-canvas shadow-soft overflow-y-auto"
      >
        <div className="sticky top-0 bg-canvas border-b border-line px-4 py-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-heading">
              Saved versions
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The last {Math.max(list.length, 1)} saved states of this layout.
              Restoring one keeps what you have now as its own version.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-btn border border-line p-1.5 text-heading hover:border-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing saved yet. The first version appears here after your first
            save.
          </p>
        ) : null}

        <ul className="p-4 space-y-3">
          {ordered.map((item) => {
            const previewing = previewOf === item.version;
            const who = whoOf(item.createdBy);
            return (
              <li
                key={item.version}
                className={`rounded-card border px-3 py-3 ${
                  item.current
                    ? "border-primary/50 bg-primary/5"
                    : "border-line bg-canvas"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading">
                      Version {item.version}
                      {item.current ? (
                        <span className="ml-2 text-xs font-medium text-primary">
                          Now in the editor
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-body mt-0.5 break-words">
                      {item.note || "Edited"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[who, item.createdAt ? timeAgo(item.createdAt) : ""]
                        .filter(Boolean)
                        .join(" · ")}
                      {item.createdAt
                        ? ` (${fullDateTime(item.createdAt)})`
                        : ""}
                    </p>
                  </div>
                </div>

                {!item.current ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewOf(previewing ? null : item.version)
                      }
                      aria-expanded={previewing}
                      className="btn-ghost border border-line text-xs px-3 py-1.5"
                    >
                      {previewing ? "Hide look" : "Preview"}
                    </button>
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={() => onRestore(item.version)}
                      className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {restoring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restore this
                    </button>
                  </div>
                ) : null}

                {previewing && !item.current ? (
                  <div className="mt-3 rounded-card border border-line bg-preview p-2">
                    <TemplatePreview
                      eager
                      brandKit={brandKit}
                      template={{
                        name: item.name || "",
                        size: item.size,
                        zones: item.zones,
                        layout: item.layout,
                        page: item.page,
                        elements: item.elements,
                        editorVersion: item.editorVersion,
                        version: item.version,
                        createdAt: item.createdAt,
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
