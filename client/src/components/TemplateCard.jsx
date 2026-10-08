import React from "react";
import {
  Copy,
  MoreVertical,
  PencilLine,
  Power,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import TemplatePreview from "./TemplatePreview";

function formatTemplateDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Math.max(0, Date.now() - timestamp);
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  if (diff < DAY) return "today";
  if (diff < 30 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** One template card styled to match Brandframe card aesthetic. */
export default function TemplateCard({
  template,
  brandKit,
  busy = false,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}) {
  const active = template.isActive !== false;
  const updatedDate = template.updatedAt || template.createdAt;
  const updatedText = formatTemplateDate(updatedDate);

  return (
    <article
      className="group relative rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden flex flex-col cursor-pointer transition-colors hover:border-[#9CA3AF]"
      onClick={() => onEdit(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(template);
        }
      }}
      aria-label={`Open template ${template.name}`}
    >
      {/* Thumbnail on top: 4:5 aspect ratio, light gray background */}
      <div className="relative w-full aspect-[4/5] bg-[#FAFAFA] overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
        <div className="w-full h-full p-2 flex items-center justify-center pointer-events-none select-none">
          <TemplatePreview
            brandKit={brandKit}
            template={template}
            size={160}
          />
        </div>

        {/* Three-dot menu on hover (top-right of the thumbnail) */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-[6px] bg-white/95 border border-[#E5E7EB] shadow-xs flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-white transition-colors"
                title="Template actions"
                aria-label="Template actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36 rounded-[6px] border border-[#E5E7EB] bg-white p-1 shadow-md z-30"
            >
              <DropdownMenuItem
                onClick={() => onEdit(template)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#111827] hover:bg-[#F9FAFB]"
              >
                <PencilLine className="w-3.5 h-3.5 mr-2 text-[#6B7280]" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onDuplicate(template)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5 mr-2 text-[#6B7280]" />
                <span>Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onToggleActive(template)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5 mr-2 text-[#6B7280]" />
                <span>{active ? "Deactivate" : "Activate"}</span>
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() => onDelete(template)}
                  className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#DC2626] hover:bg-[#FEF2F2] focus:bg-[#FEF2F2] focus:text-[#DC2626] disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2 text-[#DC2626]" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Details below thumbnail */}
      <div className="p-3 flex-1 flex flex-col min-w-0">
        {/* Status as small text with a dot: "Active" green, "Inactive" gray */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                active ? "bg-[#16A34A]" : "bg-[#9CA3AF]"
              }`}
            />
            <span className={active ? "text-[#16A34A]" : "text-[#6B7280]"}>
              {active ? "Active" : "Inactive"}
            </span>
            {template.isDefault && (
              <span className="text-[#6B7280] font-normal">· Default</span>
            )}
          </div>
          <span className="text-[#9CA3AF]">v{template.version || 1}</span>
        </div>

        {/* Title: 14px/500, one line, truncated */}
        <h2
          className="text-sm font-medium text-[#111827] truncate mt-1 leading-snug"
          title={template.name}
        >
          {template.name}
        </h2>

        {/* Category and small gray size text "1080 × 1350" */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280] truncate">
          <span className="truncate">{template.category || "Custom"}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">
            {template.size?.width || 1080} × {template.size?.height || 1350}
          </span>
        </div>

        {/* Updated date (never hours) */}
        {updatedText && (
          <p className="mt-1 text-[11px] text-[#9CA3AF] truncate">
            Updated {updatedText}
          </p>
        )}
      </div>
    </article>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden flex flex-col">
      <Skeleton className="w-full aspect-[4/5] bg-[#E5E7EB]/60 rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-16 rounded-[4px] bg-[#E5E7EB]/60" />
        <Skeleton className="h-4 w-3/4 rounded-[4px] bg-[#E5E7EB]/60" />
        <Skeleton className="h-3 w-1/2 rounded-[4px] bg-[#E5E7EB]/60" />
      </div>
    </div>
  );
}
