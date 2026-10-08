import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  formatBytes,
  friendlyError,
  uploadBrandImage,
} from "../../utils/brandImage";

/**
 * Pick an image, shrink and re-encode it in the browser, then send it straight
 * to the tenant's own image library. Value is the https URL (or '' when empty).
 *
 * With `insert` the field keeps no value of its own: every upload is a new
 * picture to hand over (onChange), so nothing offers to remove it again.
 */
export default function BrandImageField({
  label,
  kind = "default",
  value = "",
  onChange,
  hint,
  boxClass = "h-28",
  insert = false,
}) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [added, setAdded] = useState("");

  const busy = progress !== null;
  const shown = value || (insert ? added : "");

  const pick = () => inputRef.current?.click();

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setProgress(0);
    try {
      const result = await uploadBrandImage({
        file,
        kind,
        onProgress: (percent) => setProgress(percent),
      });
      setMeta({
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        resized: result.resized,
      });
      if (insert) setAdded(result.url);
      onChange(result.url);
      setProgress(null);
    } catch (err) {
      setProgress(null);
      setError(friendlyError(err, "The upload failed. Please try again."));
    }
  };

  const remove = () => {
    setError("");
    setMeta(null);
    setAdded("");
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#111827]">{label}</p>
        {busy && (
          <span className="text-[11px] text-primary tabular-nums">
            {progress}%
          </span>
        )}
      </div>

      {shown ? (
        <div
          className={`relative rounded-[6px] border border-dashed border-[#D1D5DB] bg-[#FAFAFA] overflow-hidden p-2 flex items-center justify-center ${boxClass}`}
        >
          <img
            src={shown}
            alt={`${label} preview`}
            crossOrigin="anonymous"
            className="max-h-full max-w-full object-contain"
            onError={() =>
              setError("This image could not be displayed. Upload it again.")
            }
          />
          <div className="absolute top-2 right-2 flex gap-1">
            {!insert && (
              <button
                type="button"
                onClick={remove}
                aria-label="Remove image"
                title="Remove image"
                className="w-6 h-6 rounded-[4px] bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#DC2626] transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`rounded-[6px] border border-dashed border-[#D1D5DB] bg-[#FAFAFA] flex items-center justify-center text-[#9CA3AF] ${boxClass}`}
        >
          <ImageIcon size={20} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] shrink-0 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Upload size={13} className="text-[#6B7280]" />
          )}
          <span>
            {busy
              ? "Uploading…"
              : insert
                ? added
                  ? "Upload another photo"
                  : label
                : value
                  ? "Replace image"
                  : label}
          </span>
        </button>
        {value && !busy && !insert && (
          <button
            type="button"
            onClick={remove}
            className="h-8 px-2.5 rounded-[6px] text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Remove</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={chooseFile}
      />

      {busy && (
        <div className="h-1.5 rounded-chip bg-section overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.max(4, progress)}%` }}
            aria-label="Upload progress"
          />
        </div>
      )}

      {meta && !busy && (
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(meta.bytes)} · {meta.width}×{meta.height} px
          {meta.resized ? " · shrunk to fit" : ""}
        </p>
      )}

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] text-danger leading-snug">
          <AlertTriangle size={13} className="shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      ) : (
        hint || (
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG or WebP up to 5 MB. Large photos are resized to 2000 px.
          </p>
        )
      )}
    </div>
  );
}
