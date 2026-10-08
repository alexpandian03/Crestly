import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  MoveRight,
} from "lucide-react";
import api from "../services/api";
import TemplatePreview from "../components/TemplatePreview";
import { useAuth } from "../context/AuthContext";
import { LAYOUT_BASE, resolveTemplateRender } from "../utils/templateRender";
import { LAYOUT_LABELS } from "../utils/templateBuilderRules";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

const AREA_LABELS = {
  header: "Top band",
  footer: "Bottom band",
  content: "Words and photo area",
  image: "Photo area",
};
const SETTING_KEYS = [
  "alignment",
  "spacing",
  "imagePlacement",
  "infoStyle",
  "decoration",
];

export default function TemplateBuilder() {
  const { activeClientId } = useAuth();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("template") || "";
  const [template, setTemplate] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) {
        setLoading(false);
        setError("Pick a template from the Templates page first.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const [templateRes, kitRes] = await Promise.all([
          api.get(`/templates/${id}`),
          api.get("/brand-kit").catch(() => null),
        ]);
        if (!active) return;
        setTemplate(templateRes?.data?.data?.template || null);
        setBrandKit(
          kitRes?.data?.success ? kitRes.data.data?.brandKit || null : null,
        );
        if (!templateRes?.data?.data?.template)
          setError("We could not find that template.");
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.error?.message ||
              "We could not open this template.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, activeClientId]);

  const rendered = useMemo(
    () => (template ? resolveTemplateRender(template) : null),
    [template],
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2 pb-6 border-b border-[#E5E7EB]">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96 rounded-[8px]" />
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-[8px]" />
            <Skeleton className="h-40 rounded-[8px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="pb-6 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All templates
          </Link>
          <h1 className="text-[24px] font-semibold text-[#111827] tracking-tight mt-1 truncate">
            {template?.name || "Template"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            How this layout places the words, the photo and the information.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-[6px] border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] text-xs flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {template && rendered && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-4">
            <div className="mx-auto w-full max-w-[360px]">
              <TemplatePreview eager brandKit={brandKit} template={template} showZoneBorders />
            </div>
            <p className="mt-3 text-xs text-[#6B7280]">
              The top and bottom bands always come from your brand kit. Colours,
              logo and contacts cannot be changed here.
            </p>
          </div>

          <div className="space-y-4">
            <section className="rounded-[8px] border border-[#E5E7EB] bg-white p-4 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Areas
              </h2>
              <ul className="space-y-1.5 text-sm text-[#374151]">
                {[
                  { type: "header", zone: rendered.zones.header },
                  { type: "content", zone: rendered.zones.content },
                  { type: "image", zone: rendered.zones.image },
                  { type: "footer", zone: rendered.zones.footer },
                ]
                  .filter((row) => row.zone)
                  .map((row) => (
                    <li
                      key={row.type}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="inline-flex items-center gap-2">
                        {row.type === "image" ? (
                          <ImageIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                        )}
                        {AREA_LABELS[row.type]}
                      </span>
                      <span className="text-xs text-[#6B7280]">
                        {row.zone.w} × {row.zone.h}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-[#6B7280] pt-1">
                Text size in this layout: {rendered.fonts.minFont}–
                {rendered.fonts.maxFont}
              </p>
            </section>

            <section className="rounded-[8px] border border-[#E5E7EB] bg-white p-4 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Placement
              </h2>
              <ul className="space-y-1.5 text-sm text-[#374151]">
                {SETTING_KEYS.map((key) => (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-[#6B7280]">
                      {LAYOUT_LABELS[key].label}
                    </span>
                    <span className="font-medium text-[#111827]">
                      {LAYOUT_LABELS[key].values[rendered.layout[key]] ||
                        LAYOUT_LABELS[key].values[LAYOUT_BASE[key]]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Button
              asChild
              className="h-9 w-full rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8]"
            >
              <Link to={`/templates/${id}/edit`}>
                <MoveRight className="h-4 w-4 mr-2" /> Edit this layout
              </Link>
            </Button>
            <p className="text-xs text-[#6B7280] rounded-[6px] bg-[#FAFAFA] border border-[#E5E7EB] px-3 py-2">
              In the editor you can move the text and photo areas, change these
              settings and save a new version. The two brand areas always come
              from your brand kit.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
