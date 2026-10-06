import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Toggle } from './controls';
import {
  BOTH_OFF_MESSAGE,
  BRAND_LINE,
  designModesOf,
  designModesPayload,
} from '../../utils/posterAiDesign';

/**
 * The organization's two ways of making a poster, read and saved through the settings route
 * that already exists. At least one stays on, otherwise nobody could make a poster at all.
 */
export default function DesignModesCard() {
  const { activeClientId } = useAuth();
  const [modes, setModes] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeClientId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/clients/${activeClientId}`);
        const next = designModesOf(res.data?.data?.client);
        if (cancelled) return;
        setModes(next);
        setSaved(next);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.status === 403
              ? 'You cannot change these settings for this organization.'
              : 'We could not read these settings. Please reload this page.'
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
    setError('');
    setModes((prev) => ({ ...prev, [key]: value }));
  };

  const dirty = Boolean(modes && saved && JSON.stringify(modes) !== JSON.stringify(saved));

  const save = async () => {
    if (!modes || !dirty || saving) return;
    if (!modes.ai && !modes.templates) {
      setError(BOTH_OFF_MESSAGE);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/clients/${activeClientId}`, designModesPayload(modes));
      const next = designModesOf(res.data?.data?.client);
      setModes(next);
      setSaved(next);
    } catch (err) {
      const serverMessage = err.response?.data?.error?.message;
      setError(
        err.response?.status === 400 && serverMessage
          ? serverMessage
          : err.response?.status === 403
            ? 'You cannot change these settings for this organization.'
            : 'We could not save these settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-surface p-5 flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Reading your organization settings…</span>
      </div>
    );
  }

  return (
    <section className="card-surface p-4 sm:p-5 space-y-4">
      <div className="pb-3 border-b border-line">
        <h2 className="text-sm font-semibold text-heading">Ways of making a poster</h2>
        <p className="text-xs text-muted mt-0.5 leading-snug">
          Switch off what your team should not use. The Create page then shows only what is left on.
        </p>
      </div>

      {modes && (
        <div className="space-y-3">
          <Toggle
            label="Let AI design posters"
            hint="The assistant chooses the look and writes the words from a description."
            checked={modes.ai}
            onChange={(value) => setMode('ai', value)}
          />
          <Toggle
            label="Let people pick layouts"
            hint="Your team chooses one of the layouts made under Templates."
            checked={modes.templates}
            onChange={(value) => setMode('templates', value)}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-danger flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted flex items-center gap-1.5 min-w-0">
          {modes?.ai ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
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
          <span>{saving ? 'Saving…' : dirty ? 'Save settings' : 'Saved'}</span>
        </button>
      </div>
    </section>
  );
}
