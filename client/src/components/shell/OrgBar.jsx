import React, { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, Search, X } from "lucide-react";

const idOf = (client) => client.id || client._id;

/** Slim context bar under the top bar for superadmin. */
export function OrgBar({ selected, onChange }) {
  return (
    <div className="h-10 border-b border-[#E5E7EB] bg-[#F9FAFB]">
      <div className="mx-auto flex h-full w-full max-w-page items-center gap-3 px-4 sm:px-6">
        {selected ? (
          <>
            <Building2 className="h-4 w-4 shrink-0 text-[#2563EB]" />
            <span className="hidden shrink-0 text-xs font-medium uppercase tracking-wider text-[#6B7280] sm:inline">
              Working on
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#111827]">
              {selected.name}
            </span>
            <button
              type="button"
              onClick={onChange}
              className="shrink-0 rounded-[6px] px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              Change
            </button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-xs text-[#6B7280]">
              Select an organization to open its brand kit, templates and posters
            </p>
            <button
              type="button"
              onClick={onChange}
              className="shrink-0 rounded-[6px] bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Select organization
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function OrgPicker({
  open,
  clients,
  currentId,
  loading,
  onClose,
  onPick,
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return undefined;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      String(client.name || "")
        .toLowerCase()
        .includes(needle),
    );
  }, [clients, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#111827]/40 p-4 backdrop-blur-xs sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an organization"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-[8px] border border-[#E5E7EB] bg-white shadow-md">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#6B7280]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organizations…"
            aria-label="Search organizations"
            className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[6px] p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-center text-xs text-[#6B7280]">
              Loading organizations…
            </p>
          ) : matches.length === 0 ? (
            <p className="p-4 text-center text-xs text-[#6B7280]">
              No organization found matching "{query}".
            </p>
          ) : (
            <ul className="space-y-0.5">
              {matches.map((client) => {
                const id = idOf(client);
                const isSelected = String(id) === String(currentId);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onPick(client)}
                      className={`flex w-full items-center justify-between gap-3 rounded-[6px] px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                          : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]"
                      }`}
                    >
                      <span className="truncate">{client.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-[#2563EB]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
