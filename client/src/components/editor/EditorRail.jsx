import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  LayoutGrid,
  ListChecks,
  Loader2,
  Lock,
  LockOpen,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Shapes,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { directUploadAsset } from "../../utils/assetUpload";
import { CARD_LIST_PRESETS } from "../../utils/cardListHelpers";
import BrandImageField from "../brand/BrandImageField";
import {
  BackgroundEditor,
  ColorInput,
  LIMITS,
  Segmented,
  SliderNumber,
  Toggle,
} from "../brand/controls";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_PAGE_DECORATION,
  DEFAULT_PAGE_INFO_CARD,
  DEFAULT_PAGE_WATERMARK,
  ELEMENT_LIMITS,
  ICON_NAMES,
  VARIABLE_LIMITS,
  isBrandColorToken,
  resolveColorToken,
} from "../../../../shared/templateElements.js";
import { posterIconComponent } from "../posterIcons.js";
import { toHex } from "../../utils/contrast.js";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  SHAPE_VARIANTS,
  TEXT_VARIANTS,
  counterLine,
  isHeadlineItem,
  itemLabel,
  layersOf,
  modeOf,
  pictureCountOf,
  userImageCount,
} from "../../utils/templateEditorItems";

/* ------------------------------------------------------------------ *
 * The narrow strip down the left, and the panel it slides open.
 *
 * Seven doors: the poster's own parts, words of your own, photos, plain shapes,
 * the order things sit in, the poster's page overrides and the organization's brand.
 * Each one opens over the canvas and shuts again as soon as you click the poster,
 * so the canvas is never squeezed by a permanent panel.
 * ------------------------------------------------------------------ */

export const RAIL_TABS = [
  {
    key: "fields",
    label: "Fields",
    title: "Built-in fields",
    Icon: ListChecks,
  },
  { key: "cardlists", label: "Lists", title: "Card lists", Icon: LayoutGrid },
  { key: "text", label: "Text", title: "Add text", Icon: Type },
  { key: "images", label: "Images", title: "Photos", Icon: ImageIcon },
  { key: "shapes", label: "Shapes", title: "Shapes", Icon: Shapes },
  { key: "layers", label: "Order", title: "What is in front", Icon: Layers },
  { key: "page", label: "Page", title: "Page settings", Icon: Sliders },
  { key: "brand", label: "Brand", title: "Brand style", Icon: Palette },
];

