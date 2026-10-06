import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  ChevronDown,
  ImageIcon,
  Layout,
  Link2,
  Palette,
  PanelBottom,
  PanelTop,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import PosterPreview from "../components/PosterPreview";
import BrandImageField from "../components/brand/BrandImageField";
import {
  ColorInput,
  FONT_OPTIONS,
  Field,
  LIMITS,
  SectionCard,
  Segmented,
  Select,
  SliderNumber,
  SOCIAL_OPTIONS,
  TextInput,
  TextStyleEditor,
  Toggle,
  BackgroundEditor,
} from "../components/brand/controls";
import {
  BRAND_RENDER_DEFAULTS,
  resolvePosterBrand,
} from "../utils/brandRender";
import { applyBrandPreset, BRAND_PRESET_LIST } from "../utils/brandPresets";
import { friendlyError } from "../utils/brandImage";
import { contrastLabel, wcagLevel } from "../utils/contrast";

/** Only the Create page's two settings, loaded when that section is opened. */
const DesignModesCard = lazy(
  () => import("../components/brand/DesignModesCard"),
);

const SAMPLE_CONTENT = {
  title: "Community Health Camp",
  tagline: "Free check-ups for every family",
  date: "Saturday, 15 November",
  time: "9:00 am – 4:00 pm",
  venue: "Town Hall Grounds",
  details: [
    "Blood pressure and sugar screening",
    "Nutrition counselling with experts",
    "Children wellness corner",
  ],
  imageUrl: "",
};

