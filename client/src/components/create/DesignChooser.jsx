import React, { useMemo, useState } from "react";
import { Layout, Sparkles } from "lucide-react";
import TemplatePreview from "../TemplatePreview";
import { MODE_CARDS, BRAND_LINE } from "../../utils/posterAiDesign";

const templateId = (template) => template?.id || template?._id;

/**
 * The two ways this organization can make a poster. Only the modes the administrator left
 * switched on are offered, and the layout list is shown once that card is chosen.
 */
export default function DesignChooser({
  modes,
  mode,
  onModeChange,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  brandKit,
}) {
  const [category, setCategory] = useState("All");

  const cards = useMemo(
    () => MODE_CARDS.filter((card) => (modes || []).includes(card.mode)),
    [modes],
  );

  const categories = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return set.size > 0 ? ["All", ...Array.from(set)] : ["All"];
  }, [templates]);

  const shown = useMemo(() => {
    if (category === "All") return templates;
    return templates.filter(
      (t) => (t.category || "General").toLowerCase() === category.toLowerCase(),
    );
  }, [templates, category]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-[#111827]">Design</label>
        <span className="text-xs text-[#6B7280]">
          {cards.length === 1 ? "Set by your organization" : "Choose one"}
        </span>
      </div>

      <div
        className={
          cards.length === 1
            ? "space-y-2"
            : "grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        }
      >
        {cards.map((card) => {
          const active = card.mode === mode;
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => onModeChange(card.mode)}
              aria-pressed={active}
              className={`text-left rounded-[6px] border p-3 transition-colors ${
                active
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    active
                      ? "border-[#2563EB] bg-[#2563EB]"
                      : "border-[#D1D5DB] bg-white"
                  }`}
                >
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#111827]">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#6B7280] leading-relaxed">
                    {card.note}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {mode === "template" && (
        <div className="rounded-[6px] border border-[#E5E7EB] bg-white p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#111827]">
              Choose a layout
            </span>
            {categories.length > 2 && (
              <div className="flex gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`text-xs px-2 py-0.5 rounded-[4px] transition-colors ${
                      category.toLowerCase() === cat.toLowerCase()
                        ? "bg-[#2563EB] text-white"
                        : "text-[#6B7280] hover:text-[#111827] bg-[#F3F4F6]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {shown.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
              {shown.map((t) => {
                const id = templateId(t);
                const isSelected = id === selectedTemplateId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTemplate(id)}
                    aria-pressed={isSelected}
                    className={`text-left rounded-[6px] border transition-colors overflow-hidden ${
                      isSelected
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                    }`}
                  >
                    <div className="bg-[#FAFAFA] p-1.5 flex justify-center pointer-events-none select-none">
                      <TemplatePreview
                        brandKit={brandKit}
                        template={t}
                        size={64}
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <p
                        className="text-[11px] font-medium text-[#111827] truncate"
                        title={t.name}
                      >
                        {t.name}
                      </p>
                      <p className="text-[10px] text-[#6B7280] capitalize">
                        {t.category || "Event"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280]">
              No layout is turned on for your organization yet. An administrator
              can turn one on under Templates.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-[#6B7280] leading-relaxed">
        {BRAND_LINE}
      </p>
    </div>
  );
}