export default function EditorRail({ tab, onTab, activeSection = "content" }) {
  return (
    <nav
      aria-label="What to add"
      className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-[#E5E7EB] bg-[#FAFAFA] py-2"
    >
      {RAIL_TABS.map(({ key, label, Icon }) => {
        const disabled = (key === "fields" || key === "cardlists") && activeSection !== "content";
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={label}
            title={
              disabled
                ? "Fields can only be placed in the content area"
                : label
            }
            aria-pressed={active}
            onClick={() => {
              if (!disabled) onTab(active ? "" : key);
            }}
            className={`group flex w-16 flex-col items-center gap-1.5 rounded-[6px] py-1.5 text-[11px] font-medium leading-tight transition-colors ${
              disabled
                ? "opacity-30 cursor-not-allowed text-[#9CA3AF]"
                : active
                  ? "text-[#111827]"
                  : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] border transition-all ${
                disabled
                  ? "border-transparent bg-gray-100 text-[#9CA3AF]"
                  : active
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] shadow-xs"
                    : "border-[#D1D5DB] bg-white text-[#4B5563] group-hover:border-[#9CA3AF] group-hover:bg-[#F9FAFB]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className={active ? "font-semibold text-[#111827]" : "text-[#4B5563]"}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Row({
  item,
  selected,
  onSelect,
  children,
  dropTarget = false,
  handle = null,
  inList = false,
  allItems = null,
}) {
  return (
    <div
      data-layer-row={inList ? item.id : undefined}
      className={`flex items-center gap-1.5 rounded-[6px] border px-2 py-1.5 ${
        dropTarget || selected
          ? "border-[#2563EB] bg-[#EFF6FF]"
          : "border-[#E5E7EB] bg-white"
      } ${dropTarget ? "border-dashed" : ""}`}
    >
      {handle}
      <ModeChip item={item} />
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="min-w-0 flex-1 truncate text-left text-xs font-medium text-[#111827] hover:text-[#2563EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
      >
        {itemLabel(item, allItems)}
      </button>
      {children}
    </div>
  );
}

const MODE_CHIPS = {
  ai: {
    label: "The assistant writes these words",
    Icon: Sparkles,
    className: "border-blue-200 bg-[#EFF6FF] text-[#2563EB]",
  },
  user: {
    label: "The person filling this in chooses the picture",
    Icon: ImagePlus,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  locked: {
    label: "Locked, part of the design",
    Icon: Lock,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  hold: {
    label: "Fixed in place",
    Icon: Lock,
    className: "border-line bg-section text-muted-foreground",
  },
};

function Chip({ tone, label, Icon }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`shrink-0 rounded border p-0.5 ${tone.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

/** The same cues the canvas shows, so a list row says what the box on the poster says. */
function ModeChip({ item }) {
  const tone = MODE_CHIPS[modeOf(item)];
  if (item?.kind === "text" || item?.kind === "image") {
    return <Chip tone={tone} label={tone.label} Icon={tone.Icon} />;
  }
  if (item?.locked)
    return (
      <Chip
        tone={MODE_CHIPS.hold}
        label={MODE_CHIPS.hold.label}
        Icon={MODE_CHIPS.hold.Icon}
      />
    );
  return null;
}

function TinyButton({ label, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded p-1 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        label === "Remove"
          ? "text-[rgb(220,38,38)] hover:bg-red-50"
          : "text-muted-foreground hover:bg-section hover:text-heading"
      }`}
    >
      {icon}
    </button>
  );
}

const lockIcon = (locked) =>
  locked ? (
    <LockOpen className="h-3.5 w-3.5" />
  ) : (
    <Lock className="h-3.5 w-3.5" />
  );

function AddButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-[6px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-left text-xs font-medium text-[#111827] hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#9CA3AF] disabled:hover:border-[#E5E7EB] disabled:hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
    >
      {children}
    </button>
  );
}

function Note({ children }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

const RADIUS = ELEMENT_LIMITS.radius;
const OPACITY = ELEMENT_LIMITS.opacity;
const STROKE = ELEMENT_LIMITS.strokeWidth;

function hexOf(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "";
}

function opacityOf(style) {
  const value = Number(style?.opacity);
  return Number.isFinite(value)
    ? Math.min(OPACITY.max, Math.max(OPACITY.min, value))
    : OPACITY.max;
}

/** A colour you can pick or type, with a way back to "no colour at all". */
function ColourRow({ label, value, fallback = "#0f172a", brandKit = null, onPick, onCommit }) {
  const isToken = isBrandColorToken(value);
  const resolved = resolveColorToken(value, brandKit);
  const shown = hexOf(resolved);
  /* What is typed stays on screen while it is being typed, even when it is not a colour yet. */
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  const finish = () => {
    const raw = draft.trim();
    const next = raw === "" || /^#[0-9a-f]{6}$/i.test(raw) || isBrandColorToken(raw) ? raw : value || "";
    setDraft(next);
    onCommit?.(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-body">{label}</span>
        {isToken ? (
          <span className="text-[10px] font-semibold text-primary capitalize">
            {value.replace("brand:", "")}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <input
            type="color"
            aria-label={label}
            value={shown || fallback}
            onChange={(event) => onPick?.(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded-[6px] border border-[#E5E7EB] bg-white p-0.5"
          />
          <input
            type="text"
            aria-label={`${label} code`}
            value={draft}
            placeholder="none"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(value || "");
                event.currentTarget.blur();
              }
            }}
            className="h-8 w-[76px] rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs font-mono text-[#111827]"
          />
        </span>
      </div>
      {brandKit ? (
        <div className="flex items-center gap-1.5 justify-end">
          {["brand:primary", "brand:secondary", "brand:accent", "brand:text"].map((tok) => {
            const swatchHex = toHex(resolveColorToken(tok, brandKit), "#ffffff");
            return (
              <button
                key={tok}
                type="button"
                title={`Brand ${tok.replace("brand:", "")}`}
                onClick={() => {
                  setDraft(tok);
                  onCommit?.(tok);
                }}
                className={`h-4 w-4 rounded-full border border-slate-300 hover:scale-110 transition-transform ${
                  value === tok ? "ring-2 ring-primary ring-offset-1" : ""
                }`}
                style={{ backgroundColor: swatchHex }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** A slider with the number it stands for written next to it. */
function AmountRow({
  label,
  value,
  min,
  max,
  step = 1,
  readout,
  onLive,
  onCommit,
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-body">{label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {readout}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onLive?.(Number(event.target.value))}
        onPointerUp={(event) => onCommit?.(Number(event.currentTarget.value))}
        onBlur={(event) => onCommit?.(Number(event.target.value))}
        className="w-full accent-[#2563eb]"
      />
    </div>
  );
}

/** A number you type, held inside the range the save rules allow. */
function NumberRow({ label, value, min, max, onLive, onCommit }) {
  const [draft, setDraft] = useState(() => String(value ?? min));
  useEffect(() => {
    setDraft(String(value ?? min));
  }, [value, min]);

  const hold = (n) => Math.min(max, Math.max(min, Math.round(n)));
  const change = (raw) => {
    setDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n)) onLive?.(hold(n));
  };
  const finish = () => {
    const n = Number(draft);
    const next =
      draft.trim() !== "" && Number.isFinite(n)
        ? hold(n)
        : hold(Number(value) || min);
    setDraft(String(next));
    onCommit?.(next);
  };

  return (
    <label className="flex items-center justify-between gap-2 text-xs text-body">
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        onChange={(event) => change(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-20 rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs tabular-nums text-[#111827]"
      />
    </label>
  );
}

function CardListsPanel({ items, selectedId, actions, activeSection, search = "" }) {
  const cardLists = (items || []).filter((it) => it.kind === "cardlist");
  const filteredPresets = CARD_LIST_PRESETS.filter((p) =>
    !search ? true : p.label.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  if (activeSection !== "content") {
    return (
      <div className="rounded-[8px] border border-[#E5E7EB] bg-slate-50 p-4 text-center">
        <p className="text-xs text-[#6B7280]">
          Card lists can only be placed in the Content area.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Add Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
            Add a card list
          </span>
          <span className="text-[11px] font-mono text-[#6B7280]">
            {cardLists.length}/12
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={cardLists.length >= 12}
              onClick={() => actions.addCardList?.(preset.data)}
              className="flex items-start gap-2.5 rounded-[6px] border border-[#E5E7EB] bg-white p-2.5 text-left hover:border-[#2563EB] hover:bg-blue-50/30 transition-colors disabled:opacity-50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-blue-50 text-[#2563EB] mt-0.5">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#111827]">{preset.label}</p>
                <p className="text-[11px] text-[#6B7280] truncate">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Existing Card Lists */}
      {cardLists.length > 0 && (
        <div className="border-t border-[#E5E7EB] pt-3">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2 block">
            Lists on this poster
          </span>

          <div className="space-y-2">
            {cardLists.map((cl) => {
              const isSelected = cl.id === selectedId;
              return (
                <div
                  key={cl.id}
                  onClick={() => actions.select?.(cl.id)}
                  className={`rounded-[6px] border p-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#2563EB] bg-blue-50/40 ring-1 ring-[#2563EB]'
                      : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#111827]">
                      {cl.label || cl.key}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Delete list"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.remove?.(cl.id);
                        }}
                        className="text-[#9CA3AF] hover:text-red-600 p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                    <span>
                      {cl.columns || 2} cols · max {cl.maxCount || 12}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.editCard?.(cl.id);
                      }}
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Draw card →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldsPanel({ items, selectedId, actions, search = "" }) {
  const q = search.trim().toLowerCase();
  const visibleFields = FIELD_ORDER.filter(
    (field) => !q || FIELD_LABELS[field].toLowerCase().includes(q)
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The poster&rsquo;s own parts, whose words come from what the person
        filling it in types.
      </p>
      {visibleFields.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] py-2 text-center">No fields match your search.</p>
      ) : (
        <ul className="space-y-1.5">
          {visibleFields.map((field) => {
            const placed = items.filter(
              (item) => item.kind === "field" && item.field === field,
            );
            if (placed.length === 0) {
              return (
                <li key={field}>
                  <AddButton onClick={() => actions.addField(field)}>
                    Add {FIELD_LABELS[field]}
                  </AddButton>
                </li>
              );
            }
            return (
              <li key={field} className="space-y-1">
                {placed.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={actions.select}
                  >
                    <TinyButton
                      label={item.locked ? "Allow moving" : "Keep in place"}
                      icon={lockIcon(item.locked)}
                      onClick={() => actions.toggleLock(item.id)}
                    />
                    <TinyButton
                      label="Remove"
                      icon={<X className="h-3.5 w-3.5" />}
                      disabled={isHeadlineItem(item)}
                      onClick={() => actions.remove(item.id)}
                    />
                  </Row>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      <Note>The headline always stays on the poster.</Note>
    </div>
  );
}

function TextPanel({ items, selectedId, actions, activeSection = "content", search = "" }) {
  const q = search.trim().toLowerCase();
  const textItems = items.filter((item) => item.kind === "text" && (!q || itemLabel(item).toLowerCase().includes(q)));
  const counters = counterLine(items);

  const brandChips = [
    { token: "{{brand.orgName}}", label: "Organization" },
    { token: "{{brand.website}}", label: "Website" },
    { token: "{{brand.phone}}", label: "Phone" },
    { token: "{{brand.email}}", label: "Email" },
    { token: "{{brand.address}}", label: "Address" },
    { token: "{{brand.legalText}}", label: "Legal text" },
  ].filter((c) => !q || c.label.toLowerCase().includes(q) || c.token.toLowerCase().includes(q));

  const visibleVariants = Object.entries(TEXT_VARIANTS).filter(
    ([key, variant]) => !q || variant.label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-3">
      {activeSection !== "content" && brandChips.length > 0 ? (
        <div className="space-y-2 rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-3">
          <p className="text-[13px] font-semibold text-[#111827]">Brand text</p>
          <p className="text-[11px] text-[#6B7280]">
            Click a chip to place brand details in the band:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brandChips.map(({ token, label }) => (
              <button
                key={token}
                type="button"
                onClick={() => actions.addBrandText?.(token)}
                className="rounded-[4px] border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-[#111827] hover:border-[#2563EB] hover:bg-[#EFF6FF]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {activeSection !== "content"
          ? "Add a line of words for the top or bottom. It stays fixed on every poster."
          : "A new box is words the assistant writes for each poster; switch it to Locked for words of your own."}
      </p>
      {visibleVariants.length > 0 ? (
        <div className="space-y-1.5">
          {visibleVariants.map(([key, variant]) => (
            <AddButton key={key} onClick={() => actions.addText(key)}>
              Add {variant.label}
            </AddButton>
          ))}
        </div>
      ) : null}
      {activeSection === "content" && counters.fullTexts ? (
        <Note>
          A new box will hold fixed words of your own, since {counters.texts}.
        </Note>
      ) : null}
      {textItems.length > 0 ? (
        <div className="space-y-1.5 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">In this section</p>
          {textItems.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      ) : null}
      <Note>
        {items.length} of {activeSection === "content" ? ELEMENT_LIMITS.maxItems : 15} items placed.
      </Note>
    </div>
  );
}

function ImagesPanel({ items, selectedId, actions, brandKit, activeSection = "content", search = "" }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin" || user?.role === "clientadmin";

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const fetchAssets = useCallback(async (pageNum = 1, searchQuery = "", append = false) => {
    setLoadingAssets(true);
    try {
      const res = await api.get("/assets", {
        params: {
          q: searchQuery,
          page: pageNum,
          limit: 12,
        },
      });
      const data = res.data?.data || {};
      const newItems = Array.isArray(data.items) ? data.items : [];
      setAssets((prev) => (append ? [...prev, ...newItems] : newItems));
      setPage(data.page || pageNum);
      setTotalPages(data.pages || 1);
    } catch {
      // Fallback
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets(1, search, false);
  }, [fetchAssets, search]);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploading(true);
    setUploadError("");
    try {
      const asset = await directUploadAsset(file);
      if (asset?.url) {
        setAssets((prev) => [asset, ...prev]);
        // Add as a static image to canvas
        actions.insertImage(asset.url);
      }
    } catch (err) {
      setUploadError(err.message || "Could not upload photo. Please try another one.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAsset = async (assetId, e) => {
    e.stopPropagation();
    if (!window.confirm("Remove this photo from your library?")) return;
    try {
      await api.delete(`/assets/${assetId}`);
      setAssets((prev) => prev.filter((a) => a._id !== assetId));
    } catch {
      alert("Could not remove photo. Please try again.");
    }
  };

  const q = search.trim().toLowerCase();
  const pictures = items.filter(
    (item) => (item.kind === "image" || item.field === "photo") && (!q || itemLabel(item).toLowerCase().includes(q)),
  );
  const chosen = pictures.find((item) => item.id === selectedId) || null;
  const defaultPhoto = brandKit?.content?.defaultImageUrl || "";
  const own = pictureCountOf(items);
  const left = (activeSection === "content" ? ELEMENT_LIMITS.maxImage : 15) - own;
  const userImgCount = userImageCount(items);
  const maxVarImages = VARIABLE_LIMITS.maxImage;

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUploadFile}
        />
        <button
          type="button"
          disabled={isUploading || left <= 0}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Preparing & uploading photo...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>Upload photo (JPG, PNG, WebP)</span>
            </>
          )}
        </button>
        {uploadError && (
          <p className="mt-1.5 text-[11px] text-red-600 font-medium">{uploadError}</p>
        )}
      </div>

      {/* Brand Kit Logo Button */}
      <div className="rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-2.5 space-y-1.5">
        <div className="text-[11px] font-semibold text-[#111827]">Brand Logo</div>
        <button
          type="button"
          onClick={() => (actions.addBrandLogo ? actions.addBrandLogo() : actions.insertImage("brand:logo"))}
          className="w-full flex items-center gap-2 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
        >
          <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="truncate">Logo (from the Brand Kit)</span>
        </button>
      </div>

      {/* Empty Photo Space Button */}
      {activeSection === "content" && (
        <div>
          <button
            type="button"
            disabled={userImgCount >= maxVarImages || left <= 0}
            onClick={() => actions.addImage()}
            className="w-full flex items-center justify-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-medium text-[#374151] transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-[#6B7280]" />
            <span>Add empty photo space ({userImgCount} of {maxVarImages})</span>
          </button>
          <p className="mt-1 text-[11px] text-[#6B7280]">
            A blank space for users making the poster to fill in.
          </p>
        </div>
      )}

      {/* Asset Library Grid */}
      <div className="space-y-2 border-t border-[#E5E7EB] pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[#111827]">Photo Library</p>
          <span className="text-[11px] text-[#6B7280]">Click or drag to place</span>
        </div>

        {loadingAssets && assets.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-[#9CA3AF] text-xs gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading photos...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[#D1D5DB] p-4 text-center text-xs text-[#6B7280]">
            No photos found. Upload a photo above to add to your organization&apos;s library.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <div
                key={asset._id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", asset.url);
                }}
                onClick={() => actions.insertImage(asset.url)}
                className="group relative flex flex-col rounded-[6px] border border-[#E5E7EB] bg-white overflow-hidden cursor-pointer hover:border-[#2563EB] hover:shadow-sm transition-all"
                title={`${asset.name || "Photo"} — click or drag to add to poster`}
              >
                <div className="aspect-[4/3] w-full bg-[#F3F4F6] overflow-hidden flex items-center justify-center">
                  <img
                    src={asset.url}
                    alt={asset.name || "Photo"}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-1.5 px-2 bg-white flex items-center justify-between gap-1 border-t border-[#F3F4F6]">
                  <span className="text-[11px] font-medium text-[#374151] truncate">
                    {asset.name || "Untitled"}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Delete photo from library"
                      onClick={(e) => handleDeleteAsset(asset._id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-red-600 rounded hover:bg-red-50 transition-all shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more button */}
        {page < totalPages && (
          <button
            type="button"
            disabled={loadingAssets}
            onClick={() => fetchAssets(page + 1, search, true)}
            className="w-full py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-[4px] transition-colors"
          >
            {loadingAssets ? "Loading more..." : "Load more photos"}
          </button>
        )}
      </div>

      {/* On This Poster Section */}
      {pictures.length > 0 && (
        <div className="space-y-1.5 border-t border-[#E5E7EB] pt-3">
          <p className="text-[12px] font-semibold text-[#111827]">On this poster</p>
          {pictures.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      )}

      {chosen ? (
        <div className="space-y-3 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">
            {itemLabel(chosen)}
          </p>
          {chosen.variable ? (
            <Note>
              Whoever makes the poster chooses this picture, so it prints empty
              until they do.
            </Note>
          ) : null}

          {chosen.kind === "image" ? (
            <>
              <BrandImageField
                label="Choose a different photo"
                kind="template"
                value={chosen.imageUrl || ""}
                onChange={(url) => actions.setImageUrl(chosen.id, url)}
              />
              {defaultPhoto && chosen.imageUrl !== defaultPhoto ? (
                <button
                  type="button"
                  onClick={() => actions.setImageUrl(chosen.id, defaultPhoto)}
                  className="w-full rounded-btn border border-line px-3 py-2 text-xs font-semibold text-heading hover:bg-section"
                >
                  Use your organization&rsquo;s own photo
                </button>
              ) : null}
            </>
          ) : (
            <Note>
              This space shows the photo that comes with each event, so it has
              no picture of its own.
            </Note>
          )}

          <AmountRow
            label="Rounded corners"
            value={Math.min(
              RADIUS.max,
              Math.max(RADIUS.min, Number(chosen.style?.radius) || 0),
            )}
            min={RADIUS.min}
            max={RADIUS.max}
            readout={Math.round(Number(chosen.style?.radius) || 0)}
            onLive={(radius) => actions.setStyleLive(chosen.id, { radius })}
            onCommit={(radius) => actions.setStyle(chosen.id, { radius })}
          />
          <AmountRow
            label="See-through"
            value={opacityOf(chosen.style)}
            min={OPACITY.min}
            max={OPACITY.max}
            step={0.05}
            readout={`${Math.round(opacityOf(chosen.style) * 100)}%`}
            onLive={(opacity) => actions.setStyleLive(chosen.id, { opacity })}
            onCommit={(opacity) => actions.setStyle(chosen.id, { opacity })}
          />
        </div>
      ) : null}
    </div>
  );
}

function ShapesPanel({ items, selectedId, actions, brandKit = null, search = "" }) {
  const q = search.trim().toLowerCase();
  const shapesAndIcons = items.filter(
    (item) =>
      (item.kind === "shape" || item.kind === "icon") &&
      (!q || itemLabel(item).toLowerCase().includes(q))
  );
  const chosen = shapesAndIcons.find((item) => item.id === selectedId) || null;
  const shape = chosen?.shape || {};
  const isLine = shape.type === "line";
  const isIconChosen = chosen?.kind === "icon";

  const visibleVariants = Object.entries(SHAPE_VARIANTS).filter(
    ([key, variant]) =>
      !q || variant.label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
  );

  const filteredIcons = ICON_NAMES.filter(
    (name) => !q || name.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-3">
      {/* 8 SHAPES */}
      {visibleVariants.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-[#111827]">Shapes</p>
          <div className="grid grid-cols-2 gap-1.5">
            {visibleVariants.map(([key, variant]) => (
              <button
                key={key}
                type="button"
                onClick={() => actions.addShape(key)}
                className="flex items-center gap-2 rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] px-2.5 py-2 text-left text-xs font-medium text-[#111827] hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
              >
                {key === "circle" ? (
                  <Circle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                ) : key === "line" ? (
                  <ArrowDown className="h-3.5 w-3.5 rotate-90 text-slate-600 shrink-0" />
                ) : key === "star" ? (
                  <Sparkles className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                ) : key === "triangle" ? (
                  <ArrowUp className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                ) : key === "rounded-rect" ? (
                  <Square className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                )}
                <span className="truncate">{variant.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ALLOWED ICONS */}
      {filteredIcons.length > 0 && (
        <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#111827]">Icons</p>
            <span className="text-[10px] text-[#6B7280]">
              {filteredIcons.length} available
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1 border border-[#E5E7EB] rounded-[6px] bg-[#FAFAFA]">
            {filteredIcons.map((name) => {
              const IconComp = posterIconComponent(name);
              if (!IconComp) return null;
              return (
                <button
                  key={name}
                  type="button"
                  title={`Add ${name}`}
                  onClick={() => actions.addIcon?.(name)}
                  className="flex flex-col items-center justify-center p-2 rounded-[4px] bg-white border border-[#E5E7EB] hover:border-[#2563EB] hover:bg-[#EFF6FF] text-[#374151] hover:text-[#2563EB] transition-colors"
                >
                  <IconComp className="h-5 w-5" />
                  <span className="text-[9px] truncate max-w-full mt-1 text-[#6B7280]">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ITEMS IN THIS SECTION */}
      {shapesAndIcons.length > 0 ? (
        <div className="space-y-1.5 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">On this poster</p>
          {shapesAndIcons.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      ) : (
        <Note>
          A shape, line or icon adds structure and polish to your poster.
        </Note>
      )}

      {/* CHOSEN ITEM EDITING */}
      {chosen ? (
        <div className="space-y-3 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">
            {isIconChosen ? "This icon" : "This shape"}
          </p>

          {isIconChosen ? (
            <>
              <ColourRow
                label="Icon colour"
                value={chosen.style?.color || ""}
                fallback="#0f172a"
                brandKit={brandKit}
                onPick={(color) => actions.setStyleLive(chosen.id, { color })}
                onCommit={(color) => actions.setStyle(chosen.id, { color })}
              />
              <NumberRow
                label="Line thickness"
                value={Number(chosen.style?.strokeWidth) || 2}
                min={1}
                max={4}
                onLive={(strokeWidth) => actions.setStyleLive(chosen.id, { strokeWidth })}
                onCommit={(strokeWidth) => actions.setStyle(chosen.id, { strokeWidth })}
              />
              <AmountRow
                label="See-through"
                value={opacityOf(chosen.style)}
                min={OPACITY.min}
                max={OPACITY.max}
                step={0.05}
                readout={`${Math.round(opacityOf(chosen.style) * 100)}%`}
                onLive={(opacity) => actions.setStyleLive(chosen.id, { opacity })}
                onCommit={(opacity) => actions.setStyle(chosen.id, { opacity })}
              />
            </>
          ) : (
            <>
              {/* Shape variant selector */}
              <div className="flex gap-1 flex-wrap">
                {Object.keys(SHAPE_VARIANTS).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={shape.type === type}
                    onClick={() => actions.setShape(chosen.id, { type })}
                    className={`rounded-[4px] border px-2 py-1 text-[11px] font-semibold ${
                      shape.type === type
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                        : "border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {SHAPE_VARIANTS[type].label}
                  </button>
                ))}
              </div>

              {isLine ? (
                <>
                  <ColourRow
                    label="Line colour"
                    value={shape.stroke || shape.fill || ""}
                    fallback="#334155"
                    brandKit={brandKit}
                    onPick={(color) =>
                      actions.setShape(chosen.id, { stroke: color, fill: "" })
                    }
                    onCommit={(color) =>
                      actions.setShape(chosen.id, { stroke: color, fill: "" })
                    }
                  />
                  <NumberRow
                    label="Line thickness"
                    value={Number(shape.strokeWidth) || 4}
                    min={1}
                    max={STROKE.max}
                    onLive={(strokeWidth) =>
                      actions.setShape(chosen.id, { strokeWidth })
                    }
                    onCommit={(strokeWidth) =>
                      actions.setShape(chosen.id, { strokeWidth })
                    }
                  />
                </>
              ) : (
                <>
                  <ColourRow
                    label="Fill colour"
                    value={shape.fill || ""}
                    fallback="#059669"
                    brandKit={brandKit}
                    onPick={(fill) => actions.setShape(chosen.id, { fill })}
                    onCommit={(fill) => actions.setShape(chosen.id, { fill })}
                  />
                  <ColourRow
                    label="Border colour"
                    value={shape.stroke || ""}
                    fallback="#0f172a"
                    brandKit={brandKit}
                    onPick={(stroke) => actions.setShape(chosen.id, { stroke })}
                    onCommit={(stroke) => actions.setShape(chosen.id, { stroke })}
                  />
                  <NumberRow
                    label="Border thickness"
                    value={Number(shape.strokeWidth) || 0}
                    min={STROKE.min}
                    max={STROKE.max}
                    onLive={(strokeWidth) =>
                      actions.setShape(chosen.id, { strokeWidth })
                    }
                    onCommit={(strokeWidth) =>
                      actions.setShape(chosen.id, { strokeWidth })
                    }
                  />
                  {shape.type === "rect" || shape.type === "rounded-rect" ? (
                    <AmountRow
                      label="Rounded corners"
                      value={Math.min(
                        RADIUS.max,
                        Math.max(RADIUS.min, Number(chosen.style?.radius ?? shape.radius) || 0),
                      )}
                      min={RADIUS.min}
                      max={RADIUS.max}
                      readout={Math.round(Number(chosen.style?.radius ?? shape.radius) || 0)}
                      onLive={(radius) => {
                        actions.setStyleLive(chosen.id, { radius });
                        actions.setShape(chosen.id, { radius });
                      }}
                      onCommit={(radius) => {
                        actions.setStyle(chosen.id, { radius });
                        actions.setShape(chosen.id, { radius });
                      }}
                    />
                  ) : null}
                </>
              )}

              <AmountRow
                label="See-through"
                value={opacityOf(chosen.style)}
                min={OPACITY.min}
                max={OPACITY.max}
                step={0.05}
                readout={`${Math.round(opacityOf(chosen.style) * 100)}%`}
                onLive={(opacity) => actions.setStyleLive(chosen.id, { opacity })}
                onCommit={(opacity) => actions.setStyle(chosen.id, { opacity })}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LayersPanel({ items, selectedId, hiddenIds, actions, search = "" }) {
  const q = search.trim().toLowerCase();
  const layers = layersOf(items).filter(
    (item) => !q || itemLabel(item).toLowerCase().includes(q)
  );
  const [drag, setDrag] = useState(null);

  const rowUnder = (event) => {
    const node =
      typeof document !== "undefined"
        ? document.elementFromPoint?.(event.clientX, event.clientY)
        : null;
    return (
      node?.closest?.("[data-layer-row]")?.getAttribute("data-layer-row") || ""
    );
  };

  const startDrag = (event, id) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    setDrag({ id, over: "" });

    const move = (moveEvent) =>
      setDrag((prev) =>
        prev ? { ...prev, over: rowUnder(moveEvent) || prev.over } : prev,
      );
    const end = (endEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const target = rowUnder(endEvent);
      setDrag(null);
      if (target && target !== id) actions.dropLayer(id, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  if (layers.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Nothing has been placed on this poster yet.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        What sits on top of what. The first row is the closest to you. Grab the
        handle to move a row, or use the arrows.
      </p>
      <ul className="space-y-1">
        {layers.map((item, index) => {
          const hidden = Boolean(hiddenIds?.has?.(item.id));
          return (
            <li key={item.id}>
              <Row
                item={item}
                allItems={items}
                selected={item.id === selectedId}
                onSelect={actions.select}
                inList
                dropTarget={
                  Boolean(drag) && drag.over === item.id && drag.id !== item.id
                }
                handle={
                  <button
                    type="button"
                    aria-label={`Move ${itemLabel(item)} in the stack`}
                    title="Drag to change the order"
                    onPointerDown={(event) => startDrag(event, item.id)}
                    className="shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-section hover:text-heading touch-none"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                }
              >
                <TinyButton
                  label="Bring forward"
                  icon={<ArrowUp className="h-3.5 w-3.5" />}
                  disabled={index === 0}
                  onClick={() => actions.moveLayer(item.id, 1)}
                />
                <TinyButton
                  label="Send backward"
                  icon={<ArrowDown className="h-3.5 w-3.5" />}
                  disabled={index === layers.length - 1}
                  onClick={() => actions.moveLayer(item.id, -1)}
                />
                <TinyButton
                  label={item.locked ? "Allow moving" : "Keep in place"}
                  icon={lockIcon(item.locked)}
                  onClick={() => actions.toggleLock(item.id)}
                />
                <TinyButton
                  label={
                    hidden ? "Show on the poster again" : "Hide while you edit"
                  }
                  icon={
                    hidden ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={() => actions.toggleHidden(item.id)}
                />
                <TinyButton
                  label="Remove"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={isHeadlineItem(item)}
                  onClick={() => actions.remove(item.id)}
                />
              </Row>
            </li>
          );
        })}
      </ul>
      <Note>
        Hiding only keeps something out of your way while you place the rest.
        The poster a person downloads always has every item on it.
      </Note>
    </div>
  );
}

function PageSection({
  title,
  isCustom,
  onToggleMode,
  onReset,
  children,
}) {
  return (
    <div className="space-y-3 rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#111827]">{title}</span>
        {isCustom ? (
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
              Customized
            </span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              title="Reset to brand setting"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to brand</span>
            </button>
          </div>
        ) : null}
      </div>

      <Segmented
        value={isCustom ? "custom" : "brand"}
        onChange={(val) => onToggleMode(val === "custom")}
        options={[
          { value: "brand", label: "Use brand setting" },
          { value: "custom", label: "Customize" },
        ]}
      />

      {isCustom ? (
        <div className="space-y-3 pt-2 border-t border-line">
          {children}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Using your organization&rsquo;s brand setting.
        </p>
      )}
    </div>
  );
}

function PagePanel({ page, brandKit, onPageChange, onResetSection }) {
  const bg = page?.background || { mode: "brand" };
  const dec = page?.decoration || { mode: "brand" };
  const wm = page?.watermark || { mode: "brand" };
  const card = page?.infoCard || { mode: "brand" };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Customize the poster&rsquo;s backdrop, decorations and info cards. Anything you don&rsquo;t customize will follow your brand kit.
      </p>

      {/* 1. Background */}
      <PageSection
        title="Background"
        isCustom={bg.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("background", {
              ...DEFAULT_PAGE_BACKGROUND,
              ...bg,
              mode: "custom",
            });
          } else {
            onResetSection("background");
          }
        }}
        onReset={() => onResetSection("background")}
      >
        <BackgroundEditor
          label="Poster background"
          value={bg}
          onChange={(patch) =>
            onPageChange("background", { ...bg, ...patch, mode: "custom" })
          }
          types={["color", "gradient", "image", "pattern"]}
          uploadKind="content"
          uploadLabel="Upload background photo"
        />
      </PageSection>

      {/* 2. Decoration */}
      <PageSection
        title="Decoration"
        isCustom={dec.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("decoration", {
              ...DEFAULT_PAGE_DECORATION,
              ...dec,
              mode: "custom",
            });
          } else {
            onResetSection("decoration");
          }
        }}
        onReset={() => onResetSection("decoration")}
      >
        <Segmented
          label="Pattern or shape"
          value={dec.decoration || "none"}
          onChange={(decoration) =>
            onPageChange("decoration", { ...dec, mode: "custom", decoration })
          }
          options={[
            { value: "none", label: "None" },
            { value: "band", label: "Band" },
            { value: "circle", label: "Circle" },
            { value: "corners", label: "Corners" },
          ]}
        />
        {(dec.decoration || "none") !== "none" ? (
          <ColorInput
            label="Decoration color"
            value={dec.decorationColor || "brand:primary"}
            brandKit={brandKit}
            onChange={(decorationColor) =>
              onPageChange("decoration", {
                ...dec,
                mode: "custom",
                decorationColor,
              })
            }
          />
        ) : null}
      </PageSection>

      {/* 3. Watermark */}
      <PageSection
        title="Watermark"
        isCustom={wm.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("watermark", {
              ...DEFAULT_PAGE_WATERMARK,
              ...wm,
              mode: "custom",
            });
          } else {
            onResetSection("watermark");
          }
        }}
        onReset={() => onResetSection("watermark")}
      >
        <Toggle
          label="Show logo watermark"
          checked={Boolean(wm.show)}
          onChange={(show) =>
            onPageChange("watermark", { ...wm, mode: "custom", show })
          }
          hint="Faint brand logo placed in the center of the poster"
        />
        {wm.show ? (
          <SliderNumber
            label="Watermark opacity"
            value={wm.opacity ?? 0.08}
            min={LIMITS.watermarkOpacity.min}
            max={LIMITS.watermarkOpacity.max}
            step={LIMITS.watermarkOpacity.step}
            onChange={(opacity) =>
              onPageChange("watermark", { ...wm, mode: "custom", opacity })
            }
          />
        ) : null}
      </PageSection>

      {/* 4. Cards for date, time and place */}
      <PageSection
        title="Cards for date, time and place"
        isCustom={card.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("infoCard", {
              ...DEFAULT_PAGE_INFO_CARD,
              ...card,
              mode: "custom",
            });
          } else {
            onResetSection("infoCard");
          }
        }}
        onReset={() => onResetSection("infoCard")}
      >
        <ColorInput
          label="Card background"
          value={card.background || "#f8fafc"}
          brandKit={brandKit}
          onChange={(background) =>
            onPageChange("infoCard", { ...card, mode: "custom", background })
          }
        />
        <ColorInput
          label="Card border color"
          value={card.border || "#e2e8f0"}
          brandKit={brandKit}
          onChange={(border) =>
            onPageChange("infoCard", { ...card, mode: "custom", border })
          }
        />
        <ColorInput
          label="Icon color"
          value={card.iconColor || "brand:primary"}
          brandKit={brandKit}
          onChange={(iconColor) =>
            onPageChange("infoCard", { ...card, mode: "custom", iconColor })
          }
        />
        <SliderNumber
          label="Card rounded corners"
          value={card.radius ?? 16}
          min={LIMITS.cardRadius.min}
          max={LIMITS.cardRadius.max}
          step={LIMITS.cardRadius.step}
          unit="px"
          onChange={(radius) =>
            onPageChange("infoCard", { ...card, mode: "custom", radius })
          }
        />
      </PageSection>
    </div>
  );
}

const BRAND_RAIL_SWATCHES = [
  { token: "brand:primary", label: "Primary" },
  { token: "brand:secondary", label: "Secondary" },
  { token: "brand:accent", label: "Accent" },
  { token: "brand:text", label: "Text" },
  { token: "brand:background", label: "Background" },
];

function BrandPanel({
  selectedItem,
  brandKit,
  onApplyColorToken,
  onApplyFontToken,
}) {
  const headingFont = brandKit?.fonts?.heading || "Cinzel";
  const bodyFont = brandKit?.fonts?.body || "Inter";

  return (
    <div className="space-y-4">
      <div className="rounded-btn border border-line bg-section p-3 space-y-2">
        <p className="text-xs text-muted-foreground leading-snug">
          Header and footer are set in the Brand Kit.
        </p>
        <a
          href="/brand-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span>Edit in Brand Kit</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-[#111827]">Brand colours</span>
        <p className="text-[11px] text-[#6B7280]">
          {selectedItem
            ? "Click a colour to apply it to the selected item."
            : "Select an item on the poster to apply a brand colour."}
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {BRAND_RAIL_SWATCHES.map((swatch) => {
            const hex = toHex(resolveColorToken(swatch.token, brandKit), "#ffffff");
            return (
              <button
                key={swatch.token}
                type="button"
                onClick={() => onApplyColorToken?.(swatch.token)}
                disabled={!selectedItem}
                className="flex items-center gap-2.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-2 text-left hover:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className="h-6 w-6 rounded-full border border-slate-300 shrink-0 shadow-inner"
                  style={{ backgroundColor: hex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#111827]">{swatch.label}</p>
                  <p className="font-mono text-[10px] text-[#6B7280] uppercase">{hex}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-[#E5E7EB] pt-3">
        <span className="text-[13px] font-semibold text-[#111827]">Brand fonts</span>
        <p className="text-[11px] text-muted-foreground">
          {selectedItem?.kind === "text"
            ? "Click a font to apply it to the selected text."
            : "Select a text item on the poster to apply a brand font."}
        </p>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onApplyFontToken?.("brand:heading")}
            disabled={selectedItem?.kind !== "text"}
            className="w-full rounded-btn border border-line bg-canvas p-2.5 text-left hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-heading">Brand heading</span>
            <p className="text-sm text-heading mt-0.5 truncate" style={{ fontFamily: `'${headingFont}', sans-serif` }}>
              {headingFont}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onApplyFontToken?.("brand:body")}
            disabled={selectedItem?.kind !== "text"}
            className="w-full rounded-btn border border-line bg-canvas p-2.5 text-left hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-heading">Brand body</span>
            <p className="text-sm text-heading mt-0.5 truncate" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
              {bodyFont}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditorPanel({
  tab,
  items,
  selectedId,
  hiddenIds,
  brandKit,
  page,
  activeSection = "content",
  onPageChange,
  onResetPageSection,
  onApplyColorToken,
  onApplyFontToken,
  actions,
  onClose,
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [tab]);

  useEffect(() => {
    if (!tab) return undefined;
    const escape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tab, onClose]);

  if (!tab) return null;

  const title = RAIL_TABS.find((entry) => entry.key === tab)?.title || "";

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute bottom-0 left-0 top-0 z-[55] w-[320px] max-w-[86vw] flex flex-col border-r border-[#E5E7EB] bg-white shadow-md"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] p-3 pb-2.5 shrink-0">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        <button
          type="button"
          aria-label="Close this panel"
          onClick={onClose}
          className="rounded-[6px] p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 pb-1 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-full rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] pl-8 pr-7 text-xs text-[#111827] placeholder-[#9CA3AF] focus:border-[#2563EB] focus:bg-white focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-[#9CA3AF] hover:text-[#111827]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pt-2">
        {tab === "fields" ? (
          <FieldsPanel items={items} selectedId={selectedId} actions={actions} search={search} />
        ) : null}
        {tab === "cardlists" ? (
          <CardListsPanel
            items={items}
            selectedId={selectedId}
            actions={actions}
            activeSection={activeSection}
            search={search}
          />
        ) : null}
        {tab === "text" ? (
          <TextPanel
            items={items}
            selectedId={selectedId}
            actions={actions}
            activeSection={activeSection}
            search={search}
          />
        ) : null}
        {tab === "images" ? (
          <ImagesPanel
            items={items}
            selectedId={selectedId}
            actions={actions}
            brandKit={brandKit}
            activeSection={activeSection}
            search={search}
          />
        ) : null}
        {tab === "shapes" ? (
          <ShapesPanel
            items={items}
            selectedId={selectedId}
            actions={actions}
            brandKit={brandKit}
            search={search}
          />
        ) : null}
        {tab === "layers" ? (
          <LayersPanel
            items={items}
            selectedId={selectedId}
            hiddenIds={hiddenIds}
            actions={actions}
            search={search}
          />
        ) : null}
        {tab === "page" ? (
          <PagePanel
            page={page}
            brandKit={brandKit}
            onPageChange={onPageChange}
            onResetSection={onResetPageSection}
          />
        ) : null}
        {tab === "brand" ? (
          <BrandPanel
            selectedItem={items.find((item) => item.id === selectedId) || null}
            brandKit={brandKit}
            onApplyColorToken={onApplyColorToken}
            onApplyFontToken={onApplyFontToken}
          />
        ) : null}
      </div>
    </div>
  );
}
