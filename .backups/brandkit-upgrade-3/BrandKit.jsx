import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Palette,
  Upload,
  Type,
  Layout,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Save,
  Image as ImageIcon,
  Building2,
  Sliders,
  Globe,
  Phone,
  Shield,
  Loader2,
} from 'lucide-react';

const GOOGLE_FONTS_HEADING = [
  'Outfit',
  'Inter',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Cinzel',
];

const GOOGLE_FONTS_BODY = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'DM Sans',
  'Nunito',
];

export default function BrandKit() {
  const { user, activeClientId: selectedClientId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: '' });

  // BrandKit state
  const [kit, setKit] = useState({
    orgName: 'Acme Corporation',
    logos: [],
    colors: {
      primary: '#059669',
      secondary: '#0f172a',
      accent: '#10b981',
      text: '#ffffff',
      background: '#0b0f17',
    },
    fonts: {
      heading: 'Outfit',
      body: 'Inter',
    },
    header: {
      height: 80,
      background: 'rgba(15, 23, 42, 0.95)',
      alignment: 'left',
      showLogo: true,
      showOrgName: true,
    },
    footer: {
      height: 70,
      background: 'rgba(11, 15, 23, 0.98)',
      contactText: '+1 (800) 555-ACME',
      website: 'www.acmeposters.com',
      socials: ['@acmecorp'],
      legalText: 'Â© 2026 Acme Corp. All rights reserved.',
    },
    defaultPosterSize: {
      width: 1080,
      height: 1350,
    },
  });

  const isSuperadmin = user?.role === 'superadmin';
  const activeClientId = isSuperadmin ? selectedClientId : user?.clientId;

  // Load existing brand kit on mount or client change
  useEffect(() => {
    async function fetchBrandKit() {
      if (isSuperadmin && !activeClientId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/brand-kit');
        const loadedKit = res.data?.data?.brandKit;
        if (res.data?.success && loadedKit) {
          setKit(loadedKit);
        }
      } catch (err) {
        console.warn('Could not load brand kit:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBrandKit();
  }, [activeClientId, isSuperadmin]);

  // Handle Logo file upload (Memory Buffer -> Cloudinary)
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Logo file exceeds 2 MB limit. Please select a smaller file.' });
      return;
    }

    try {
      setUploadingLogo(true);
      setFeedback({ type: null, message: '' });

      const formData = new FormData();
      formData.append('logo', file);

      const res = await api.post('/uploads/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadData = res.data?.data;
      if (res.data?.success && (uploadData?.secure_url || uploadData?.url)) {
        const newLogoUrl = uploadData.secure_url || uploadData.url;
        setKit((prev) => ({
          ...prev,
          logos: [{ url: newLogoUrl, label: file.name, isPrimary: true }],
        }));
        setFeedback({
          type: 'success',
          message: 'Logo uploaded to Cloudinary successfully! Click "Save Brand Kit" to persist.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error?.message || err.message || 'Logo upload failed',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save BrandKit to DB
  const handleSave = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      setFeedback({ type: null, message: '' });

      const res = await api.put('/brand-kit', kit);
      if (res.data?.success) {
        setKit(res.data?.data?.brandKit || kit);
        setFeedback({ type: 'success', message: 'Brand Kit successfully saved to Atlas!' });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error?.message || err.message || 'Failed to save Brand Kit',
      });
    } finally {
      setSaving(false);
    }
  };

  const primaryLogo = kit.logos?.find((l) => l.isPrimary)?.url || kit.logos?.[0]?.url;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-mono text-slate-400">Loading brand assets...</p>
      </div>
    );
  }

  return (
    <div className="container-page section-pad space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            <span>Brand Kit & Asset Rules</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Brand guidelines and locked identity for <span className="font-medium text-primary">{isSuperadmin ? selectedClientId : (user?.clientName || 'your organization')}</span>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-btn text-sm transition-colors shadow-soft disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Brand Kit'}</span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback.message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${feedback.type === 'success'
              ? 'bg-success/5 border-success/20 text-success'
              : 'bg-danger/5 border-danger/20 text-danger'
            }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Studio Workspace: Form (Left) & Live Mini Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Identity & Logo Upload */}
          <div className="bg-canvas border border-line rounded-card p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-line text-heading font-semibold">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Organization Identity & Logo</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Organization / Brand Name
                </label>
                <input
                  type="text"
                  value={kit.orgName}
                  onChange={(e) => setKit({ ...kit, orgName: e.target.value })}
                  placeholder="e.g. Acme Corporation"
                  className="w-full bg-section border border-line rounded-btn px-4 py-2.5 text-sm text-heading focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Upload Brand Logo (Max 2 MB)
                </label>
                <label className="flex items-center justify-center gap-2 w-full bg-slate-800/80 hover:bg-slate-800 border border-dashed border-slate-600 hover:border-emerald-500 rounded-xl px-4 py-2 text-sm text-body cursor-pointer transition-colors">
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="w-4 h-4 text-primary" />
                  )}
                  <span>{uploadingLogo ? 'Uploading to Cloudinary...' : 'Choose Logo Image'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {primaryLogo && (
              <div className="p-3 bg-section border border-line rounded-btn flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-btn bg-canvas border border-line p-1 flex items-center justify-center overflow-hidden">
                    <img src={primaryLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-heading block">Active Logo URL</span>
                    <span className="text-[11px] text-muted font-mono truncate max-w-xs block">
                      {primaryLogo}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-chip border border-success/20 uppercase font-bold">
                  Cloudinary
                </span>
              </div>
            )}
          </div>

          {/* 2. Color Palette */}
          <div className="bg-canvas border border-line rounded-card p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-line text-heading font-semibold">
              <Palette className="w-5 h-5 text-primary" />
              <span>Color Palette</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'Primary', key: 'primary' },
                { label: 'Secondary', key: 'secondary' },
                { label: 'Accent', key: 'accent' },
                { label: 'Text', key: 'text' },
                { label: 'Background', key: 'background' },
              ].map(({ label, key }) => (
                <div key={key} className="bg-section border border-line rounded-btn p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {label}
                    </span>
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: kit.colors[key] }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={kit.colors[key]}
                      onChange={(e) =>
                        setKit({
                          ...kit,
                          colors: { ...kit.colors, [key]: e.target.value },
                        })
                      }
                      className="w-6 h-6 rounded cursor-pointer border-none bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={kit.colors[key]}
                      onChange={(e) =>
                        setKit({
                          ...kit,
                          colors: { ...kit.colors, [key]: e.target.value },
                        })
                      }
                      className="w-full bg-canvas border border-line rounded px-1.5 py-1 text-xs text-heading font-mono uppercase focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Typography */}
          <div className="bg-canvas border border-line rounded-card p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-line text-heading font-semibold">
              <Type className="w-5 h-5 text-primary" />
              <span>Google Fonts Typography</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Heading Font
                </label>
                <select
                  value={kit.fonts.heading}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      fonts: { ...kit.fonts, heading: e.target.value },
                    })
                  }
                  className="w-full bg-section border border-line rounded-btn px-4 py-2.5 text-sm text-heading focus:outline-none focus:border-primary/60"
                >
                  {GOOGLE_FONTS_HEADING.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Body Font
                </label>
                <select
                  value={kit.fonts.body}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      fonts: { ...kit.fonts, body: e.target.value },
                    })
                  }
                  className="w-full bg-section border border-line rounded-btn px-4 py-2.5 text-sm text-heading focus:outline-none focus:border-primary/60"
                >
                  {GOOGLE_FONTS_BODY.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Locked Header & Footer Config */}
          <div className="bg-canvas border border-line rounded-card p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-line text-heading font-semibold">
              <Layout className="w-5 h-5 text-primary" />
              <span>Locked Header & Footer Settings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Header Height (px)
                </label>
                <input
                  type="number"
                  value={kit.header.height}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      header: { ...kit.header, height: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-section border border-line rounded-btn px-4 py-2 text-sm text-heading"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Header Alignment
                </label>
                <select
                  value={kit.header.alignment}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      header: { ...kit.header, alignment: e.target.value },
                    })
                  }
                  className="w-full bg-section border border-line rounded-btn px-4 py-2 text-sm text-heading"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Footer Height (px)
                </label>
                <input
                  type="number"
                  value={kit.footer.height}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      footer: { ...kit.footer, height: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-section border border-line rounded-btn px-4 py-2 text-sm text-heading"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Footer Website
                </label>
                <input
                  type="text"
                  value={kit.footer.website}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      footer: { ...kit.footer, website: e.target.value },
                    })
                  }
                  placeholder="www.brand.com"
                  className="w-full bg-section border border-line rounded-btn px-4 py-2 text-sm text-heading"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Footer Contact Text
                </label>
                <input
                  type="text"
                  value={kit.footer.contactText}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      footer: { ...kit.footer, contactText: e.target.value },
                    })
                  }
                  placeholder="+1 (800) 555-0199"
                  className="w-full bg-section border border-line rounded-btn px-4 py-2 text-sm text-heading"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Mini Preview (5 Cols) */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="bg-canvas border border-line rounded-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2 text-heading font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Live Poster Preview</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Official Branding
              </span>
            </div>

            {/* Poster Canvas Preview */}
            <div
              className="w-full aspect-[4/5] rounded-card border border-line shadow-2xl flex flex-col justify-between overflow-hidden relative transition-all"
              style={{
                backgroundColor: kit.colors.background,
                color: kit.colors.text,
                fontFamily: `'${kit.fonts.body}', sans-serif`,
              }}
            >
              {/* Locked Header Zone */}
              <div
                className="w-full px-5 py-3 flex items-center border-b border-white/10 transition-all"
                style={{
                  minHeight: `${Math.min(kit.header.height, 90)}px`,
                  backgroundColor: kit.header.background,
                  justifyContent:
                    kit.header.alignment === 'center'
                      ? 'center'
                      : kit.header.alignment === 'right'
                        ? 'flex-end'
                        : 'flex-start',
                }}
              >
                <div className="flex items-center gap-3">
                  {kit.header.showLogo && primaryLogo ? (
                    <img
                      src={primaryLogo}
                      alt="Brand Logo"
                      className="h-8 max-w-[120px] object-contain rounded"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{
                        backgroundColor: kit.colors.primary,
                        color: kit.colors.text,
                      }}
                    >
                      {kit.orgName.charAt(0)}
                    </div>
                  )}

                  {kit.header.showOrgName && (
                    <span
                      className="font-bold text-sm tracking-tight"
                      style={{
                        fontFamily: `'${kit.fonts.heading}', sans-serif`,
                        color: kit.colors.text,
                      }}
                    >
                      {kit.orgName}
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Content Layer (Mock placeholder in Brand Kit) */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div
                  className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-dashed"
                  style={{
                    borderColor: kit.colors.accent,
                    color: kit.colors.accent,
                  }}
                >
                  Content Zone (AI Generated)
                </div>
                <h3
                  className="text-2xl font-black tracking-tight"
                  style={{
                    fontFamily: `'${kit.fonts.heading}', sans-serif`,
                    color: kit.colors.primary,
                  }}
                >
                  Annual Innovation Summit
                </h3>
                <p className="text-xs max-w-xs opacity-70">
                  AI will generate titles, dates, venues, and descriptions strictly within this zone.
                </p>
                <div
                  className="w-12 h-1 rounded-full"
                  style={{ backgroundColor: kit.colors.accent }}
                />
              </div>

              {/* Locked Footer Zone */}
              <div
                className="w-full px-5 py-3 flex items-center justify-between text-[11px] border-t border-white/10 transition-all opacity-90"
                style={{
                  minHeight: `${Math.min(kit.footer.height, 80)}px`,
                  backgroundColor: kit.footer.background,
                }}
              >
                <div className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 opacity-70" />
                  <span>{kit.footer.website}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 opacity-70" />
                  <span>{kit.footer.contactText}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted text-center leading-relaxed">
              The Header and Footer elements are completely locked and will wrap all AI-generated posters generated for this tenant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


