import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Images, Link2, Loader2, Upload } from "lucide-react";
import api from "../../services/api";
import PhotoBar from "./PhotoBar";
import { blankFitOf, withBlankFit } from "../../utils/posterContentFields.js";
import {
  BLANK_MESSAGES,
  BLANK_IMAGE_MAX_BYTES,
  blankImageProblem,
  blanksOfDesign,
  checkBlankImageFile,
  imageOfBlank,
  withBlankImage,
  withBlankWords,
  wordsOfBlank,
} from "../../utils/posterVariables.js";
import {
  ACCEPTED_TYPES,
  friendlyError,
  uploadBrandImage,
} from "../../utils/brandImage.js";
import { computeItemNumbers } from "../../utils/templateEditorItems.js";
import { elementsOfDesign } from "../../../../shared/templateElements.js";

/* ------------------------------------------------------------------ *
 * The spaces the layout left to be filled in.
 *
 * Every one of them is listed here in reading order, whether the writing arrived
 * or not, so a person can always finish the poster by hand. Hovering or focusing
 * a row highlights the matching area on the poster, and empty slots can be hidden.
 * ------------------------------------------------------------------ */

const PUSH_MS = 150;

function Counter({ current, max }) {
  return (
    <span
      className={`text-[11px] font-mono tabular-nums ${
        current >= max
          ? "text-danger font-semibold"
          : current >= max * 0.9
            ? "text-amber-600"
            : "text-muted-foreground"
      }`}
    >
      {current}/{max}
    </span>
  );
}

