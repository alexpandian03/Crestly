import React, { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon, AlertCircle } from "lucide-react";
import api from "../services/api";

const MAX_URL_LENGTH = 500;

function isValidHttpsUrl(url) {
  if (!url) return true; // empty is fine
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * <PosterImageInput />
 *
 * Shared component for picking a poster image either by URL or file upload.
 * Calls onChange(url) with the resolved https URL (or '' to clear).
 */
export default function PosterImageInput({ value = "", onChange }) {
  const fileInputRef = useRef(null);
  const [urlInput, setUrlInput] = useState(value);
  const [urlError, setUrlError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Keep local input in sync when parent clears the value
  React.useEffect(() => {
    setUrlInput(value);
  }, [value]);

  const validateAndCommit = (url) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("");
      onChange("");
      return;
    }
    if (trimmed.length > MAX_URL_LENGTH) {
      setUrlError(`Link must be under ${MAX_URL_LENGTH} characters.`);
      return;
    }
    if (!isValidHttpsUrl(trimmed)) {
      setUrlError(
        "Please enter a valid https:// link (http: and data: links are not allowed).",
      );
      return;
    }
    setUrlError("");
    onChange(trimmed);
  };

  const handleBlur = () => validateAndCommit(urlInput);
  const handleUrlChange = (e) => {
    setUrlInput(e.target.value);
    if (urlError) setUrlError(""); // clear error while typing
  };
  const handleClear = () => {
    setUrlInput("");
    setUrlError("");
    setUploadError("");
    onChange("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be under 2 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("Only JPG, PNG or WebP images are allowed.");
      return;
    }

    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await api.post("/uploads/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.data?.url || "";
      if (!url) throw new Error("No URL returned");
      setUrlInput(url);
      setUrlError("");
      onChange(url);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        "Upload failed. Please try again.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const showThumb = value && !urlError;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-heading">
        Poster photo{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </label>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="url"
            value={urlInput}
            onChange={handleUrlChange}
            onBlur={handleBlur}
            placeholder="https://example.com/image.jpg"
            className={`input-field pr-9 ${urlError ? "border-danger" : ""}`}
          />
          {urlInput && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-heading"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-ghost border border-line shrink-0 text-xs"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{uploading ? "Uploading…" : "Upload"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Paste an https link or upload a JPG, PNG or WebP (max 2 MB).
      </p>

      {urlError && (
        <div className="flex items-start gap-2 text-danger text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{urlError}</span>
        </div>
      )}

      {uploadError && (
        <div className="flex items-start gap-2 text-danger text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {showThumb && (
        <div className="relative w-full h-28 rounded-card overflow-hidden border border-line bg-preview">
          <img
            src={value}
            alt="Poster photo preview"
            crossOrigin="anonymous"
            className="w-full h-full object-cover"
            onError={() => {
              setUrlError(
                "This link can't be used. Try uploading the image instead.",
              );
              onChange("");
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-6 h-6 rounded-chip bg-canvas border border-line flex items-center justify-center text-body"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
