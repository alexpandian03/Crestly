import React from "react";
import { Lock, RotateCcw, Sliders, X } from "lucide-react";
import {
  BackgroundEditor,
  ColorInput,
  LIMITS,
  Segmented,
  SliderNumber,
  Toggle,
} from "../brand/controls";
import {
  BAND_HEIGHTS,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_PAGE_DECORATION,
  DEFAULT_PAGE_INFO_CARD,
  DEFAULT_PAGE_WATERMARK,
  SECTION_LIMITS,
  resolveColorToken,
} from "../../../../shared/templateElements.js";
import { bandToCustomize } from "../../utils/brandBands";
import { toHex } from "../../utils/contrast.js";

const BRAND_PALETTE = [
  { token: "brand:primary", label: "Primary" },
  { token: "brand:secondary", label: "Secondary" },
  { token: "brand:accent", label: "Accent" },
  { token: "brand:text", label: "Text" },
  { token: "brand:background", label: "Background" },
];

function PageSectionCard({
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
          { value: "brand", label: "Use brand" },
          { value: "custom", label: "Customize" },
        ]}
      />

      {isCustom ? (
        <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">{children}</div>
      ) : (
        <p className="text-[11px] text-[#6B7280] leading-snug">
          Using your organization&rsquo;s brand setting.
        </p>
      )}
    </div>
  );
}

