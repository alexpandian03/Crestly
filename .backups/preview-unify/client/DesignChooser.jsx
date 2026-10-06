import React, { useMemo, useState } from "react";
import { Layout, Sparkles } from "lucide-react";
import TemplateThumb from "../TemplateThumb";
import { MODE_CARDS, BRAND_LINE } from "../../utils/posterAiDesign";
import { TEMPLATE_SAMPLE_CONTENT } from "../../data/demoPosters";

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-heading">Design</span>
        <span className="text-xs text-muted-foreground">
          {cards.length === 1 ? "Set by your organization" : "Choose one"}
        </span>
      </div>

      <div
        className={
          cards.length === 1
            ? "space-y-2"
            : "grid grid-cols-1 sm:grid-cols-2 gap-2"
        }
      >
        {cards.map((card) => {
          const active = card.mode === mode;
          const Icon = card.mode === "ai" ? Sparkles : Layout;
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => onModeChange(card.mode)}
              aria-pressed={active}
              className={`text-left rounded-btn border p-3 transition-all ${
                active
                  ? "border-primary bg-section ring-1 ring-primary shadow-soft"
                  : "border-line bg-canvas hover:border-primary/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="text-sm font-semibold text-heading">
                  {card.title}
                </span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
                {card.note}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "template" && (
        <div className="rounded-btn border border-line bg-canvas p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-heading">
              Choose a layout
            </span>
            {categories.length > 2 && (
              <div className="flex gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`text-xs px-2 py-0.5 rounded-chip transition-colors ${
                      category.toLowerCase() === cat.toLowerCase()
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-heading bg-section"
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
                    className={`text-left rounded-btn border transition-all overflow-hidden ${
                      isSelected
                        ? "border-primary bg-section ring-1 ring-primary shadow-soft"
                        : "border-line bg-canvas hover:border-primary/50"
                    }`}
                  >
                    <div className="bg-preview p-1.5 flex justify-center pointer-events-none select-none">
                      <TemplateThumb
                        brandKit={brandKit}
                        template={t}
                        content={TEMPLATE_SAMPLE_CONTENT}
                        width={64}
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <p
                        className="text-[11px] font-semibold text-heading truncate"
                        title={t.name}
                      >
                        {t.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {t.category || "Event"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No layout is turned on for your organization yet. An administrator
              can turn one on under Templates.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground rounded-card bg-section border border-line px-3 py-2">
        {BRAND_LINE}
      </p>
    </div>
  );
}
