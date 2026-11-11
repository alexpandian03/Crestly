import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import PosterPreview from "../components/PosterPreview";
import BrandImageField from "../components/brand/BrandImageField";
import { BRAND_RENDER_DEFAULTS } from "../utils/brandRender";
import { friendlyError } from "../utils/brandImage";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

const DEFAULT_PREVIEW_TEMPLATE = {
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

function blankKit(user) {
  return {
    ...clone(BRAND_RENDER_DEFAULTS),
    orgName: user?.clientName || "Organization",
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
    header: {
      height: 140,
      alignment: "left",
      mode: "legacy",
      elements: [],
      background: {
        type: "color",
        color: "#ffffff",
        imageUrl: "",
        overlayOpacity: 0,
        fit: "cover",
        position: "center",
      },
      showLogo: false,
      showOrgName: false,
      logo: { show: false, size: 56, position: "left" },
      orgName: { show: false, text: "" },
      tagline: { show: false, text: "" },
      border: { show: false, color: "#e5e7eb", thickness: 0 },
    },
    footer: {
      height: 130,
      layout: 2,
      mode: "legacy",
      elements: [],
      background: {
        type: "color",
        color: "#ffffff",
        imageUrl: "",
        overlayOpacity: 0,
        fit: "cover",
        position: "center",
      },
      address: "",
      phone: "",
      email: "",
      website: "",
      social: [],
      contactText: "",
      socials: [],
      legalText: "",
      divider: { show: false, color: "#e5e7eb", thickness: 0 },
    },
  };
}

export default function BrandKit() {
  const { user, activeClientId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [saveError, setSaveError] = useState("");
  const [kit, setKit] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadNote("");
      setSaveError("");
      const kitResult = await api.get("/brand-kit").catch((err) => err);
      if (cancelled) return;

      let nextKit = null;
      if (kitResult?.response?.status === 404) {
        nextKit = blankKit(user);
        setLoadNote(
          "Upload your header and footer banners below and click Save. They will become the permanent default for this organization."
        );
      } else if (!kitResult?.data?.success || !kitResult.data?.data?.brandKit) {
        nextKit = blankKit(user);
        const status = kitResult?.response?.status;
        setLoadNote(
          status === 401 || status === 403
            ? "Please log in again to open the brand kit."
            : friendlyError(
                kitResult,
                "We could not load the brand kit. Refresh the page to try again."
              )
        );
      } else {
        nextKit = kitResult.data.data.brandKit;
      }

      if (nextKit) {
        const headerBgColor = nextKit.header?.background?.color;
        if (!headerBgColor || headerBgColor.startsWith("brand:")) {
          nextKit.header = {
            ...(nextKit.header || {}),
            background: { ...(nextKit.header?.background || {}), color: "#ffffff" },
          };
        }
        const footerBgColor = nextKit.footer?.background?.color;
        if (!footerBgColor || footerBgColor.startsWith("brand:")) {
          nextKit.footer = {
            ...(nextKit.footer || {}),
            background: { ...(nextKit.footer?.background || {}), color: "#ffffff" },
          };
        }
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

  const dirty = useMemo(() => {
    if (!kit || !saved) return false;
    return JSON.stringify(kit) !== JSON.stringify(saved);
  }, [kit, saved]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleHeaderImageChange = (url) => {
    setKit((prev) => ({
      ...prev,
      logos: [],
      header: {
        ...(prev.header || {}),
        mode: "legacy",
        elements: [],
        background: {
          type: url ? "image" : "color",
          color: "#ffffff",
          imageUrl: url || "",
          overlayOpacity: 0,
          overlayColor: "#000000",
          fit: "cover",
          position: "center",
        },
        showLogo: false,
        showOrgName: false,
        logo: { show: false, size: 56, position: "left" },
        orgName: { show: false, text: "" },
        tagline: { show: false, text: "" },
        border: { show: false, color: "#059669", thickness: 0 },
      },
    }));
  };

  const handleFooterImageChange = (url) => {
    setKit((prev) => ({
      ...prev,
      footer: {
        ...(prev.footer || {}),
        mode: "legacy",
        elements: [],
        background: {
          type: url ? "image" : "color",
          color: "#ffffff",
          imageUrl: url || "",
          overlayOpacity: 0,
          overlayColor: "#000000",
          fit: "cover",
          position: "center",
        },
        address: "",
        phone: "",
        email: "",
        website: "",
        social: [],
        contactText: "",
        socials: [],
        legalText: "",
        divider: { show: false, color: "#1f2937", thickness: 0 },
      },
    }));
  };

  const handleHeaderHeightChange = (height) => {
    setKit((prev) => ({
      ...prev,
      header: {
        ...(prev.header || {}),
        height: Number(height),
      },
    }));
  };

  const handleFooterHeightChange = (height) => {
    setKit((prev) => ({
      ...prev,
      footer: {
        ...(prev.footer || {}),
        height: Number(height),
      },
    }));
  };

  const cleanBackground = (bg) => ({
    type: bg?.imageUrl ? "image" : "color",
    color: bg?.color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(bg.color) ? bg.color : "#ffffff",
    imageUrl: bg?.imageUrl || "",
    fit: "cover",
    position: "center",
    overlayOpacity: 0,
    overlayColor: "#000000",
  });

  const buildPayload = (source) => {
    return {
      orgName: String(source.orgName || user?.clientName || "Organization").trim(),
      logos: [],
      colors: source.colors,
      fonts: source.fonts,
      preset: source.preset,
      textStyle: source.textStyle,
      header: {
        ...source.header,
        mode: "legacy",
        elements: [],
        height: source.header?.height ?? 140,
        background: cleanBackground(source.header?.background),
        showLogo: false,
        showOrgName: false,
        logo: { show: false, size: 56, position: "left" },
        orgName: { show: false, text: "" },
        tagline: { show: false, text: "" },
        border: { show: false, color: "#e5e7eb", thickness: 0 },
      },
      content: source.content,
      footer: {
        ...source.footer,
        mode: "legacy",
        elements: [],
        height: source.footer?.height ?? 130,
        background: cleanBackground(source.footer?.background),
        address: "",
        phone: "",
        email: "",
        website: "",
        social: [],
        contactText: "",
        socials: [],
        legalText: "",
        divider: { show: false, color: "#e5e7eb", thickness: 0 },
      },
      defaultPosterSize: source.defaultPosterSize,
    };
  };

  const persist = async (source) => {
    setSaving(true);
    setSaveError("");
    try {
      const response = await api.put("/brand-kit", buildPayload(source));
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || "");
      }
      const returned = response.data.data.brandKit;
      setKit(returned);
      setSaved(clone(returned));
      setLoadNote("");
      toast.success("Default header and footer saved successfully!");
      return true;
    } catch (err) {
      setSaveError(
        friendlyError(err, "The brand kit could not be saved. Please try again.")
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!kit) return;
    await persist(kit);
  };

  const handleDiscard = () => {
    if (!dirty || !saved) return;
    if (!window.confirm("Discard unsaved changes?")) return;
    setKit(clone(saved));
    setSaveError("");
    toast.success("Changes discarded.");
  };

  if (loading || !kit) {
    return (
      <div className="bg-white min-h-[calc(100vh-56px)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-[6px]" />
            <Skeleton className="h-4 w-96 rounded-[6px]" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 space-y-6">
              <Skeleton className="h-48 w-full rounded-[8px]" />
              <Skeleton className="h-48 w-full rounded-[8px]" />
            </div>
            <div className="w-full">
              <Skeleton className="h-[520px] w-full rounded-[8px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const headerHeight = kit.header?.height ?? 140;
  const footerHeight = kit.footer?.height ?? 130;
  const headerImageUrl = kit.header?.background?.imageUrl || "";
  const footerImageUrl = kit.footer?.background?.imageUrl || "";

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      {/* Top action bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              Brand kit
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
              {kit.orgName || "Organization"} · Upload your default header and footer. Once saved, they stay locked on all posters.
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
                Default locked
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
          <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
            <div className="flex items-start gap-2.5">
              {saveError ? (
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              )}
              <p className={`text-xs leading-relaxed ${saveError ? "text-[#DC2626]" : "text-[#374151]"}`}>
                {saveError || loadNote}
              </p>
            </div>
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

        {/* 2-column layout: Upload controls on the left, live poster preview on the right */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-6">
            {/* Header Banner Card */}
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">
                  Header banner
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Upload your organization&apos;s top banner image. It remains locked at the top of every poster.
                </p>
              </div>

              <BrandImageField
                label="Upload header banner"
                kind="header"
                value={headerImageUrl}
                boxClass="h-44"
                hint="Upload a wide banner image (PNG, JPG, or WebP). Text overlays are automatically hidden so your banner artwork is shown cleanly."
                onChange={handleHeaderImageChange}
              />

              <div className="pt-2 border-t border-[#F3F4F6] space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#374151]">
                  <span>Header banner height</span>
                  <span className="tabular-nums px-2 py-0.5 bg-[#F3F4F6] rounded text-[#111827] font-semibold">
                    {headerHeight}px
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={200}
                  step={5}
                  value={headerHeight}
                  onChange={(e) => handleHeaderHeightChange(e.target.value)}
                  className="w-full h-1.5 bg-[#E5E7EB] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                />
                <div className="flex justify-between text-[11px] text-[#9CA3AF]">
                  <span>Compact (60px)</span>
                  <span>Default (140px)</span>
                  <span>Tall (200px)</span>
                </div>
              </div>
            </div>

            {/* Footer Banner Card */}
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">
                  Footer banner
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Upload your organization&apos;s bottom banner image (contacts, logos, sponsors). It remains locked at the bottom of every poster.
                </p>
              </div>

              <BrandImageField
                label="Upload footer banner"
                kind="footer"
                value={footerImageUrl}
                boxClass="h-44"
                hint="Upload a wide banner image (PNG, JPG, or WebP). Text overlays are automatically hidden so your banner artwork is shown cleanly."
                onChange={handleFooterImageChange}
              />

              <div className="pt-2 border-t border-[#F3F4F6] space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#374151]">
                  <span>Footer banner height</span>
                  <span className="tabular-nums px-2 py-0.5 bg-[#F3F4F6] rounded text-[#111827] font-semibold">
                    {footerHeight}px
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={260}
                  step={5}
                  value={footerHeight}
                  onChange={(e) => handleFooterHeightChange(e.target.value)}
                  className="w-full h-1.5 bg-[#E5E7EB] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                />
                <div className="flex justify-between text-[11px] text-[#9CA3AF]">
                  <span>Compact (60px)</span>
                  <span>Default (130px)</span>
                  <span>Tall (260px)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: live poster preview */}
          <div className="w-full lg:sticky lg:top-24 self-start space-y-3">
            <div className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-4 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-[#E5E7EB]">
                <p className="text-xs font-semibold text-[#111827]">
                  Live poster preview
                </p>
                <span className="text-[11px] text-[#6B7280] font-medium tabular-nums">
                  {DEFAULT_PREVIEW_TEMPLATE.size.width} × {DEFAULT_PREVIEW_TEMPLATE.size.height}
                </span>
              </div>

              <div className="rounded-[6px] overflow-hidden border border-[#E5E7EB] bg-white shadow-sm">
                <PosterPreview
                  eager
                  brandKit={kit}
                  template={DEFAULT_PREVIEW_TEMPLATE}
                  content={{}}
                />
              </div>

              <p className="text-[11px] text-[#6B7280] leading-snug">
                Your header banner stays locked at the top and your footer banner at the bottom. The AI generator will fill the center content area.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
