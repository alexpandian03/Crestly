import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Toggle } from "./controls";
import {
  BOTH_OFF_MESSAGE,
  BRAND_LINE,
  DESIGN_PALETTES,
  designModesOf,
  designModesPayload,
} from "../../utils/posterAiDesign";

/**
 * The organization's two ways of making a poster, read and saved through the settings route
 * that already exists. At least one stays on, otherwise nobody could make a poster at all.
 */
export default function DesignModesCard() {
  const { activeClientId } = useAuth();
  const [modes, setModes] = useState(null);
  const [saved, setSaved] = useState(null);
  const [palette, setPalette] = useState("balanced");
  const [savedPalette, setSavedPalette] = useState("balanced");
  const [organization, setOrganization] = useState(activeClientId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        /* An administrator of one organization never picks it - it is already their own - so
           asking for "the organization of this page" is what leaves the card waiting forever. */
        const res = await api.get(activeClientId ? `/clients/${activeClientId}` : "/clients/me");
        const client = res.data?.data?.client;
        const next = designModesOf(client);
        const nextPalette = client?.designPalette || "balanced";
        if (cancelled) return;
        setOrganization(client?._id || activeClientId);
        setModes(next);
        setSaved(next);
        setPalette(nextPalette);
        setSavedPalette(nextPalette);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.status === 403
              ? "You cannot change these settings for this organization."
              : "We could not read these settings. Please reload this page.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  const setMode = (key, value) => {
    setError("");
    setModes((prev) => ({ ...prev, [key]: value }));
  };

  const dirty = Boolean(
    (modes && saved && JSON.stringify(modes) !== JSON.stringify(saved)) ||
      palette !== savedPalette,
  );

  const save = async () => {
    if (!modes || !dirty || saving) return;
    if (!modes.ai && !modes.templates) {
      setError(BOTH_OFF_MESSAGE);
      return;
    }
    if (!organization) {
      setError("We could not work out which organization this is. Please reload this page.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.patch(
        `/clients/${organization}`,
        designModesPayload(modes, palette),
      );
      const client = res.data?.data?.client;
      const next = designModesOf(client);
      const nextPalette = client?.designPalette || palette;
      setModes(next);
      setSaved(next);
      setPalette(nextPalette);
      setSavedPalette(nextPalette);
    } catch (err) {
      const serverMessage = err.response?.data?.error?.message;
      setError(
        err.response?.status === 400 && serverMessage
          ? serverMessage
          : err.response?.status === 403
            ? "You cannot change these settings for this organization."
            : "We could not save these settings. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="card-surface p-5 flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Reading your organization settings…</span>
      </div>
    );
  }

  return (
    <section className="card-surface p-4 sm:p-5 space-y-5">
      <div className="pb-3 border-b border-line">
        <h2 className="text-sm font-semibold text-heading">
          Ways of making a poster
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          Switch off what your team should not use. The Create page then shows
          only what is left on.
        </p>
      </div>

      {modes && (
        <div className="space-y-3">
          <Toggle
            label="Let AI design posters"
            hint="The assistant chooses the look and writes the words from a description."
            checked={modes.ai}
            onChange={(value) => setMode("ai", value)}
          />
          <Toggle
            label="Let people pick layouts"
            hint="Your team chooses one of the layouts made under Templates."
            checked={modes.templates}
            onChange={(value) => setMode("templates", value)}
          />
        </div>
      )}

      <div className="pt-3 border-t border-line space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-heading">
            Color variety for AI designs
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Choose how strictly the assistant follows your brand colors when generating new posters.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DESIGN_PALETTES.map((opt) => (
            <label
              key={opt.id}
              className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                palette === opt.id
                  ? "border-primary bg-primary/5 text-heading font-medium"
                  : "border-line hover:border-line-hover text-muted-foreground"
              }`}
            >
              <input
                type="radio"
                name="designPalette"
                value={opt.id}
                checked={palette === opt.id}
                onChange={() => setPalette(opt.id)}
                className="sr-only"
              />
              <div className="text-xs font-semibold">{opt.name}</div>
              <div className="text-[11px] leading-tight text-muted-foreground mt-1">
                {opt.description}
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 min-w-0">
          {modes?.ai ? (
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{BRAND_LINE}</span>
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm shrink-0 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{saving ? "Saving…" : dirty ? "Save settings" : "Saved"}</span>
        </button>
      </div>
    </section>
  );
}
