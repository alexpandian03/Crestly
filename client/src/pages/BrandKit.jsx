import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ExternalLink,
  Plus,
  Trash2,
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
import { templateIdOf } from "../utils/templateRender";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";

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
      primary: "#2563eb",
      secondary: "#111827",
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
  const [pendingPreset, setPendingPreset] = useState(null);
  const [previewOverflow, setPreviewOverflow] = useState(null);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      return sessionStorage.getItem("brand-kit-tab") || "identity";
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

      const list = templatesResult?.data?.data?.templates;
      if (Array.isArray(list) && list.length > 0) {
        setTemplates(list);
        /* The preview opens on a layout the team can actually use. */
        setTemplate(list.find((t) => t.isActive !== false) || list[0]);
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

  /* Only the layouts a team can actually use are offered for the preview. */
  const previewTemplates = useMemo(() => {
    const active = templates.filter((t) => t.isActive !== false);
    return active.length > 0 ? active : templates;
  }, [templates]);

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
      <div className="bg-white min-h-[calc(100vh-56px)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-[6px]" />
            <Skeleton className="h-4 w-96 rounded-[6px]" />
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
  const social = Array.isArray(footer.social) ? footer.social : [];
  const logoUrl = primaryLogoUrl(kit);
  const posterName = header.orgName?.text || kit.orgName || "Organization name";

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      {/* 1. Page Header (stays as is) */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              Brand kit
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
              {kit.orgName || "This organization"} · everything here is locked onto every poster, so the assistant only writes the words in the middle.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
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
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscard}
              disabled={!dirty || saving}
              className="h-9 px-3 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              Discard changes
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save brand kit"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
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

        {/* 4. Tabs root wraps BOTH TabsList and the two-column grid */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full flex flex-col gap-6"
        >
          {/* 2. ONE full-width horizontal tab row (underline style) */}
          <div className="w-full border-b border-[#E5E7EB] overflow-x-auto">
            <TabsList
              variant="line"
              className="h-10 p-0 gap-6 bg-transparent flex justify-start min-w-max border-b-0 whitespace-nowrap"
            >
              <TabsTrigger
                value="identity"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Identity and logo
              </TabsTrigger>
              <TabsTrigger
                value="header"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Header
              </TabsTrigger>
              <TabsTrigger
                value="background"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Poster background
              </TabsTrigger>
              <TabsTrigger
                value="footer"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Footer
              </TabsTrigger>
              <TabsTrigger
                value="colors-fonts"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Colors and fonts
              </TabsTrigger>
              <TabsTrigger
                value="presets"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Presets
              </TabsTrigger>
              <TabsTrigger
                value="design"
                className="h-10 px-0 pb-3 text-sm font-medium text-[#6B7280] hover:text-[#111827] border-b-2 border-transparent data-[state=active]:border-[#2563EB] data-[state=active]:text-[#111827] rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors shrink-0"
              >
                Poster design
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 3. Below the tab row, a two-column grid ONLY for content */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Left column (min-w-0, space-y-8): TabsContent for active tab */}
            <div className="min-w-0 space-y-8">
              {/* Tab 1: Identity and logo */}
              <TabsContent value="identity" className="mt-0 outline-none space-y-8">
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
                    hint="A transparent PNG works best. It is used in the header and, if you switch it on, as a faint watermark."
                  />
                </SectionCard>
              </TabsContent>

              {/* Tab 2: Header */}
              <TabsContent value="header" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Header text"
                  desc="What appears in the header at the top of every poster."
                  onReset={() => resetSection("header")}
                >
                  <div className="space-y-3">
                    <Toggle
                      label="Show the logo"
                      checked={header.logo?.show !== false}
                      onChange={(next) => setSub("header", "logo", { show: next })}
                    />
                    <Toggle
                      label="Show the organization name"
                      checked={header.orgName?.show !== false}
                      onChange={(next) =>
                        setSub("header", "orgName", { show: next })
                      }
                    />
                    <TextInput
                      id="headerName"
                      label="Name printed at the top of the poster"
                      value={header.orgName?.text ?? ""}
                      maxLength={100}
                      placeholder={kit.orgName || "Organization name"}
                      hint="Usually the organization name. Use a shorter form if the full name is long."
                      onChange={(next) =>
                        setSub("header", "orgName", { text: next })
                      }
                    />
                    <Toggle
                      label="Show a tagline under the name"
                      checked={Boolean(header.tagline?.show)}
                      onChange={(next) =>
                        setSub("header", "tagline", { show: next })
                      }
                    />
                    {header.tagline?.show && (
                      <TextInput
                        id="tagline"
                        label="Tagline"
                        value={header.tagline?.text ?? ""}
                        maxLength={80}
                        placeholder="e.g. Serving the community since 1998"
                        onChange={(next) =>
                          setSub("header", "tagline", { text: next })
                        }
                      />
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Header dimensions and background"
                  desc="Height, placement, background and dividers for the top banner."
                  onReset={() => resetSection("header")}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                      onChange={(next) =>
                        setSection("header", { alignment: next })
                      }
                      options={["left", "center", "right"]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <SliderNumber
                      label="Logo size"
                      value={header.logo?.size ?? LIMITS.logoSize.min}
                      onChange={(next) =>
                        setSub("header", "logo", { size: next })
                      }
                      min={LIMITS.logoSize.min}
                      max={LIMITS.logoSize.max}
                      step={LIMITS.logoSize.step}
                      unit="px"
                      hint="The logo shrinks automatically if the header is too short for it."
                    />
                    <Segmented
                      label="Logo position"
                      value={header.logo?.position || "left"}
                      onChange={(next) =>
                        setSub("header", "logo", { position: next })
                      }
                      options={["left", "top", "bottom", "right"]}
                    />
                  </div>

                  <BackgroundEditor
                    label="Header background"
                    value={header.background}
                    types={["color", "gradient", "image"]}
                    uploadKind="header"
                    uploadLabel="Upload header image"
                    onChange={(next) =>
                      setSection("header", { background: next })
                    }
                    hint="The name and tagline are always re-colored so they stay readable on top of this."
                  />

                  <TextStyleEditor
                    label="Organization name style"
                    value={header.orgName?.style}
                    onSurface={resolved.header.surface}
                    sample={posterName}
                    onChange={(next) =>
                      setSub("header", "orgName", { style: next })
                    }
                  />

                  <TextStyleEditor
                    label="Tagline style"
                    value={header.tagline?.style}
                    onSurface={resolved.header.surface}
                    sample={header.tagline?.text || "Tagline appears like this"}
                    onChange={(next) =>
                      setSub("header", "tagline", { style: next })
                    }
                  />

                  <div className="space-y-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                    <Toggle
                      label="Show a line under the header"
                      checked={Boolean(header.border?.show)}
                      onChange={(next) =>
                        setSub("header", "border", { show: next })
                      }
                    />
                    {header.border?.show && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <ColorInput
                          label="Line color"
                          value={header.border?.color}
                          onChange={(next) =>
                            setSub("header", "border", { color: next })
                          }
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
                </SectionCard>
              </TabsContent>

              {/* Tab 3: Poster background */}
              <TabsContent value="background" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Area behind the poster text"
                  desc="Fills the center of the poster behind the headline and details."
                  onReset={resetContentArea}
                >
                  <BackgroundEditor
                    label="Fill"
                    value={content.background}
                    types={["color", "gradient", "image", "pattern"]}
                    uploadKind="content"
                    uploadLabel="Upload background image"
                    onChange={(next) =>
                      setSection("content", { background: next })
                    }
                  />
                  <Segmented
                    label="Decoration"
                    value={content.decoration || "none"}
                    onChange={(next) =>
                      setSection("content", { decoration: next })
                    }
                    options={[
                      { value: "none", label: "None" },
                      { value: "band", label: "Band" },
                      { value: "circle", label: "Circle" },
                      { value: "corners", label: "Corners" },
                    ]}
                  />
                  {content.decoration !== "none" && (
                    <div className="grid grid-cols-2 gap-4">
                      <ColorInput
                        label="Decoration color"
                        value={content.decorationColor}
                        onChange={(next) =>
                          setSection("content", { decorationColor: next })
                        }
                        onSurface={resolved.content.surface}
                      />
                    </div>
                  )}
                  <div className="space-y-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
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
                          content.watermark?.opacity ??
                          LIMITS.watermarkOpacity.min
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
                </SectionCard>

                <SectionCard
                  title="Default poster size"
                  desc="Canvas dimensions for newly created posters."
                  onReset={() =>
                    setTop({
                      defaultPosterSize: clone(
                        saved?.defaultPosterSize ?? { width: 1080, height: 1350 },
                      ),
                    })
                  }
                >
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

              {/* Tab 4: Footer */}
              <TabsContent value="footer" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Contact details"
                  desc="Only what you fill in is printed on the poster footer. Empty lines are left out."
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="pt-2 space-y-2 border-t border-[#E5E7EB]">
                    <label className="text-[13px] font-medium text-[#111827] block">
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
                                  at === index
                                    ? { ...item, platform: next }
                                    : item,
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
                                  at === index
                                    ? { ...item, url: next }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove this social link"
                          onClick={() =>
                            updateSocial((rows) =>
                              rows.filter((_, at) => at !== index),
                            )
                          }
                          className="h-9 w-9 border border-[#E5E7EB] shrink-0 text-[#6B7280] hover:text-[#DC2626] mb-0.5"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    {social.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateSocial((rows) => [
                            ...rows,
                            { platform: "facebook", url: "" },
                          ])
                        }
                        className="h-8 border-dashed border-[#D1D5DB] text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] gap-1.5"
                      >
                        <Plus size={14} />
                        <span>Add social link</span>
                      </Button>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Footer layout and appearance"
                  desc="Printed across the bottom of every poster."
                  onReset={() => resetSection("footer")}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <ColorInput
                      label="Website and social color"
                      value={footer.linkColor}
                      onSurface={resolved.footer.surface}
                      onChange={(next) => setSection("footer", { linkColor: next })}
                    />
                  </div>
                  <TextInput
                    id="legal"
                    label="Fine print"
                    value={footer.legalText ?? ""}
                    maxLength={160}
                    placeholder="e.g. © 2026 Northbridge Foundation. Registered charity."
                    onChange={(next) => setSection("footer", { legalText: next })}
                  />
                  <div className="space-y-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                    <Toggle
                      label="Show a line above the footer"
                      checked={Boolean(footer.divider?.show)}
                      onChange={(next) =>
                        setSub("footer", "divider", { show: next })
                      }
                    />
                    {footer.divider?.show && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
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
                </SectionCard>
              </TabsContent>

              {/* Tab 5: Colors and fonts */}
              <TabsContent value="colors-fonts" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Brand colors"
                  desc="These five colors drive the poster palette. Unreadable combinations are lifted automatically."
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
                  title="Typography and overrides"
                  desc="Custom font overrides and text styling across all poster areas."
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

                <SectionCard
                  title="Cards for date, time and place"
                  desc="The detail boxes in the middle of event and notice posters."
                  onReset={resetInfoCard}
                >
                  <div className="grid grid-cols-2 gap-4">
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
                </SectionCard>
              </TabsContent>

              {/* Tab 6: Presets */}
              <TabsContent value="presets" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Style presets"
                  desc="A starting point you can then fine-tune. Your name, logo, photos and contact details are never replaced."
                >
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
                              Apply this preset to the form? Your current styling is replaced, nothing is saved yet.
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
                </SectionCard>
              </TabsContent>

              {/* Tab 7: Poster design */}
              <TabsContent value="design" className="mt-0 outline-none space-y-8">
                <SectionCard
                  title="Poster creation modes"
                  desc="Settings for poster creation and generation modes."
                >
                  <Suspense
                    fallback={
                      <div className="py-6 text-sm text-[#6B7280]" role="status">
                        Loading these settings…
                      </div>
                    }
                  >
                    <DesignModesCard />
                  </Suspense>
                </SectionCard>
              </TabsContent>
            </div>

            {/* Right column: live preview (lg:sticky lg:top-24 self-start) */}
            <div className="w-full lg:sticky lg:top-24 self-start space-y-4">
              <div className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#111827]">
                      Live preview
                    </p>
                    {previewTemplates.length > 0 && (
                      <select
                        value={templateIdOf(template) || ""}
                        onChange={(e) => {
                          const found = previewTemplates.find(
                            (t) => templateIdOf(t) === e.target.value,
                          );
                          if (found) setTemplate(found);
                        }}
                        aria-label="Preview with template"
                        className="text-xs py-1 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-[#111827] max-w-[150px] truncate outline-none focus:border-[#2563EB]"
                      >
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
                    {templateIdOf(template) ? (
                      <a
                        href={`/templates/${templateIdOf(template)}/edit`}
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
                  Sample words so you can judge the look. Posters your team creates
                  carry their own headline and details in the middle.
                </p>
                {previewOverflow && (
                  <p className="text-[11px] text-[#F59E0B] leading-snug">
                    The sample text is long for this size — real posters shrink to
                    fit.
                  </p>
                )}
              </div>

              {/* Contrast checks as a simple 3-row list */}
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
                  <span className="text-xs text-[#6B7280]">
                    Poster title
                  </span>
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