export default function VariableFields({
  design,
  content,
  view,
  alternatives = [],
  canUpload = false,
  onContentChange,
  onViewChange,
  onEdited = null,
  highlightSlotKey = null,
  onHighlightSlot = null,
  activeSlotKey = null,
  onSlotSelect = null,
}) {
  const slots = useMemo(() => blanksOfDesign(design), [design]);
  const [drafts, setDrafts] = useState({});
  const [upload, setUpload] = useState({
    key: "",
    busy: false,
    progress: null,
    error: "",
  });
  /* Each space keeps its own typed-in address, its own "just taken out" picture for Undo,
     and its own list of the organization's pictures open at one time. */
  const [links, setLinks] = useState({});
  const [undoSteps, setUndoSteps] = useState({});
  const [pickerFor, setPickerFor] = useState("");
  const [assets, setAssets] = useState(null);
  const [assetsBusy, setAssetsBusy] = useState(false);
  const [assetsError, setAssetsError] = useState("");

  const timersRef = useRef({});
  const sentRef = useRef({});
  const fileRefs = useRef({});
  const rowRefs = useRef({});
  const inputRefs = useRef({});
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  /* All design items to compute reading order and numbering */
  const allItems = useMemo(() => {
    const fromDesign = elementsOfDesign(design);
    if (fromDesign.length) return fromDesign;
    return Array.isArray(design?.elements) ? design.elements : [];
  }, [design]);

  const itemNumbers = useMemo(() => computeItemNumbers(allItems), [allItems]);

  const readingSort = (a, b) => {
    const ay = Number(a.y) || 0;
    const by = Number(b.y) || 0;
    if (Math.abs(ay - by) > 15) return ay - by;
    const ax = Number(a.x) || 0;
    const bx = Number(b.x) || 0;
    return ax - bx;
  };

  const combinedSlots = useMemo(() => {
    const itemMap = new Map(allItems.map((it) => [it.id, it]));
    const textEntries = slots.texts.map((s) => {
      const raw = itemMap.get(s.id) || {};
      return { ...s, kind: "text", x: raw.x ?? 0, y: raw.y ?? 0, hint: s.hint || raw.hint || "" };
    });
    const imageEntries = slots.images.map((s) => {
      const raw = itemMap.get(s.id) || {};
      return { ...s, kind: "image", x: raw.x ?? 0, y: raw.y ?? 0, hint: s.hint || raw.hint || "" };
    });
    return [...textEntries, ...imageEntries].sort(readingSort);
  }, [slots, allItems]);

  const hiddenSlots = useMemo(
    () => (Array.isArray(content?.hiddenSlots) ? content.hiddenSlots : []),
    [content?.hiddenSlots]
  );

  const visibleSlots = useMemo(
    () => combinedSlots.filter((slot) => !hiddenSlots.includes(slot.key)),
    [combinedSlots, hiddenSlots]
  );

  const hiddenSlotList = useMemo(
    () => combinedSlots.filter((slot) => hiddenSlots.includes(slot.key)),
    [combinedSlots, hiddenSlots]
  );

  /* Scroll and focus matching row when activeSlotKey changes */
  useEffect(() => {
    if (activeSlotKey && rowRefs.current[activeSlotKey]) {
      rowRefs.current[activeSlotKey].scrollIntoView({ behavior: "smooth", block: "center" });
      inputRefs.current[activeSlotKey]?.focus();
    }
  }, [activeSlotKey]);

  /* Words that came from somewhere else - the assistant, undo, opening the poster again -
   * move into the boxes. Anything this panel just sent stays exactly as it was typed. */
  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      slots.texts.forEach((slot) => {
        const incoming = wordsOfBlank(content, slot.key);
        if (incoming === sentRef.current[slot.key]) return;
        if ((prev[slot.key] || "") !== incoming) {
          next[slot.key] = incoming;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [content, slots]);

  const sendWords = (slot, words) => {
    const next = withBlankWords(
      contentRef.current,
      slot.key,
      words,
      slot.maxLength,
    );
    sentRef.current[slot.key] = next.extras?.[slot.key] ?? "";
    onContentChange?.(next);
  };

  const typeWords = (slot, words) => {
    const limited = String(words || "").slice(0, slot.maxLength);
    setDrafts((prev) => ({ ...prev, [slot.key]: limited }));
    onEdited?.(slot.key);
    clearTimeout(timersRef.current[slot.key]);
    timersRef.current[slot.key] = setTimeout(
      () => sendWords(slot, limited),
      PUSH_MS,
    );
  };

  const sendImage = (slot, url) => {
    const problem = blankImageProblem(url);
    if (problem) {
      setUpload({ key: slot.key, busy: false, progress: null, error: problem });
      return;
    }
    const before = imageOfBlank(contentRef.current, slot.key);
    const next = withBlankImage(contentRef.current, slot.key, url);
    sentRef.current[slot.key] = next.images?.[slot.key] ?? "";
    onContentChange?.(next);
    if (!url) {
      setUpload({ key: "", busy: false, progress: null, error: "" });
      setUndoSteps((prev) => ({ ...prev, [slot.key]: before }));
    } else {
      setUndoSteps((prev) => {
        if (!prev[slot.key]) return prev;
        const cleared = { ...prev };
        delete cleared[slot.key];
        return cleared;
      });
    }
    setLinks((prev) => {
      if (!prev[slot.key]) return prev;
      const cleared = { ...prev };
      delete cleared[slot.key];
      return cleared;
    });
    setPickerFor("");
  };

  const undoRemove = (slot) => {
    const back = undoSteps[slot.key];
    if (!back) return;
    sendImage(slot, back);
  };

  /* The organization's own pictures, fetched the first time a space asks for them. */
  const openPicker = (slot) => {
    if (pickerFor === slot.key) {
      setPickerFor("");
      return;
    }
    setPickerFor(slot.key);
    if (assets !== null || assetsBusy) return;
    setAssetsBusy(true);
    setAssetsError("");
    (async () => {
      try {
        const res = await api.get("/assets", { params: { page: 1, limit: 24 } });
        const items = res.data?.data?.items;
        setAssets(Array.isArray(items) ? items.filter((each) => each?.url) : []);
      } catch {
        setAssets([]);
        setAssetsError("We could not open your picture library just now.");
      } finally {
        setAssetsBusy(false);
      }
    })();
  };

  const uploadImage = async (slot, file) => {
    const problem = checkBlankImageFile(file);
    if (problem) {
      setUpload({ key: slot.key, busy: false, progress: null, error: problem });
      return;
    }
    setUpload({ key: slot.key, busy: true, progress: 4, error: "" });
    try {
      const result = await uploadBrandImage({
        file,
        kind: "content",
        onProgress: (value) =>
          setUpload({ key: slot.key, busy: true, progress: value, error: "" }),
      });
      sendImage(slot, result.url);
      setUpload({ key: slot.key, busy: false, progress: null, error: "" });
    } catch (err) {
      setUpload({
        key: slot.key,
        busy: false,
        progress: null,
        error: friendlyError(err, "We could not send your picture. Try again."),
      });
    }
  };

  const choicesFor = (slot) => {
    const now = imageOfBlank(content, slot.key) || "";
    const list = [];
    const add = (url, label) => {
      const value = String(url || "").trim();
      if (!value || value === now) return;
      if (list.some((option) => option.url === value)) return;
      list.push({ url: value, label });
    };
    alternatives.forEach((option) => add(option.url, option.label));
    Object.entries(content?.images || {}).forEach(([key, url]) => {
      if (key !== slot.key) add(url, "A picture already used on this poster");
    });
    return list;
  };

  /* Empty slots calculation */
  const emptySlots = useMemo(() => {
    return combinedSlots.filter((slot) => {
      if (slot.kind === "text") {
        const val = drafts[slot.key] !== undefined ? drafts[slot.key] : wordsOfBlank(content, slot.key);
        return !String(val || "").trim();
      }
      return !imageOfBlank(content, slot.key);
    });
  }, [combinedSlots, drafts, content]);

  const emptyPhotos = useMemo(() => emptySlots.filter((s) => s.kind === "image"), [emptySlots]);
  const emptyTexts = useMemo(() => emptySlots.filter((s) => s.kind === "text"), [emptySlots]);

  const emptySentence = useMemo(() => {
    const parts = [];
    if (emptyPhotos.length > 0) {
      parts.push(`${emptyPhotos.length} photo slot${emptyPhotos.length === 1 ? "" : "s"}`);
    }
    if (emptyTexts.length > 0) {
      parts.push(`${emptyTexts.length} text box${emptyTexts.length === 1 ? "" : "es"}`);
    }
    const countStr = parts.join(" and ");
    return `${countStr} ${parts.length === 1 && (emptyPhotos.length === 1 || emptyTexts.length === 1) ? "is" : "are"} empty`;
  }, [emptyPhotos.length, emptyTexts.length]);

  const handleHideEmptySlots = () => {
    const newHidden = Array.from(new Set([...hiddenSlots, ...emptySlots.map((s) => s.key)]));
    onContentChange?.({ ...content, hiddenSlots: newHidden });
  };

  const handleUnhideAll = () => {
    onContentChange?.({ ...content, hiddenSlots: [] });
  };

  const handleUnhideSlot = (key) => {
    onContentChange?.({ ...content, hiddenSlots: hiddenSlots.filter((k) => k !== key) });
  };

  if (!combinedSlots.length) return null;

  return (
    <div className="space-y-5 pt-4 border-t border-line">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-heading uppercase tracking-wider">
            Spaces to fill in
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {combinedSlots.length} slot{combinedSlots.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your layout left room for these. The poster changes as you write, and
          nothing is kept until you save.
        </p>
      </div>

      {/* Mini-map strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 bg-section/50 rounded-chip border border-line">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 shrink-0">
          Slots
        </span>
        {combinedSlots.map((slot) => {
          const isEmp = emptySlots.some((s) => s.key === slot.key);
          const isHid = hiddenSlots.includes(slot.key);
          const num = itemNumbers.get(slot.id);
          const badge = num ? (slot.kind === "image" ? `P${num.number}` : `T${num.number}`) : (slot.kind === "image" ? "P" : "T");
          const isHighlighted = highlightSlotKey === slot.key || activeSlotKey === slot.key;
          return (
            <button
              key={slot.key}
              type="button"
              title={`${num?.label || ""} · ${slot.label} (${isHid ? "Hidden" : isEmp ? "Empty" : "Filled"})`}
              onClick={() => {
                rowRefs.current[slot.key]?.scrollIntoView({ behavior: "smooth", block: "center" });
                inputRefs.current[slot.key]?.focus();
                onHighlightSlot?.(slot.key);
                onSlotSelect?.(slot.key);
              }}
              onMouseEnter={() => onHighlightSlot?.(slot.key)}
              onMouseLeave={() => onHighlightSlot?.(null)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                isHid
                  ? "bg-muted/40 text-muted-foreground line-through opacity-60"
                  : isHighlighted
                    ? "bg-primary text-white shadow-sm ring-1 ring-primary"
                    : isEmp
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span>{badge}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isHid ? "bg-muted-foreground" : isEmp ? "bg-amber-500" : "bg-emerald-500"}`} />
            </button>
          );
        })}
      </div>

      {/* Rows in reading order */}
      <div className="space-y-4">
        {visibleSlots.map((slot) => {
          const numInfo = itemNumbers.get(slot.id);
          const isRowHighlighted = highlightSlotKey === slot.key || activeSlotKey === slot.key;

          if (slot.kind === "text") {
            const value =
              drafts[slot.key] === undefined
                ? wordsOfBlank(content, slot.key)
                : drafts[slot.key];

            return (
              <div
                key={slot.key}
                ref={(node) => {
                  rowRefs.current[slot.key] = node;
                }}
                id={`form-slot-${slot.key}`}
                onMouseEnter={() => onHighlightSlot?.(slot.key)}
                onMouseLeave={() => onHighlightSlot?.(null)}
                className={`p-2.5 rounded-card border transition-all ${
                  isRowHighlighted
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-line bg-canvas"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={`blank-text-${slot.key}`}
                    className="text-xs font-semibold text-heading uppercase tracking-wider flex items-center gap-1.5"
                  >
                    {numInfo && (
                      <span className="text-primary font-mono text-[11px] font-bold">
                        {numInfo.label} ·
                      </span>
                    )}
                    <span>{slot.label}</span>
                  </label>
                  <Counter current={value.length} max={slot.maxLength} />
                </div>
                {slot.hint ? (
                  <p className="mb-1.5 text-[11px] text-muted-foreground">
                    {slot.hint}
                  </p>
                ) : null}
                <input
                  ref={(node) => {
                    inputRefs.current[slot.key] = node;
                  }}
                  id={`blank-text-${slot.key}`}
                  type="text"
                  value={value}
                  maxLength={slot.maxLength}
                  placeholder={slot.placeholder || "Write something here"}
                  onFocus={() => onHighlightSlot?.(slot.key)}
                  onBlur={() => onHighlightSlot?.(null)}
                  onChange={(event) => typeWords(slot, event.target.value)}
                  className="input-field"
                />
                {!value ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {BLANK_MESSAGES.emptyHint}
                  </p>
                ) : null}
              </div>
            );
          }

          /* Image slot */
          const answer = imageOfBlank(content, slot.key);
          const busy = upload.busy && upload.key === slot.key;
          const takenOut = answer ? "" : undoSteps[slot.key] || "";
          const picking = pickerFor === slot.key;
          const fit = blankFitOf(view, slot.id) === "contain" ? "contain" : "cover";
          const address = (links[slot.key] || "").trim();
          const chip =
            "flex items-center gap-1.5 rounded-chip border border-line bg-canvas px-2 py-1 text-[11px] font-semibold text-heading hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50";

          return (
            <div
              key={slot.key}
              ref={(node) => {
                rowRefs.current[slot.key] = node;
              }}
              id={`form-slot-${slot.key}`}
              data-slot-picture={slot.key}
              onMouseEnter={() => onHighlightSlot?.(slot.key)}
              onMouseLeave={() => onHighlightSlot?.(null)}
              className={`space-y-2 rounded-card border p-2.5 transition-all ${
                isRowHighlighted
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-line bg-section/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-heading uppercase tracking-wider flex items-center gap-1.5">
                  {numInfo && (
                    <span className="text-primary font-mono text-[11px] font-bold">
                      {numInfo.label} ·
                    </span>
                  )}
                  <span>{slot.label}</span>
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {answer ? "Your picture is in place" : "Nothing here yet"}
                </span>
              </div>

              {slot.hint ? (
                <p className="text-[11px] text-muted-foreground">{slot.hint}</p>
              ) : null}

              {answer ? (
                <div className="aspect-[4/3] w-full overflow-hidden rounded-chip border border-line bg-preview">
                  <img
                    src={answer}
                    alt=""
                    crossOrigin="anonymous"
                    className="h-full w-full"
                    style={{ objectFit: fit }}
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-chip border border-dashed border-line bg-preview px-3 text-center">
                  <ImageOff className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">
                    {slot.hint || "No picture in this space yet."}
                  </p>
                </div>
              )}

              {answer ? (
                <PhotoBar
                  label={`${slot.label} picture`}
                  currentUrl={answer}
                  alternatives={choicesFor(slot)}
                  fit={fit}
                  busy={busy}
                  progress={busy ? upload.progress : null}
                  error={upload.key === slot.key ? upload.error : ""}
                  canUpload={canUpload}
                  maxBytes={BLANK_IMAGE_MAX_BYTES}
                  uploadNotice={BLANK_MESSAGES.uploadNeedsAdmin}
                  onPick={(url) => sendImage(slot, url)}
                  onUpload={(file) => uploadImage(slot, file)}
                  onRemove={() => sendImage(slot, "")}
                  onFit={(val) =>
                    onViewChange?.(
                      withBlankFit(
                        view,
                        slot.id,
                        blankFitOf(view, slot.id) === val ? null : val,
                      ),
                    )
                  }
                />
              ) : (
                <div
                  role="group"
                  aria-label={`${slot.label} picture`}
                  className="space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-1">
                    {canUpload ? (
                      <button
                        ref={(node) => {
                          inputRefs.current[slot.key] = node;
                        }}
                        type="button"
                        className={chip}
                        disabled={busy}
                        onFocus={() => onHighlightSlot?.(slot.key)}
                        onBlur={() => onHighlightSlot?.(null)}
                        onClick={() => fileRefs.current[slot.key]?.click()}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {busy ? "Uploading…" : "Upload"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={chip}
                      aria-expanded={picking}
                      onFocus={() => onHighlightSlot?.(slot.key)}
                      onBlur={() => onHighlightSlot?.(null)}
                      onClick={() => openPicker(slot)}
                    >
                      <Images className="h-3.5 w-3.5" />
                      Choose from my uploads
                    </button>
                  </div>

                  <form
                    className="flex items-center gap-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!address) return;
                      sendImage(slot, address);
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      type="url"
                      aria-label={`${slot.label} picture address`}
                      value={links[slot.key] || ""}
                      onFocus={() => onHighlightSlot?.(slot.key)}
                      onBlur={() => onHighlightSlot?.(null)}
                      onChange={(event) =>
                        setLinks((prev) => ({
                          ...prev,
                          [slot.key]: event.target.value,
                        }))
                      }
                      placeholder="Paste a picture address"
                      className="input-field h-8 flex-1 text-xs"
                    />
                    <button
                      type="submit"
                      className={chip}
                      disabled={!address}
                      title="Put that picture in this space"
                    >
                      Use
                    </button>
                  </form>

                  {picking ? (
                    <div className="grid grid-cols-3 gap-1.5 rounded-chip border border-line bg-canvas p-1.5">
                      {assetsBusy ? (
                        <p className="col-span-3 px-1 text-[11px] text-muted-foreground">
                          Opening your pictures…
                        </p>
                      ) : null}
                      {!assetsBusy && assetsError ? (
                        <p className="col-span-3 px-1 text-[11px] text-danger" role="status">
                          {assetsError}
                        </p>
                      ) : null}
                      {!assetsBusy && !assetsError && !assets?.length ? (
                        <p className="col-span-3 px-1 text-[11px] text-muted-foreground">
                          No pictures in your library yet.
                        </p>
                      ) : null}
                      {(assets || []).map((asset) => (
                        <button
                          key={asset.url}
                          type="button"
                          onClick={() => sendImage(slot, asset.url)}
                          className="aspect-square overflow-hidden rounded-chip border border-line bg-preview hover:border-primary"
                          title={asset.name || "Use this picture"}
                        >
                          <img
                            src={asset.url}
                            alt=""
                            crossOrigin="anonymous"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {takenOut ? (
                    <p className="text-[11px] text-muted-foreground">
                      You took the picture out.{" "}
                      <button
                        type="button"
                        onClick={() => undoRemove(slot)}
                        className="font-semibold text-primary hover:underline"
                      >
                        Undo
                      </button>
                    </p>
                  ) : null}

                  {upload.key === slot.key && upload.error ? (
                    <p className="text-[11px] text-danger" role="status">
                      {upload.error}
                    </p>
                  ) : null}

                  {!canUpload ? (
                    <p className="text-[11px] leading-snug text-body">
                      {BLANK_MESSAGES.uploadNeedsAdmin}
                    </p>
                  ) : null}
                </div>
              )}

              <input
                ref={(node) => {
                  fileRefs.current[slot.key] = node;
                }}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                aria-label={`Choose a picture for ${slot.label} from this device`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) uploadImage(slot, file);
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Empty slots summary & Hide action */}
      {emptySlots.length > 0 && (
        <div className="p-3 rounded-card bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-amber-900">
              {emptySentence}
            </span>
            <button
              type="button"
              onClick={handleHideEmptySlots}
              className="px-2.5 py-1 rounded-[4px] bg-white border border-amber-300 text-[11px] font-medium text-amber-900 hover:bg-amber-100/60 shadow-sm transition-colors"
            >
              Hide empty slots from this poster
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {emptySlots.map((slot) => {
              const num = itemNumbers.get(slot.id);
              const title = num ? `${num.label} · ${slot.label}` : slot.label;
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => {
                    rowRefs.current[slot.key]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    inputRefs.current[slot.key]?.focus();
                    onHighlightSlot?.(slot.key);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip bg-white border border-amber-200 text-[11px] text-amber-800 hover:border-amber-400 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden slots list */}
      {hiddenSlotList.length > 0 && (
        <div className="p-3 rounded-card bg-muted/30 border border-line space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-heading">
              Hidden from poster ({hiddenSlotList.length})
            </span>
            <button
              type="button"
              onClick={handleUnhideAll}
              className="px-2.5 py-1 rounded-[4px] bg-white border border-line text-[11px] font-medium text-heading hover:bg-section shadow-sm transition-colors"
            >
              Show all hidden slots
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hiddenSlotList.map((slot) => {
              const num = itemNumbers.get(slot.id);
              const title = num ? `${num.label} · ${slot.label}` : slot.label;
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => handleUnhideSlot(slot.key)}
                  title="Click to show this slot again"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-chip bg-canvas border border-line text-[11px] text-muted-foreground hover:text-heading hover:border-primary transition-colors"
                >
                  <span className="line-through">{title}</span>
                  <span className="text-[10px] text-primary font-bold">+</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
