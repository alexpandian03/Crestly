import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ExternalLink,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import TemplatePreview from "../components/TemplatePreview";
import BrandImageField from "../components/brand/BrandImageField";
import {
  ColorInput,
  FONT_OPTIONS,
  Field,
  SectionCard,
  Select,
  TextInput,
  TextStyleEditor,
  Toggle,
} from "../components/brand/controls";
import {
  BRAND_RENDER_DEFAULTS,
  resolvePosterBrand,
} from "../utils/brandRender";
import { applyBrandPreset, BRAND_PRESET_LIST } from "../utils/brandPresets";
import { friendlyError } from "../utils/brandImage";
import { kitBandIsLaidOut, resetBandPayload } from "../utils/brandBands";
import { contrastLabel, wcagLevel } from "../utils/contrast";
import { resolveTemplateSize, templateIdOf } from "../utils/templateRender";
import { resolveBands } from "../../../shared/templateElements.js";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";

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
      primary: "#2563eb",
      secondary: "#111827",
      accent: "#f59e0b",
      text: "#111827",
      background: "#ffffff",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    defaultPosterSize: { width: 1080, height: 1350 },
  };
}

const primaryLogoUrl = (kit) =>
  kit?.logos?.find((l) => l?.isPrimary)?.url || kit?.logos?.[0]?.url || "";


const TAB_TRIGGER =
  "h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0";

/** How wide a band preview is drawn, in screen pixels. */
const BAND_STRIP_WIDTH = 360;