export default function SectionSettingsPanel({
  isOpen = false,
  onClose,
  section,
  sections,
  brandKit,
  size,
  brandLayer = false,
  onEditBrandBand = null,
  onSectionChange,
  onPageChange,
  onResetPageSection,
}) {
  if (!isOpen) return null;

  const isHeader = section === "header";
  const isContent = section === "content";

  if (isContent) {
    const page = sections?.content?.page || {};
    const bg = page.background || { mode: "brand" };
    const dec = page.decoration || { mode: "brand" };
    const wm = page.watermark || { mode: "brand" };
    const card = page.infoCard || { mode: "brand" };

    return (
      <aside
        aria-label="Content area settings drawer"
        className="w-[320px] shrink-0 border-l border-[#E5E7EB] bg-white h-full flex flex-col z-30 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold text-[#111827]">
              Content settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs text-[#6B7280]">
              Customize the backdrop, decorations and info cards for the main area.
            </p>
          </div>

        {/* 1. Background */}
        <PageSectionCard
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
              onResetPageSection("background");
            }
          }}
          onReset={() => onResetPageSection("background")}
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
        </PageSectionCard>

        {/* 2. Decoration */}
        <PageSectionCard
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
              onResetPageSection("decoration");
            }
          }}
          onReset={() => onResetPageSection("decoration")}
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
        </PageSectionCard>

        {/* 3. Watermark */}
        <PageSectionCard
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
              onResetPageSection("watermark");
            }
          }}
          onReset={() => onResetPageSection("watermark")}
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
        </PageSectionCard>

        {/* 4. Info Card */}
        <PageSectionCard
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
              onResetPageSection("infoCard");
            }
          }}
          onReset={() => onResetPageSection("infoCard")}
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
        </PageSectionCard>
        </div>
      </aside>
    );
  }

  // Header or Footer
  const currentSection = sections?.[section] || {};
  const isCustom = currentSection.mode === "custom";
  const height = currentSection.height ?? (isHeader ? 80 : 70);
  const background = currentSection.background || DEFAULT_PAGE_BACKGROUND;
  const bandName = isHeader ? "organization header" : "organization footer";
  const minHeight = brandLayer ? BAND_HEIGHTS[section].min : SECTION_LIMITS[section].minHeight;
  const maxHeight = brandLayer ? BAND_HEIGHTS[section].max : SECTION_LIMITS[section].maxHeight;

  const handleModeSwitch = (mode) => {
    if (mode === "custom") {
      /* Start from exactly what every poster of this organization draws today: the items the
         brand lays out for itself, or the ones its settings turn into when it never placed any. */
      const takeover = bandToCustomize(brandKit, section, { size, current: currentSection });
      onSectionChange(section, takeover || { mode: "custom" });
    } else {
      handleResetToBrand();
    }
  };

  const handleResetToBrand = () => {
    if (
      window.confirm(
        `Reset this ${isHeader ? "header" : "footer"} to follow your ${bandName}? Anything you placed here will be cleared.`
      )
    ) {
      onSectionChange(section, {
        mode: "brand",
        elements: [],
      });
    }
  };

  return (
    <aside
      aria-label={`${isHeader ? "Header" : "Footer"} settings drawer`}
      className="w-[320px] shrink-0 border-l border-[#E5E7EB] bg-white h-full flex flex-col z-30 shadow-xs"
    >
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-sm font-semibold text-[#111827]">
            {isHeader ? "Header settings" : "Footer settings"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[6px] p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          aria-label="Close settings"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#111827]">
              {isHeader ? "Header" : "Footer"}
            </h3>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              {isHeader
                ? "Organization branding at the top."
                : "Contacts and social links at the bottom."}
            </p>
          </div>
        {isCustom && !brandLayer && (
          <button
            type="button"
            onClick={handleResetToBrand}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] hover:text-[#111827] px-1.5 py-0.5 rounded border border-[#E5E7EB]"
            title="Reset to brand"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Mode: follow the organization, or customize this template */}
      {brandLayer ? (
        <p className="rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[11px] leading-snug text-[#4B5563]">
          This is your {bandName}. Every new poster starts with it.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Segmented
            label="Design mode"
            value={isCustom ? "custom" : "brand"}
            onChange={handleModeSwitch}
            options={[
              { value: "brand", label: isHeader ? "Use organization header" : "Use organization footer" },
              { value: "custom", label: "Customize for this template" },
            ]}
          />
          {!isCustom && onEditBrandBand ? (
            <button
              type="button"
              onClick={() => onEditBrandBand(section)}
              className="text-[11px] font-semibold text-[#2563EB] hover:underline"
            >
              Edit {bandName}
            </button>
          ) : null}
        </div>
      )}

      {/* Height */}
      <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
        <SliderNumber
          label="Height"
          value={height}
          min={minHeight}
          max={maxHeight}
          step={4}
          unit="px"
          onChange={(nextHeight) => onSectionChange(section, { height: nextHeight })}
          hint={`Between ${minHeight} and ${maxHeight}, in steps of 4`}
        />
      </div>

      {/* Background (Brand colours first, then custom/gradient/image) */}
      <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#111827]">
            Brand colors
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_PALETTE.map((swatch) => {
              const hex = toHex(resolveColorToken(swatch.token, brandKit), "#ffffff");
              const isSelected =
                background?.type === "color" && background?.color === swatch.token;
              return (
                <button
                  key={swatch.token}
                  type="button"
                  title={`Brand ${swatch.label} color`}
                  onClick={() =>
                    onSectionChange(section, {
                      background: { type: "color", color: swatch.token },
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? "border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#111827]"
                      : "border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#9CA3AF]"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-slate-300 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{swatch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <BackgroundEditor
          label="Custom background"
          value={background}
          onChange={(patch) =>
            onSectionChange(section, { background: { ...background, ...patch } })
          }
          types={["color", "gradient", "image"]}
          uploadKind={section}
          uploadLabel={`Upload ${isHeader ? "header" : "footer"} photo`}
        />
      </div>

      {/* Locked Note */}
      <div className="rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
          <Lock className="h-3.5 w-3.5 text-[#6B7280]" />
          <span>Locked for AI and users</span>
        </div>
        <p className="text-[11px] text-[#6B7280] leading-snug">
          Items in this band are fixed parts of your layout. The AI assistant and creators never change or fill them in.
        </p>
      </div>
      </div>
    </aside>
  );
}
