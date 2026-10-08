import React, { useEffect, useRef, useState } from "react";
import { Copy, ImageIcon, MoreVertical, PenLine, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";

const STATUS_DOT_COLORS = {
  draft: "bg-[#9CA3AF]",
  pending: "bg-[#D97706]",
  approved: "bg-[#16A34A]",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending: "Waiting for review",
  approved: "Approved",
};

function formatPosterDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return "";
  const diff = Math.max(0, Date.now() - timestamp);
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h}h ago`;
  }
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

export default function PosterCard({
  poster,
  category = "",
  createdByName = "",
  aspectRatio = 0.8,
  busy = false,
  onOpenDetail,
  onOpenInEditor,
  onDuplicate,
  onDelete,
}) {
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const imageRef = useRef(null);

  useEffect(() => {
    setImageReady(false);
    setImageFailed(false);
    const node = imageRef.current;
    if (node?.complete && node.naturalWidth > 0) setImageReady(true);
  }, [poster.thumbnailUrl]);

  const status = poster.status || "draft";
  const showImage = poster.thumbnailUrl && !imageFailed;

  return (
    <article
      className="group relative rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden flex flex-col cursor-pointer transition-colors hover:border-[#9CA3AF]"
      onClick={() => onOpenDetail(poster)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(poster);
        }
      }}
      aria-label={`Open details for ${poster.title || "poster"}`}
    >
      <div className="relative w-full aspect-[4/5] bg-[#FAFAFA] overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
        {showImage ? (
          <img
            ref={imageRef}
            src={poster.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
            className={`w-full h-full object-contain p-2 transition-opacity duration-200 ${
              imageReady ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#FAFAFA]">
            <ImageIcon className="w-6 h-6 text-[#9CA3AF]" aria-hidden="true" />
          </div>
        )}

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
                title="Poster actions"
                aria-label="Poster actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36 rounded-[6px] border border-[#E5E7EB] bg-white p-1 shadow-md z-30"
            >
              <DropdownMenuItem
                onClick={() => onOpenInEditor(poster)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#111827] hover:bg-[#F9FAFB]"
              >
                <PenLine className="w-3.5 h-3.5 mr-2 text-[#6B7280]" />
                <span>Open</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onDuplicate(poster)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5 mr-2 text-[#6B7280]" />
                <span>Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                onClick={() => onDelete(poster)}
                className="cursor-pointer text-xs rounded-[4px] px-2.5 py-1.5 text-[#DC2626] hover:bg-[#FEF2F2] focus:bg-[#FEF2F2] focus:text-[#DC2626] disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2 text-[#DC2626]" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col min-w-0">
        {/* Status as small gray text with a dot */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.draft
            }`}
          />
          <span>{STATUS_LABELS[status] || STATUS_LABELS.draft}</span>
        </div>

        {/* Title: 14px/500, one line, truncated */}
        <h2
          className="text-sm font-medium text-[#111827] truncate mt-1 leading-snug"
          title={poster.title || "Untitled poster"}
        >
          {poster.title || "Untitled poster"}
        </h2>

        {/* Poster type and short date */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280] truncate">
          <span className="truncate">{category || "Poster"}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">
            {formatPosterDate(poster.updatedAt || poster.createdAt)}
          </span>
        </div>

        {createdByName && (
          <p
            className="mt-1 text-[11px] text-[#9CA3AF] truncate"
            title={createdByName}
          >
            By {createdByName}
          </p>
        )}
      </div>
    </article>
  );
}

export function PosterCardSkeleton() {
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