/** Measured contrast of a colour the poster actually paints. */
function Readout({ foreground, background, large = false }) {
  const level = wcagLevel(foreground, background, { large });
  const isPass = level === "AA" || level === "AAA";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-[#111827]">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isPass ? "bg-[#10B981]" : "bg-[#F59E0B]"
        }`}
      />
      <span>{contrastLabel(foreground, background, { large })}</span>
    </span>
  );
}

/**
 * One band exactly as a poster draws it: the real poster is painted at full width and the strip
 * shows only the band's own part of it, so this preview cannot disagree with the poster.
 */
function BandStrip({ band, brandKit, posterSize, posterTemplate }) {
  const containerRef = useRef(null);
  const [stripWidth, setStripWidth] = useState(BAND_STRIP_WIDTH);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setStripWidth(Math.min(BAND_STRIP_WIDTH, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!band || !posterSize?.width) return null;
  const currentWidth = stripWidth || BAND_STRIP_WIDTH;
  const scale = currentWidth / posterSize.width;
  const stripHeight = Math.max(8, Math.round(band.height * scale));
  return (
    <div ref={containerRef} className="w-full max-w-[360px] overflow-hidden">
      <div
        className="relative overflow-hidden rounded-[6px] border border-[#E5E7EB] bg-white max-w-full"
        style={{ width: `${currentWidth}px`, height: `${stripHeight}px` }}
        aria-hidden="true"
      >
        <div
          className="absolute left-0"
          style={{
            top: `${-(band.y || 0) * scale}px`,
            width: `${currentWidth}px`,
          }}
        >
          <TemplatePreview
            eager
            size={currentWidth}
            brandKit={brandKit}
            template={posterTemplate}
            sample={SAMPLE_CONTENT}
          />
        </div>
      </div>
    </div>
  );
}

function kitForSelection(tpl, base) {
  if (!tpl) return clone(base);
  const tKit = tpl.brandKit || {};
  const merged = {
    ...clone(base || {}),
    ...clone(tKit),
    colors: { ...(base?.colors || {}), ...(tKit.colors || {}) },
    fonts: { ...(base?.fonts || {}), ...(tKit.fonts || {}) },
    textStyle: { ...(base?.textStyle || {}), ...(tKit.textStyle || {}) },
    logos: Array.isArray(tKit.logos) && tKit.logos.length > 0 ? tKit.logos : (base?.logos || []),
    orgName: tKit.orgName || base?.orgName || "",
    content: {
      ...(base?.content || {}),
      ...(tKit.content || {}),
      background:
        tpl.sections?.content?.page?.background ||
        tpl.page?.background ||
        tKit.content?.background ||
        base?.content?.background,
    },
    defaultPosterSize: tpl.size || tKit.defaultPosterSize || base?.defaultPosterSize,
  };
  if (tpl.sections?.header?.elements?.length > 0 || tpl.sections?.header?.mode === 'custom') {
    merged.header = {
      ...(merged.header || {}),
      mode: 'elements',
      height: tpl.sections.header.height ?? merged.header?.height ?? 80,
      background: tpl.sections.header.background || merged.header?.background,
      elements: tpl.sections.header.elements || [],
    };
  }
  if (tpl.sections?.footer?.elements?.length > 0 || tpl.sections?.footer?.mode === 'custom') {
    merged.footer = {
      ...(merged.footer || {}),
      mode: 'elements',
      height: tpl.sections.footer.height ?? merged.footer?.height ?? 70,
      background: tpl.sections.footer.background || merged.footer?.background,
      elements: tpl.sections.footer.elements || [],
    };
  }
  return merged;
}

export default function BrandKit() {
  const navigate = useNavigate();
  const { user, activeClientId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [saveError, setSaveError] = useState("");
  const [kit, setKit] = useState(null);
  const [saved, setSaved] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [template, setTemplate] = useState(FALLBACK_TEMPLATE);
  const [baseKit, setBaseKit] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingPreset, setPendingPreset] = useState(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [previewOverflow, setPreviewOverflow] = useState(null);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const stored = sessionStorage.getItem("brand-kit-tab");
      return stored === "identity" || stored === "colors-fonts" || stored === "bands"
        ? stored
        : "identity";
    } catch {
      return "identity";
    }
  });

  const handleTabChange = (val) => {
    setActiveTab(val);
    try {
      sessionStorage.setItem("brand-kit-tab", val);
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

      setBaseKit(nextKit);
      const list = templatesResult?.data?.data?.templates;
      if (Array.isArray(list) && list.length > 0) {
        setTemplates(list);
        const initial = list.find((t) => t.isActive !== false) || list[0];
        const initialId = templateIdOf(initial);
        setSelectedTemplateId(initialId);
        setTemplate(initial);
        const initialKit = kitForSelection(initial, nextKit);
        setKit(initialKit);
        setSaved(clone(initialKit));
      } else {
        setKit(nextKit);
        setSaved(clone(nextKit));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, user?.clientId]);

  /* All templates from the Templates page are offered for preview and choosing. */
  const previewTemplates = useMemo(() => {
    return templates || [];
  }, [templates]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return (templates || []).find((t) => templateIdOf(t) === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const handleTemplateSelect = (newId) => {
    if (dirty) {
      const curName = selectedTemplate ? selectedTemplate.name : "Organization default";
      if (!window.confirm(`You have unsaved changes for ${curName}. Discard them and switch?`)) {
        return;
      }
    }
    setSelectedTemplateId(newId);
    const nextTemplate = (templates || []).find((t) => templateIdOf(t) === newId) || null;
    setTemplate(nextTemplate || FALLBACK_TEMPLATE);
    const nextKit = kitForSelection(nextTemplate, baseKit);
    setKit(nextKit);
    setSaved(clone(nextKit));
    setSaveError("");
  };

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

  /* Where each band sits and how tall it is on the poster being previewed. */
  const bands = useMemo(
    () => (kit ? resolveBands(kit, template) : null),
    [kit, template],
  );

  const posterSize = useMemo(() => resolveTemplateSize(template), [template]);

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

  /** Write the form to the organization's kit and start again from what comes back. */
  const persist = async (source) => {
    setSaving(true);
    setSaveError("");
    try {
      const response = await api.put("/brand-kit", buildPayload(source));
      if (!response.data?.success)
        throw new Error(response.data?.error?.message || "");
      const returned = response.data.data.brandKit;
      setKit(returned);
      setSaved(clone(returned));
      setLoadNote("");
      toast.success("Brand kit saved.");
      return true;
    } catch (err) {
      setSaveError(
        friendlyError(
          err,
          "The brand kit could not be saved. Please try again.",
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!kit) return;
    const name = String(kit.orgName || "").trim();
    if (!name) {
      setSaveError("Add the organization name before saving.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      if (selectedTemplate) {
        const payload = {
          expectedVersion: selectedTemplate.version,
          brandKit: {
            colors: kit.colors,
            fonts: kit.fonts,
            preset: kit.preset,
            textStyle: kit.textStyle,
            content: kit.content,
            logos: kit.logos,
            orgName: kit.orgName,
            header: kit.header,
            footer: kit.footer,
          },
          sections: {
            ...(selectedTemplate.sections || {}),
            header: kit.header?.elements?.length > 0 ? {
              mode: "custom",
              height: kit.header.height ?? selectedTemplate.sections?.header?.height ?? 80,
              background: kit.header.background ?? selectedTemplate.sections?.header?.background,
              elements: kit.header.elements,
            } : (selectedTemplate.sections?.header || { mode: "brand" }),
            footer: kit.footer?.elements?.length > 0 ? {
              mode: "custom",
              height: kit.footer.height ?? selectedTemplate.sections?.footer?.height ?? 70,
              background: kit.footer.background ?? selectedTemplate.sections?.footer?.background,
              elements: kit.footer.elements,
            } : (selectedTemplate.sections?.footer || { mode: "brand" }),
            content: {
              ...(selectedTemplate.sections?.content || {}),
              page: {
                ...(selectedTemplate.sections?.content?.page || {}),
                background: kit.content?.background ? { ...kit.content.background, mode: "custom" } : selectedTemplate.sections?.content?.page?.background,
              },
              elements: selectedTemplate.sections?.content?.elements || selectedTemplate.elements || [],
            },
          },
          page: {
            ...(selectedTemplate.page || {}),
            background: kit.content?.background ? { ...kit.content.background, mode: "custom" } : selectedTemplate.page?.background,
          },
        };
        const response = await api.patch(`/templates/${templateIdOf(selectedTemplate)}`, payload);
        if (!response.data?.success) throw new Error(response.data?.error?.message || "Failed to save template brand kit");
        const updated = response.data.data.template;
        setTemplates((prev) => prev.map((t) => templateIdOf(t) === templateIdOf(updated) ? updated : t));
        setTemplate(updated);
        setSaved(clone(kit));
        toast.success(`Saved brand kit for ${selectedTemplate.name}.`);
      } else {
        await persist(kit);
      }
    } catch (err) {
      setSaveError(friendlyError(err, "The brand kit could not be saved. Please try again."));
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

  /**
   * One band, put back to being drawn from the logo and contact details. Saved straight away,
   * because the place it was arranged is the header and footer editor, not this form.
   */
  const resetBand = async (kind) => {
    if (!kit) return;
    const label = kind === "header" ? "header" : "footer";
    if (
      !window.confirm(
        `Reset the ${label} to the default from your logo and contact details? The arrangement you made for it will be cleared.`
      )
    )
      return;
    const nextKit = {
      ...kit,
      [kind]: {
        ...(kit[kind] || {}),
        ...resetBandPayload(kit, kind, kit.defaultPosterSize),
      },
    };
    setKit(nextKit);
    const savedOk = await persist(nextKit);
    if (savedOk) toast.success(`Your ${label} is back to its default look.`);
  };

  const applyPreset = (presetId) => {
    setKit((prev) => applyBrandPreset(prev, presetId));
    setPendingPreset(null);
    setPresetsOpen(false);
    toast.success("Preset applied. Everything below is still editable.");
  };

  if (loading || !kit || !resolved || !bands) {
    return (
      <div className="bg-white min-h-[calc(100vh-56px)] w-full max-w-full overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-[6px]" />
            <Skeleton className="h-4 w-full max-w-sm rounded-[6px]" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-6">
              <Skeleton className="h-10 w-full rounded-[6px]" />
              <div className="space-y-4 pt-4">
                <Skeleton className="h-20 w-full rounded-[8px]" />
                <Skeleton className="h-40 w-full rounded-[8px]" />
                <Skeleton className="h-20 w-full rounded-[8px]" />
              </div>
            </div>
            <div className="w-full">
              <Skeleton className="h-[460px] w-full rounded-[8px]" />
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
  const logoUrl = primaryLogoUrl(kit);
  const posterName = header.orgName?.text || kit.orgName || "Organization name";

  const bandCards = [
    {
      kind: "header",
      title: "Header",
      desc: "The top of every poster: your logo, your name and anything else you place there.",
      plain: kitBandIsLaidOut(kit, "header")
        ? "This header is arranged by hand. Move its parts in the header editor."
        : "This header is drawn from your logo and name. Edit it to place its parts yourself.",
    },
    {
      kind: "footer",
      title: "Footer",
      desc: "The bottom of every poster: your contact details and anything else you place there.",
      plain: kitBandIsLaidOut(kit, "footer")
        ? "This footer is arranged by hand. Move its parts in the footer editor."
        : "This footer is drawn from your contact details. Edit it to place its parts yourself.",
    },
  ];

  return (
    <div className="bg-white min-h-[calc(100vh-56px)] w-full max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-3 sm:px-6 py-3 w-full max-w-full">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] sm:text-[24px] font-semibold text-[#111827] leading-tight">
              Brand kit
            </h1>
            {selectedTemplate ? (
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5 truncate">
                Customizing brand kit for <strong className="text-[#111827] font-semibold">{selectedTemplate.name}</strong>.
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5 truncate">
                {kit.orgName || "This organization"} · organization default locked onto posters
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#F59E0B] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                Unsaved changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                All changes saved
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                disabled={!dirty || saving}
                className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Discard
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 sm:h-9 px-3 sm:px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none disabled:opacity-50 truncate max-w-[200px] sm:max-w-none"
              >
                {saving ? "Saving…" : selectedTemplate ? `Save for ${selectedTemplate.name}` : "Save brand kit"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-6 w-full min-w-0">
        {(saveError || loadNote) && (
          <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3">
            <p
              className={`text-xs leading-snug ${saveError ? "text-[#DC2626]" : "text-[#4B5563]"}`}
            >
              {saveError || loadNote}
            </p>
            <button
              type="button"
              aria-label="Dismiss this message"
              className="text-[#9CA3AF] hover:text-[#111827] p-0.5 shrink-0"
              onClick={() => {
                setSaveError("");
                setLoadNote("");
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full flex flex-col gap-6"
        >
          <div className="w-full border-b border-[#E5E7EB] overflow-x-auto">
            <TabsList
              variant="line"
              className="h-10 p-0 gap-6 bg-transparent flex justify-start min-w-max border-b-0 whitespace-nowrap"
            >
              <TabsTrigger value="identity" className={TAB_TRIGGER}>
                Identity
              </TabsTrigger>
              <TabsTrigger value="colors-fonts" className={TAB_TRIGGER}>
                Colours and fonts
              </TabsTrigger>
              <TabsTrigger value="bands" className={TAB_TRIGGER}>
                Header and footer
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-8">
              {/* Tab 1: Identity and contact */}
              <TabsContent
                value="identity"
                className="mt-0 outline-none space-y-8"
              >
                <SectionCard
                  title="Organization identity"
                  desc="The name and mark that appear on every poster this organization creates."
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
                    hint="A transparent PNG works best. It is used at the top of every poster and, if you switch it on, as a faint watermark."
                  />
                </SectionCard>

                <SectionCard
                  title="Photo and poster size"
                  desc="The photo a poster uses when nobody chooses one, and the size new posters start at."
                  onReset={() =>
                    setTop({
                      defaultPosterSize: clone(
                        saved?.defaultPosterSize ?? { width: 1080, height: 1350 },
                      ),
                    })
                  }
                >
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
                  <BrandImageField
                    label="Whole poster background photo"
                    kind="content"
                    value={content.background?.imageUrl || ""}
                    boxClass="h-40"
                    onChange={(url) =>
                      setSub("content", "background", {
                        imageUrl: url,
                        type: url
                          ? "image"
                          : content.background?.type === "image"
                          ? "color"
                          : content.background?.type || "color",
                      })
                    }
                    hint="A background image that covers the entire poster from top to bottom, including header, content area, and footer."
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Width (px)">
                      <Input
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
                        className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827]"
                      />
                    </Field>
                    <Field label="Height (px)">
                      <Input
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
                        className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827]"
                      />
                    </Field>
                  </div>
                </SectionCard>
              </TabsContent>

              {/* Tab 2: Colours and fonts */}
              <TabsContent
                value="colors-fonts"
                className="mt-0 outline-none space-y-8"
              >
                <SectionCard
                  title="Start from a preset"
                  desc="A ready-made colour and font combination you can then fine-tune. Your name, logo, photos and contact details are never replaced."
                >
                  {presetsOpen ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {BRAND_PRESET_LIST.map((preset) => (
                          <div
                            key={preset.id}
                            className="rounded-[8px] border border-[#E5E7EB] bg-white p-3.5 space-y-2.5 transition-colors hover:border-[#D1D5DB]"
                          >
                            <div className="flex items-center gap-1.5">
                              {preset.swatch.map((color) => (
                                <span
                                  key={color}
                                  className="w-4 h-4 rounded-[3px] border border-[#E5E7EB]"
                                  style={{ background: color }}
                                />
                              ))}
                              <p className="text-xs font-semibold text-[#111827] ml-1">
                                {preset.label}
                              </p>
                            </div>
                            <p className="text-xs text-[#6B7280] leading-snug min-h-[36px]">
                              {preset.blurb}
                            </p>
                            {pendingPreset === preset.id ? (
                              <div className="space-y-2 rounded-[6px] border border-[#2563EB]/30 bg-[#EFF6FF] p-2.5">
                                <p className="text-xs text-[#111827] leading-snug">
                                  Apply this preset to the form? Your current
                                  styling is replaced, nothing is saved yet.
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none"
                                    onClick={() => applyPreset(preset.id)}
                                  >
                                    Apply preset
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
                                    onClick={() => setPendingPreset(null)}
                                  >
                                    Keep mine
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] gap-1.5"
                                onClick={() => setPendingPreset(preset.id)}
                              >
                                <Wand2 size={12} />
                                <span>Use this preset</span>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs font-medium text-[#6B7280] hover:text-[#111827]"
                        onClick={() => {
                          setPresetsOpen(false);
                          setPendingPreset(null);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPresetsOpen(true)}
                      className="h-9 gap-1.5 border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      <Wand2 size={14} />
                      <span>Start from a preset</span>
                    </Button>
                  )}
                </SectionCard>

                <SectionCard
                  title="Brand colours"
                  desc="These five colours drive the poster palette. Unreadable combinations are lifted automatically."
                  onReset={() => resetSection("colors")}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="col-span-2 pt-2 border-t border-[#E5E7EB]">
                      <BrandImageField
                        label="Whole poster background photo"
                        kind="content"
                        value={content.background?.imageUrl || ""}
                        boxClass="h-32"
                        onChange={(url) =>
                          setSub("content", "background", {
                            imageUrl: url,
                            type: url
                              ? "image"
                              : content.background?.type === "image"
                              ? "color"
                              : content.background?.type || "color",
                          })
                        }
                        hint="A background image that covers the entire poster from top to bottom, including header, content area, and footer."
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Brand fonts"
                  desc="Headline and body fonts used across posters."
                  onReset={() => resetSection("fonts")}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                  title="Words in the middle of the poster"
                  desc="The fonts and colours for the headline and details the assistant writes."
                  onReset={resetFontsAndSizes}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                </SectionCard>
              </TabsContent>

              {/* Tab 3: Header and footer */}
              <TabsContent value="bands" className="mt-0 outline-none space-y-8">
                {bandCards.map((card) => (
                  <SectionCard
                    key={card.kind}
                    title={card.title}
                    desc={card.desc}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#6B7280]">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            kitBandIsLaidOut(kit, card.kind)
                              ? "border-[#2563EB]/30 bg-[#EFF6FF] text-[#1D4ED8]"
                              : "border-[#E5E7EB] bg-[#FAFAFA] text-[#4B5563]"
                          }`}
                        >
                          {kitBandIsLaidOut(kit, card.kind)
                            ? "Customized"
                            : "Default"}
                        </span>
                      </div>

                      <BandStrip
                        band={bands[card.kind]}
                        brandKit={kit}
                        posterSize={posterSize}
                        posterTemplate={template}
                      />

                      <BrandImageField
                        label={`${card.title} background photo`}
                        kind={card.kind}
                        value={kit[card.kind]?.background?.imageUrl || ""}
                        boxClass="h-28"
                        onChange={(url) =>
                          setSub(card.kind, "background", {
                            imageUrl: url,
                            type: url
                              ? "image"
                              : kit[card.kind]?.background?.type === "image"
                              ? "color"
                              : kit[card.kind]?.background?.type || "color",
                          })
                        }
                        hint={`A background image that sits behind the ${card.kind} band on every poster.`}
                      />

                      <p className="text-xs text-[#6B7280] leading-snug">
                        {card.plain}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            navigate(
                              selectedTemplate
                                ? `/templates/${templateIdOf(selectedTemplate)}/edit?section=${card.kind}`
                                : `/brand-layer/edit?section=${card.kind}`
                            )
                          }
                          disabled={dirty || saving}
                          className="h-9 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none disabled:opacity-50"
                        >
                          {card.kind === "header"
                            ? "Edit header"
                            : "Edit footer"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => resetBand(card.kind)}
                          disabled={!kitBandIsLaidOut(kit, card.kind) || saving}
                          className="h-9 px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
                        >
                          Reset to the default from my logo and contact details
                        </Button>
                      </div>

                      {dirty && (
                        <p className="text-[11px] text-[#F59E0B] leading-snug">
                          Save your brand kit first, so the editor starts from
                          what you have here.
                        </p>
                      )}
                    </div>
                  </SectionCard>
                ))}
              </TabsContent>
            </div>

            {/* Right column: live preview */}
            <div className="w-full lg:sticky lg:top-24 self-start space-y-4">
              <div className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#111827]">
                      Live preview
                    </p>
                    {previewTemplates.length > 0 && (
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        aria-label="Choose template to customize brand kit"
                        className="text-xs py-1 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-[#111827] max-w-[170px] truncate outline-none focus:border-[#2563EB]"
                      >
                        <option value="">Organization default</option>
                        {previewTemplates.map((t) => (
                          <option
                            key={templateIdOf(t) || t.name}
                            value={templateIdOf(t) || ""}
                          >
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedTemplate && templateIdOf(selectedTemplate) ? (
                      <a
                        href={`/templates/${templateIdOf(selectedTemplate)}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:underline"
                      >
                        <span>Edit</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-[#6B7280] font-medium">
                    {template?.size?.width || 1080} ×{" "}
                    {template?.size?.height || 1350}
                  </span>
                </div>

                <p className="text-[11px] text-[#6B7280]">
                  {selectedTemplate
                    ? `Editing brand kit for ${selectedTemplate.name}. Changes saved here apply only to this template.`
                    : "Editing organization default brand kit."}
                </p>

                <TemplatePreview
                  eager
                  brandKit={kit}
                  template={template}
                  sample={SAMPLE_CONTENT}
                  onOverflow={(isOverflow, message) =>
                    setPreviewOverflow(isOverflow ? message : null)
                  }
                />

                <p className="text-[11px] text-[#6B7280] leading-snug">
                  Sample words so you can judge the look. Posters your team
                  creates carry their own headline and details in the middle.
                </p>
                {previewOverflow && (
                  <p className="text-[11px] text-[#F59E0B] leading-snug">
                    The sample text is long for this size — real posters shrink
                    to fit.
                  </p>
                )}
              </div>

              <ul className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 space-y-2">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#6B7280]">
                    Header text on its background
                  </span>
                  <Readout
                    foreground={resolved.header.orgName.style.color}
                    background={resolved.header.surface}
                  />
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#6B7280]">Poster title</span>
                  <Readout
                    foreground={resolved.content.headingColor}
                    background={resolved.content.surface}
                    large
                  />
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#6B7280]">
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
        </Tabs>
      </div>
    </div>
  );
}