const FALLBACK_TEMPLATE = {
  name: "Standard poster",
  size: { width: 1080, height: 1350 },
  zones: [
    {
      id: "zone-header",
      type: "header",
      x: 0,
      y: 0,
      w: 1080,
      h: 140,
      locked: true,
    },
    {
      id: "zone-content",
      type: "content",
      x: 70,
      y: 170,
      w: 940,
      h: 640,
      locked: false,
    },
    {
      id: "zone-image",
      type: "image",
      x: 70,
      y: 830,
      w: 940,
      h: 370,
      locked: false,
    },
    {
      id: "zone-footer",
      type: "footer",
      x: 0,
      y: 1220,
      w: 1080,
      h: 130,
      locked: true,
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

/** A kit for an organization that has never saved one. */
function blankKit() {
  return {
    ...clone(BRAND_RENDER_DEFAULTS),
    orgName: "",
    logos: [],
    colors: {
      primary: "#4338ca",
      secondary: "#1e1b4b",
      accent: "#f59e0b",
      text: "#ffffff",
      background: "#ffffff",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    defaultPosterSize: { width: 1080, height: 1350 },
  };
}

const primaryLogoUrl = (kit) =>
  kit?.logos?.find((l) => l?.isPrimary)?.url || kit?.logos?.[0]?.url || "";

function socialLabel(platform) {
  const labels = {
    x: "X",
    whatsapp: "WhatsApp",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };
  return labels[platform] || platform;
}

/** Measured contrast of a colour the poster actually paints. */
function Readout({ foreground, background, large = false }) {
  const level = wcagLevel(foreground, background, { large });
  const tone =
    level === "AA" || level === "AAA" ? "text-success" : "text-danger";
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${tone}`}>
      {contrastLabel(foreground, background, { large })}
    </span>
  );
}

function CollapsibleSection({
  title,
  desc,
  usedByText,
  icon: Icon,
  defaultOpen = false,
  onReset,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface overflow-hidden border border-line">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5 bg-section/40 border-b border-line">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-start gap-2.5 min-w-0 text-left flex-1 hover:opacity-90"
          aria-expanded={open}
        >
          {Icon && <Icon size={18} className="shrink-0 text-primary mt-0.5" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-heading">{title}</h2>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
            {desc && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {desc}
              </p>
            )}
            {usedByText && (
              <p className="text-[11px] text-primary/80 font-medium mt-1">
                {usedByText}
              </p>
            )}
          </div>
        </button>
        {onReset && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="btn-ghost border border-line shrink-0 text-[11px] px-2 py-1"
            title="Reset this section to saved values"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>
      {open && <div className="p-4 sm:p-5 space-y-4">{children}</div>}
    </div>
  );
}

export default function BrandKit() {
  const { user, activeClientId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [saveError, setSaveError] = useState("");
  const [kit, setKit] = useState(null);
  const [saved, setSaved] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState(FALLBACK_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [pendingPreset, setPendingPreset] = useState(null);
  const [previewOverflow, setPreviewOverflow] = useState(null);

  const [mode, setModeState] = useState(() => {
    try {
      return sessionStorage.getItem("brand-kit-mode") || "simple";
    } catch {
      return "simple";
    }
  });

  const setMode = (next) => {
    setModeState(next);
    try {
      sessionStorage.setItem("brand-kit-mode", next);
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadNote("");
      setSaveError("");
      const [kitResult, templatesResult] = await Promise.all([
        api.get("/brand-kit").catch((err) => err),
        api.get("/templates").catch(() => null),
      ]);
      if (cancelled) return;

      let nextKit = null;
      if (kitResult?.response?.status === 404) {
        nextKit = blankKit();
        setLoadNote(
          "This organization has no brand kit yet. Fill in the details and save when you are done.",
        );
      } else if (!kitResult?.data?.success || !kitResult.data?.data?.brandKit) {
        nextKit = blankKit();
        const status = kitResult?.response?.status;
        setLoadNote(
          status === 401 || status === 403
            ? "Please log in again to open the brand kit."
            : friendlyError(
                kitResult,
                "We could not load the brand kit. Refresh the page to try again.",
              ),
        );
      } else {
        nextKit = kitResult.data.data.brandKit;
      }

      const list = templatesResult?.data?.data?.templates;
      if (Array.isArray(list) && list.length > 0) {
        setTemplates(list);
        setTemplate(list[0]);
      }

      setKit(nextKit);
      setSaved(clone(nextKit));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, user?.clientId]);

  const templateCounts = useMemo(() => {
    const total = templates.length;
    const background = templates.filter(
      (t) => t.page?.background?.mode !== "custom",
    ).length;
    const infoCard = templates.filter(
      (t) => t.page?.infoCard?.mode !== "custom",
    ).length;
    return {
      total,
      header: total,
      footer: total,
      background,
      infoCard,
      fonts: total,
    };
  }, [templates]);

  const formatUsedBy = (count) =>
    count === 1 ? "Used by 1 template" : `Used by ${count} templates`;

  const dirty = useMemo(() => {
    if (!kit || !saved) return false;
    return JSON.stringify(kit) !== JSON.stringify(saved);
  }, [kit, saved]);

  /* Warn before the tab closes with unsaved work. */
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const resolved = useMemo(
    () => (kit ? resolvePosterBrand(kit, template) : null),
    [kit, template],
  );

  const setTop = (over) => setKit((prev) => ({ ...prev, ...over }));
  const setSection = (section, over) =>
    setKit((prev) => ({
      ...prev,
      [section]: { ...(prev[section] || {}), ...over },
    }));
  const setSub = (section, sub, over) =>
    setKit((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [sub]: { ...(prev[section]?.[sub] || {}), ...over },
      },
    }));

  /** Social rows are edited as a list, so always rebuild from the newest state. */
  const updateSocial = (transform) =>
    setKit((prev) => {
      const rows = Array.isArray(prev.footer?.social) ? prev.footer.social : [];
      return {
        ...prev,
        footer: { ...(prev.footer || {}), social: transform(rows) },
      };
    });

  /** Put one or more blocks of the form back to their saved values. */
  const resetSection = (...sections) => {
    if (!saved) return;
    setKit((prev) => {
      const next = { ...prev };
      for (const section of sections.flat()) {
        next[section] = clone(saved[section] ?? prev[section]);
      }
      return next;
    });
    toast.success("That part is back to its saved values.");
  };

  const resetContentArea = () => {
    if (!saved) return;
    setKit((prev) => ({
      ...prev,
      content: {
        ...(prev.content || {}),
        background: clone(saved.content?.background ?? prev.content?.background),
        decoration: saved.content?.decoration ?? prev.content?.decoration,
        decorationColor:
          saved.content?.decorationColor ?? prev.content?.decorationColor,
        watermark: clone(saved.content?.watermark ?? prev.content?.watermark),
        defaultImageUrl:
          saved.content?.defaultImageUrl ?? prev.content?.defaultImageUrl,
      },
    }));
    toast.success("Area behind poster text is back to saved values.");
  };

  const resetInfoCard = () => {
    if (!saved) return;
    setKit((prev) => ({
      ...prev,
      content: {
        ...(prev.content || {}),
        infoCard: clone(saved.content?.infoCard ?? prev.content?.infoCard),
      },
    }));
    toast.success("Cards for date, time and place are back to saved values.");
  };

  const resetFontsAndSizes = () => {
    if (!saved) return;
    setKit((prev) => ({
      ...prev,
      textStyle: clone(saved.textStyle ?? prev.textStyle),
      defaultPosterSize: clone(
        saved.defaultPosterSize ?? prev.defaultPosterSize,
      ),
      content: {
        ...(prev.content || {}),
        headingFont: saved.content?.headingFont ?? prev.content?.headingFont,
        bodyFont: saved.content?.bodyFont ?? prev.content?.bodyFont,
        headingColor: saved.content?.headingColor ?? prev.content?.headingColor,
        bodyColor: saved.content?.bodyColor ?? prev.content?.bodyColor,
        accentColor: saved.content?.accentColor ?? prev.content?.accentColor,
      },
    }));
    toast.success("Fonts and sizes are back to saved values.");
  };

  const buildPayload = (source) => {
    const rows = Array.isArray(source.footer?.social)
      ? source.footer.social
      : [];
    return {
      orgName: String(source.orgName || "").trim(),
      logos: Array.isArray(source.logos) ? source.logos : [],
      colors: source.colors,
      fonts: source.fonts,
      preset: source.preset,
      textStyle: source.textStyle,
      header: source.header,
      content: source.content,
      footer: {
        ...source.footer,
        social: rows
          .filter((row) => String(row?.url || "").trim() !== "")
          .map((row) => ({
            platform: row.platform,
            url: String(row.url).trim(),
          })),
      },
      defaultPosterSize: source.defaultPosterSize,
    };
  };

  const handleSave = async () => {
    if (!kit) return;
    const name = String(kit.orgName || "").trim();
    if (!name) {
      setSaveError("Add the organization name before saving.");
      return;
    }
    const email = String(kit.footer?.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setSaveError(
        "That email address looks incomplete. Write it like name@organization.com",
      );
      return;
    }
    const badSocial = (
      Array.isArray(kit.footer?.social) ? kit.footer.social : []
    ).some(
      (row) =>
        String(row?.url || "").trim() !== "" &&
        !/^https:\/\//i.test(String(row.url).trim()),
    );
    if (badSocial) {
      setSaveError(
        "Social links must start with https:// — for example https://instagram.com/yourname",
      );
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await api.put("/brand-kit", buildPayload(kit));
      if (!response.data?.success)
        throw new Error(response.data?.error?.message || "");
      const returned = response.data.data.brandKit;
      setKit(returned);
      setSaved(clone(returned));
      setLoadNote("");
      toast.success("Brand kit saved.");
    } catch (err) {
      setSaveError(
        friendlyError(
          err,
          "The brand kit could not be saved. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!dirty || !saved) return;
    if (!window.confirm("Discard your unsaved changes to the brand kit?"))
      return;
    setKit(clone(saved));
    setSaveError("");
    toast.success("Changes discarded.");
  };

  const applyPreset = (presetId) => {
    setKit((prev) => applyBrandPreset(prev, presetId));
    setPendingPreset(null);
    toast.success("Preset applied. Everything below is still editable.");
  };

  if (loading || !kit || !resolved) {
    return (
      <div className="container-page section-pad">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-4">
            <div className="h-7 w-44 rounded bg-section animate-pulse" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="card-surface p-5 space-y-3">
                <div className="h-3.5 w-32 rounded bg-section animate-pulse" />
                <div className="h-9 w-full rounded bg-preview animate-pulse" />
                <div className="h-9 w-2/3 rounded bg-preview animate-pulse" />
              </div>
            ))}
          </div>
          <div className="hidden lg:block lg:col-span-6">
            <div className="card-surface p-4">
              <div
                className="w-full rounded-card bg-preview animate-pulse"
                style={{ aspectRatio: "4 / 5" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const header = kit.header || {};
  const content = kit.content || {};
  const footer = kit.footer || {};
  const colors = kit.colors || {};
  const social = Array.isArray(footer.social) ? footer.social : [];
  const logoUrl = primaryLogoUrl(kit);
  const posterName = header.orgName?.text || kit.orgName || "Organization name";

  const renderSimple = () => (
    <div className="space-y-4">
      <SectionCard
        title="Style presets"
        desc="A starting point you can then fine-tune. Your name, logo, photos and contact details are never replaced."
        icon={Wand2}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BRAND_PRESET_LIST.map((preset) => (
            <div
              key={preset.id}
              className="rounded-btn border border-line bg-section p-3 space-y-2.5"
            >
              <div className="flex items-center gap-1.5">
                {preset.swatch.map((color) => (
                  <span
                    key={color}
                    className="w-5 h-5 rounded-chip border border-line"
                    style={{ background: color }}
                  />
                ))}
                <p className="text-xs font-semibold text-heading ml-1">
                  {preset.label}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug min-h-[44px]">
                {preset.blurb}
              </p>
              {pendingPreset === preset.id ? (
                <div className="space-y-2 rounded-btn border border-primary-ring bg-canvas p-2.5">
                  <p className="text-[11px] text-heading leading-snug">
                    Apply this preset to the form? Your current styling is
                    replaced, nothing is saved yet.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs py-1.5 px-3"
                      onClick={() => applyPreset(preset.id)}
                    >
                      Apply preset
                    </button>
                    <button
                      type="button"
                      className="btn-ghost border border-line text-xs py-1.5 px-3"
                      onClick={() => setPendingPreset(null)}
                    >
                      Keep mine
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-ghost border border-line text-xs py-1.5 px-3"
                  onClick={() => setPendingPreset(preset.id)}
                >
                  <Wand2 size={13} />
                  <span>Use this preset</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Organization identity"
        desc="The name and mark that appear on every poster this organization creates."
        icon={Building2}
        onReset={() => resetSection(["orgName", "logos"])}
      >
        <TextInput
          id="orgName"
          label="Organization name"
          value={kit.orgName}
          maxLength={100}
          placeholder="e.g. Northbridge Foundation"
          onChange={(next) => setTop({ orgName: next })}
        />
        <BrandImageField
          label="Upload logo"
          kind="logo"
          value={logoUrl}
          boxClass="h-32"
          onChange={(url) =>
            setTop({
              logos: url
                ? [{ url, label: "Primary logo", isPrimary: true }]
                : [],
            })
          }
          hint="A transparent PNG works best. It is used in the header and, if you switch it on, as a faint watermark."
        />
      </SectionCard>

      <SectionCard
        title="Brand colors"
        desc="These five colors drive the poster palette. Unreadable combinations are lifted automatically."
        icon={Palette}
        onReset={() => resetSection("colors")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorInput
            label="Primary"
            value={colors.primary}
            onChange={(next) => setSection("colors", { primary: next })}
          />
          <ColorInput
            label="Accent"
            value={colors.accent}
            onChange={(next) => setSection("colors", { accent: next })}
          />
          <ColorInput
            label="Dark / Secondary"
            value={colors.secondary}
            onChange={(next) => setSection("colors", { secondary: next })}
          />
          <ColorInput
            label="Text"
            value={colors.text}
            onSurface={resolved.canvas.color}
            onChange={(next) => setSection("colors", { text: next })}
          />
          <ColorInput
            label="Poster background"
            value={colors.background}
            onChange={(next) => setSection("colors", { background: next })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Fonts"
        desc="Only fonts that load over the internet are offered."
        icon={Sparkles}
        onReset={() => resetSection("fonts")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Headline font"
            value={kit.fonts?.heading || "Outfit"}
            options={FONT_OPTIONS}
            onChange={(next) => setSection("fonts", { heading: next })}
          />
          <Select
            label="Body font"
            value={kit.fonts?.body || "Inter"}
            options={FONT_OPTIONS}
            onChange={(next) => setSection("fonts", { body: next })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Header text"
        desc="What appears in the header at the top of every poster."
        icon={PanelTop}
        onReset={() => resetSection("header")}
      >
        <Toggle
          label="Show the logo"
          checked={header.logo?.show !== false}
          onChange={(next) => setSub("header", "logo", { show: next })}
        />
        <Toggle
          label="Show the organization name"
          checked={header.orgName?.show !== false}
          onChange={(next) => setSub("header", "orgName", { show: next })}
        />
        <TextInput
          id="headerName"
          label="Name printed at the top of the poster"
          value={header.orgName?.text ?? ""}
          maxLength={100}
          placeholder={kit.orgName || "Organization name"}
          hint="Usually the organization name. Use a shorter form if the full name is long."
          onChange={(next) => setSub("header", "orgName", { text: next })}
        />
        <Toggle
          label="Show a tagline under the name"
          checked={Boolean(header.tagline?.show)}
          onChange={(next) => setSub("header", "tagline", { show: next })}
        />
        {header.tagline?.show && (
          <TextInput
            id="tagline"
            label="Tagline"
            value={header.tagline?.text ?? ""}
            maxLength={80}
            placeholder="e.g. Serving the community since 1998"
            onChange={(next) => setSub("header", "tagline", { text: next })}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Contact details"
        desc="Only what you fill in is printed on the poster footer. Empty lines are left out."
        icon={Link2}
        onReset={() => resetSection("footer")}
      >
        <TextInput
          id="address"
          label="Address"
          value={footer.address ?? ""}
          maxLength={120}
          placeholder="e.g. 12 Harbour Square, Bristol"
          onChange={(next) => setSection("footer", { address: next })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput
            id="phone"
            label="Phone"
            value={footer.phone ?? ""}
            maxLength={40}
            placeholder="e.g. +44 20 7946 0102"
            onChange={(next) => setSection("footer", { phone: next })}
          />
          <TextInput
            id="email"
            type="email"
            label="Email"
            value={footer.email ?? ""}
            maxLength={120}
            placeholder="hello@organization.com"
            onChange={(next) => setSection("footer", { email: next })}
          />
        </div>
        <TextInput
          id="website"
          label="Website"
          value={footer.website ?? ""}
          maxLength={120}
          placeholder="e.g. organization.com"
          onChange={(next) => setSection("footer", { website: next })}
        />
        <div className="pt-2 space-y-2 border-t border-line">
          <label className="text-xs font-semibold text-heading block">
            Social profiles ({social.length} of 6)
          </label>
          {social.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="w-[132px] shrink-0">
                <Select
                  label={index === 0 ? "Network" : undefined}
                  value={row.platform || "facebook"}
                  options={SOCIAL_OPTIONS.map((item) => ({
                    value: item,
                    label: socialLabel(item),
                  }))}
                  onChange={(next) =>
                    updateSocial((rows) =>
                      rows.map((item, at) =>
                        at === index ? { ...item, platform: next } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <TextInput
                  label={index === 0 ? "Profile link" : undefined}
                  type="url"
                  value={row.url ?? ""}
                  maxLength={300}
                  placeholder="https://..."
                  onChange={(next) =>
                    updateSocial((rows) =>
                      rows.map((item, at) =>
                        at === index ? { ...item, url: next } : item,
                      ),
                    )
                  }
                />
              </div>
              <button
                type="button"
                aria-label="Remove this social link"
                onClick={() =>
                  updateSocial((rows) => rows.filter((_, at) => at !== index))
                }
                className="btn-ghost border border-line shrink-0 py-2 px-2.5 mb-0.5"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {social.length < 6 && (
            <button
              type="button"
              onClick={() =>
                updateSocial((rows) => [
                  ...rows,
                  { platform: "facebook", url: "" },
                ])
              }
              className="btn-ghost border border-dashed border-line text-xs"
            >
              <Plus size={14} />
              <span>Add social link</span>
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderAdvanced = () => (
    <div className="space-y-4">
      <CollapsibleSection
        title="Header"
        desc="Printed at the top of every poster."
        usedByText={formatUsedBy(templateCounts.header)}
        icon={PanelTop}
        defaultOpen={true}
        onReset={() => resetSection("header")}
      >
        <SliderNumber
          label="Header height"
          value={header.height ?? LIMITS.headerHeight.min}
          onChange={(next) => setSection("header", { height: next })}
          min={LIMITS.headerHeight.min}
          max={LIMITS.headerHeight.max}
          step={LIMITS.headerHeight.step}
          unit="px"
        />
        <Segmented
          label="Alignment"
          value={header.alignment || "left"}
          onChange={(next) => setSection("header", { alignment: next })}
          options={["left", "center", "right"]}
        />
        <SliderNumber
          label="Logo size"
          value={header.logo?.size ?? LIMITS.logoSize.min}
          onChange={(next) => setSub("header", "logo", { size: next })}
          min={LIMITS.logoSize.min}
          max={LIMITS.logoSize.max}
          step={LIMITS.logoSize.step}
          unit="px"
          hint="The logo shrinks automatically if the header is too short for it."
        />
        <Segmented
          label="Logo position"
          value={header.logo?.position || "left"}
          onChange={(next) => setSub("header", "logo", { position: next })}
          options={["left", "top", "bottom", "right"]}
        />
        <BackgroundEditor
          label="Header background"
          value={header.background}
          types={["color", "gradient", "image"]}
          uploadKind="header"
          uploadLabel="Upload header image"
          onChange={(next) => setSection("header", { background: next })}
          hint="The name and tagline are always re-colored so they stay readable on top of this."
        />
        <TextStyleEditor
          label="Organization name style"
          value={header.orgName?.style}
          onSurface={resolved.header.surface}
          sample={posterName}
          onChange={(next) => setSub("header", "orgName", { style: next })}
        />
        <TextStyleEditor
          label="Tagline style"
          value={header.tagline?.style}
          onSurface={resolved.header.surface}
          sample={header.tagline?.text || "Tagline appears like this"}
          onChange={(next) => setSub("header", "tagline", { style: next })}
        />
        <div className="space-y-3 rounded-btn border border-line bg-section p-3">
          <Toggle
            label="Show a line under the header"
            checked={Boolean(header.border?.show)}
            onChange={(next) => setSub("header", "border", { show: next })}
          />
          {header.border?.show && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <ColorInput
                label="Line color"
                value={header.border?.color}
                onChange={(next) => setSub("header", "border", { color: next })}
              />
              <SliderNumber
                label="Line thickness"
                value={header.border?.thickness ?? 2}
                onChange={(next) =>
                  setSub("header", "border", { thickness: next })
                }
                min={LIMITS.borderThickness.min}
                max={LIMITS.borderThickness.max}
                step={LIMITS.borderThickness.step}
                unit="px"
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Area behind the poster text"
        desc="Fills the center of the poster behind the headline and details."
        usedByText={formatUsedBy(templateCounts.background)}
        icon={ImageIcon}
        onReset={resetContentArea}
      >
        <BackgroundEditor
          label="Fill"
          value={content.background}
          types={["color", "gradient", "image", "pattern"]}
          uploadKind="content"
          uploadLabel="Upload background image"
          onChange={(next) => setSection("content", { background: next })}
        />
        <Segmented
          label="Decoration"
          value={content.decoration || "none"}
          onChange={(next) => setSection("content", { decoration: next })}
          options={[
            { value: "none", label: "None" },
            { value: "band", label: "Band" },
            { value: "circle", label: "Circle" },
            { value: "corners", label: "Corners" },
          ]}
        />
        {content.decoration !== "none" && (
          <ColorInput
            label="Decoration color"
            value={content.decorationColor}
            onChange={(next) =>
              setSection("content", { decorationColor: next })
            }
            onSurface={resolved.content.surface}
          />
        )}
        <div className="space-y-3 rounded-btn border border-line bg-section p-3">
          <Toggle
            label="Show a faint logo watermark"
            checked={Boolean(content.watermark?.show)}
            hint="Needs a logo under Identity and logo."
            onChange={(next) =>
              setSub("content", "watermark", { show: next })
            }
          />
          {content.watermark?.show && (
            <SliderNumber
              label="Watermark strength"
              value={
                content.watermark?.opacity ?? LIMITS.watermarkOpacity.min
              }
              onChange={(next) =>
                setSub("content", "watermark", { opacity: next })
              }
              min={LIMITS.watermarkOpacity.min}
              max={LIMITS.watermarkOpacity.max}
              step={LIMITS.watermarkOpacity.step}
            />
          )}
        </div>
        <BrandImageField
          label="Upload default photo"
          kind="default"
          value={content.defaultImageUrl || ""}
          boxClass="h-40"
          onChange={(url) =>
            setSection("content", { defaultImageUrl: url })
          }
          hint="Used whenever a poster is created without a photo."
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Cards for date, time and place"
        desc="The detail boxes in the middle of event and notice posters."
        usedByText={formatUsedBy(templateCounts.infoCard)}
        icon={Layout}
        onReset={resetInfoCard}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorInput
            label="Card background"
            value={content.infoCard?.background}
            onChange={(next) =>
              setSub("content", "infoCard", { background: next })
            }
          />
          <ColorInput
            label="Card border"
            value={content.infoCard?.border}
            onChange={(next) =>
              setSub("content", "infoCard", { border: next })
            }
          />
          <ColorInput
            label="Icon color"
            value={content.infoCard?.iconColor}
            onChange={(next) =>
              setSub("content", "infoCard", { iconColor: next })
            }
            onSurface={content.infoCard?.background}
          />
          <SliderNumber
            label="Corner roundness"
            value={content.infoCard?.radius ?? 0}
            onChange={(next) =>
              setSub("content", "infoCard", { radius: next })
            }
            min={LIMITS.cardRadius.min}
            max={LIMITS.cardRadius.max}
            step={LIMITS.cardRadius.step}
            unit="px"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Footer"
        desc="Printed across the bottom of every poster."
        usedByText={formatUsedBy(templateCounts.footer)}
        icon={PanelBottom}
        onReset={() => resetSection("footer")}
      >
        <SliderNumber
          label="Footer height"
          value={footer.height ?? LIMITS.footerHeight.min}
          onChange={(next) => setSection("footer", { height: next })}
          min={LIMITS.footerHeight.min}
          max={LIMITS.footerHeight.max}
          step={LIMITS.footerHeight.step}
          unit="px"
        />
        <Segmented
          label="Columns"
          value={Number(footer.layout) || 2}
          onChange={(next) =>
            setSection("footer", { layout: Number(next) })
          }
          options={[
            { value: 1, label: "1" },
            { value: 2, label: "2" },
            { value: 3, label: "3" },
          ]}
          hint="One column stacks the details. Two splits them left and right. Three groups them by kind."
        />
        <BackgroundEditor
          label="Footer background"
          value={footer.background}
          types={["color", "gradient", "image"]}
          uploadKind="footer"
          uploadLabel="Upload footer image"
          onChange={(next) => setSection("footer", { background: next })}
        />
        <TextStyleEditor
          label="Contact text style"
          value={footer.style}
          onSurface={resolved.footer.surface}
          sample={footer.phone || footer.email || "hello@organization.com"}
          onChange={(next) => setSection("footer", { style: next })}
        />
        <ColorInput
          label="Website and social color"
          value={footer.linkColor}
          onSurface={resolved.footer.surface}
          onChange={(next) => setSection("footer", { linkColor: next })}
        />
        <TextInput
          id="legal"
          label="Fine print"
          value={footer.legalText ?? ""}
          maxLength={160}
          placeholder="e.g. © 2026 Northbridge Foundation. Registered charity."
          onChange={(next) => setSection("footer", { legalText: next })}
        />
        <div className="space-y-3 rounded-btn border border-line bg-section p-3">
          <Toggle
            label="Show a line above the footer"
            checked={Boolean(footer.divider?.show)}
            onChange={(next) => setSub("footer", "divider", { show: next })}
          />
          {footer.divider?.show && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <ColorInput
                label="Line color"
                value={footer.divider?.color}
                onChange={(next) =>
                  setSub("footer", "divider", { color: next })
                }
              />
              <SliderNumber
                label="Line thickness"
                value={footer.divider?.thickness ?? 1}
                onChange={(next) =>
                  setSub("footer", "divider", { thickness: next })
                }
                min={LIMITS.dividerThickness.min}
                max={LIMITS.dividerThickness.max}
                step={LIMITS.dividerThickness.step}
                unit="px"
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Fonts and sizes"
        desc="Typography and default dimensions across all poster areas."
        usedByText={formatUsedBy(templateCounts.fonts)}
        icon={Palette}
        onReset={resetFontsAndSizes}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Title font override"
            value={content.headingFont || kit.fonts?.heading || "Outfit"}
            options={FONT_OPTIONS}
            onChange={(next) =>
              setSection("content", { headingFont: next })
            }
          />
          <Select
            label="Details font override"
            value={content.bodyFont || kit.fonts?.body || "Inter"}
            options={FONT_OPTIONS}
            onChange={(next) => setSection("content", { bodyFont: next })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorInput
            label="Title color"
            value={content.headingColor}
            onSurface={resolved.content.surface}
            large
            onChange={(next) =>
              setSection("content", { headingColor: next })
            }
          />
          <ColorInput
            label="Details color"
            value={content.bodyColor}
            onSurface={resolved.content.surface}
            onChange={(next) => setSection("content", { bodyColor: next })}
          />
          <ColorInput
            label="Highlight color"
            value={content.accentColor}
            onSurface={resolved.content.surface}
            onChange={(next) =>
              setSection("content", { accentColor: next })
            }
            hint="Used for the label above the title and detail icons."
          />
        </div>
        <TextStyleEditor
          label="Overall text look"
          value={kit.textStyle}
          onSurface={resolved.content.surface}
          sample={posterName}
          onChange={(next) => setTop({ textStyle: next })}
          columns
        />
        <div className="space-y-2 rounded-btn border border-line bg-section p-3">
          <label className="text-xs font-semibold text-heading block">
            Default poster size
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (px)">
              <input
                type="number"
                min={600}
                max={2400}
                value={kit.defaultPosterSize?.width ?? 1080}
                onChange={(event) =>
                  setTop({
                    defaultPosterSize: {
                      ...kit.defaultPosterSize,
                      width: Number(event.target.value) || 1080,
                    },
                  })
                }
                className="input-field"
              />
            </Field>
            <Field label="Height (px)">
              <input
                type="number"
                min={600}
                max={3200}
                value={kit.defaultPosterSize?.height ?? 1350}
                onChange={(event) =>
                  setTop({
                    defaultPosterSize: {
                      ...kit.defaultPosterSize,
                      height: Number(event.target.value) || 1350,
                    },
                  })
                }
                className="input-field"
              />
            </Field>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Poster creation modes"
        desc="Settings for poster creation and generation modes."
        icon={Sparkles}
      >
        <Suspense
          fallback={
            <div
              className="card-surface p-5 text-sm text-muted-foreground"
              role="status"
            >
              Loading these settings…
            </div>
          }
        >
          <DesignModesCard />
        </Suspense>
      </CollapsibleSection>
    </div>
  );

  return (
    <div className="container-page section-pad">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-heading">
            Brand kit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {kit.orgName || "This organization"} · everything here is locked
            onto every poster, so the assistant only writes the words in the
            middle.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-section rounded-btn border border-line shrink-0">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-btn transition-colors ${
              mode === "simple"
                ? "bg-canvas text-heading shadow-xs"
                : "text-muted-foreground hover:text-heading"
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-btn transition-colors ${
              mode === "advanced"
                ? "bg-canvas text-heading shadow-xs"
                : "text-muted-foreground hover:text-heading"
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-canvas/95 backdrop-blur border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium shrink-0">
              <span className="w-2 h-2 rounded-chip bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span className="w-2 h-2 rounded-chip bg-success" />
              All changes saved
            </span>
          )}
          <span className="text-[11px] text-muted-foreground hidden md:inline truncate">
            Changes apply to new posters. Posters already made keep their design.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!dirty || saving}
            className="btn-ghost border border-line text-xs py-2 px-3 disabled:opacity-50"
          >
            <span>Discard changes</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs py-2 px-3.5"
          >
            <span>{saving ? "Saving…" : "Save brand kit"}</span>
          </button>
        </div>
      </div>

      <div className="md:hidden mt-2 text-[11px] text-muted-foreground px-1">
        Changes apply to new posters. Posters already made keep their design.
      </div>

      {(saveError || loadNote) && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-card border border-line bg-section p-3">
          <p
            className={`text-xs leading-snug ${saveError ? "text-danger" : "text-body"}`}
          >
            {saveError || loadNote}
          </p>
          <button
            type="button"
            aria-label="Dismiss this message"
            className="btn-ghost px-2 py-1 shrink-0"
            onClick={() => {
              setSaveError("");
              setLoadNote("");
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-5">
        <div className="order-2 lg:order-1 lg:col-span-6 space-y-4">
          {mode === "simple" ? renderSimple() : renderAdvanced()}
        </div>

        <div className="order-1 lg:order-2 lg:col-span-6 lg:sticky lg:top-28 space-y-3">
          <button
            type="button"
            onClick={() => setPreviewOpen((open) => !open)}
            className="lg:hidden w-full btn-ghost border border-line text-xs justify-between"
            aria-expanded={previewOpen}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={13} />
              {previewOpen ? "Hide preview" : "Show preview"}
            </span>
            <span className="text-muted-foreground">{posterName}</span>
          </button>

          <div
            className={
              previewOpen ? "space-y-3" : "hidden lg:block lg:space-y-3"
            }
          >
            <div className="card-surface p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-heading">
                    Live preview
                  </p>
                  {templates.length > 0 && (
                    <select
                      value={template?._id || template?.id || ""}
                      onChange={(e) => {
                        const found = templates.find(
                          (t) => (t._id || t.id) === e.target.value,
                        );
                        if (found) setTemplate(found);
                      }}
                      aria-label="Pick preview template"
                      className="text-xs py-1 px-2 rounded-btn border border-line bg-canvas text-heading max-w-[200px] truncate"
                    >
                      {templates.map((t) => (
                        <option key={t._id || t.id} value={t._id || t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-chip bg-section border border-line text-muted-foreground">
                  {template?.size?.width || 1080} ×{" "}
                  {template?.size?.height || 1350}
                </span>
              </div>
              <PosterPreview
                brandKit={kit}
                template={template}
                content={SAMPLE_CONTENT}
                onOverflow={(isOverflow, message) =>
                  setPreviewOverflow(isOverflow ? message : null)
                }
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                Sample words so you can judge the look. Posters your team creates
                carry their own headline and details in the middle.
              </p>
              {previewOverflow && (
                <p className="text-[11px] text-accent leading-snug">
                  The sample text is long for this size — real posters shrink to
                  fit.
                </p>
              )}
            </div>

            <ul className="card-surface p-3 sm:p-4 space-y-2">
              <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Header text on its background
                </span>
                <Readout
                  foreground={resolved.header.orgName.style.color}
                  background={resolved.header.surface}
                />
              </li>
              <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Poster title
                </span>
                <Readout
                  foreground={resolved.content.headingColor}
                  background={resolved.content.surface}
                  large
                />
              </li>
              <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[11px] text-muted-foreground">
                  Footer text on its background
                </span>
                <Readout
                  foreground={resolved.footer.style.color}
                  background={resolved.footer.surface}
                />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
