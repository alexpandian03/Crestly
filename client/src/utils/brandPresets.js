/**
 * Four starting points for the brand form. A preset touches styling only: the
 * organization name, logo, photos and contact lines already in the form are
 * kept, and everything stays editable afterwards.
 */

const style = (over) => ({
  fontFamily: 'Inter',
  size: 16,
  weight: 400,
  color: '#0f172a',
  uppercase: false,
  letterSpacing: 0,
  ...over,
});

const plate = (over) => ({
  type: 'color',
  color: '#ffffff',
  gradientFrom: '#0f172a',
  gradientTo: '#1d4ed8',
  gradientAngle: 135,
  imageUrl: '',
  overlayColor: '#0b0f17',
  overlayOpacity: 0.4,
  ...over,
});

export const BRAND_PRESET_LIST = [
  {
    id: 'professional',
    label: 'Professional',
    blurb: 'Deep navy bands, a serif name and generous space. Suited to institutions and corporate events.',
    swatch: ['#1d4ed8', '#0b1220', '#38bdf8'],
    patch: {
      preset: 'professional',
      colors: { primary: '#1d4ed8', secondary: '#0f172a', accent: '#38bdf8', text: '#ffffff', background: '#0b1220' },
      fonts: { heading: 'Playfair Display', body: 'Inter' },
      textStyle: style({ fontFamily: 'Playfair Display', size: 24, weight: 600, color: '#0f172a' }),
      background: plate({ color: '#0b1220' }),
      header: {
        height: 112,
        alignment: 'left',
        background: plate({ type: 'gradient', gradientFrom: '#0f172a', gradientTo: '#1d4ed8', gradientAngle: 105 }),
        logo: { show: true, size: 62, position: 'left' },
        orgName: { show: true, style: style({ fontFamily: 'Playfair Display', size: 30, weight: 700, color: '#ffffff' }) },
        tagline: { style: style({ size: 14, weight: 400, color: '#bfdbfe', letterSpacing: 2 }) },
        border: { show: true, color: '#38bdf8', thickness: 3 },
      },
      content: {
        background: plate({ color: '#0b1220' }),
        decoration: 'corners',
        decorationColor: '#38bdf8',
        watermark: { show: false, opacity: 0.08 },
        headingColor: '#ffffff',
        bodyColor: '#cbd5e1',
        accentColor: '#7dd3fc',
        headingFont: 'Playfair Display',
        bodyFont: 'Inter',
        infoCard: { background: '#0f1a2e', border: '#1e3a8a', radius: 18, iconColor: '#7dd3fc' },
      },
      footer: {
        height: 124,
        layout: 2,
        background: plate({ color: '#060b16' }),
        style: style({ size: 14, weight: 400, color: '#dbeafe' }),
        linkColor: '#7dd3fc',
        divider: { show: true, color: '#1e3a8a', thickness: 2 },
      },
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    blurb: 'High contrast, wide capitals and a bright base strip. Suited to launches, sport and gaming.',
    swatch: ['#f97316', '#1c1917', '#facc15'],
    patch: {
      preset: 'bold',
      colors: { primary: '#f97316', secondary: '#1c1917', accent: '#facc15', text: '#fff7ed', background: '#1c1917' },
      fonts: { heading: 'Montserrat', body: 'Roboto' },
      textStyle: style({ fontFamily: 'Montserrat', size: 26, weight: 700, color: '#1c1917', uppercase: true, letterSpacing: 2 }),
      background: plate({ type: 'gradient', gradientFrom: '#1c1917', gradientTo: '#7c2d12', gradientAngle: 45 }),
      header: {
        height: 150,
        alignment: 'right',
        background: plate({ color: '#1c1917' }),
        logo: { show: true, size: 74, position: 'left' },
        orgName: { show: true, style: style({ fontFamily: 'Montserrat', size: 34, weight: 700, color: '#facc15', uppercase: true, letterSpacing: 3 }) },
        tagline: { style: style({ fontFamily: 'Roboto', size: 15, weight: 500, color: '#fed7aa', uppercase: true, letterSpacing: 4 }) },
        border: { show: true, color: '#facc15', thickness: 8 },
      },
      content: {
        background: plate({ color: '#1c1917' }),
        decoration: 'band',
        decorationColor: '#f97316',
        watermark: { show: false, opacity: 0.1 },
        headingColor: '#fff7ed',
        bodyColor: '#fed7aa',
        accentColor: '#facc15',
        headingFont: 'Montserrat',
        bodyFont: 'Roboto',
        infoCard: { background: '#2a1206', border: '#facc15', radius: 4, iconColor: '#facc15' },
      },
      footer: {
        height: 96,
        layout: 1,
        background: plate({ type: 'gradient', gradientFrom: '#f97316', gradientTo: '#ef4444', gradientAngle: 90 }),
        style: style({ fontFamily: 'Montserrat', size: 15, weight: 600, color: '#1c1917', uppercase: true, letterSpacing: 1 }),
        linkColor: '#1c1917',
        divider: { show: true, color: '#1c1917', thickness: 4 },
      },
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    blurb: 'White space, hairline rules and a light centre. Suited to galleries, notices and clinics.',
    swatch: ['#0f172a', '#ffffff', '#e2e8f0'],
    patch: {
      preset: 'minimal',
      colors: { primary: '#0f172a', secondary: '#64748b', accent: '#0f172a', text: '#0f172a', background: '#ffffff' },
      fonts: { heading: 'DM Sans', body: 'Lato' },
      textStyle: style({ fontFamily: 'DM Sans', size: 22, weight: 500, color: '#0f172a', letterSpacing: 1 }),
      background: plate({ color: '#ffffff' }),
      header: {
        height: 92,
        alignment: 'center',
        background: plate({ color: '#ffffff' }),
        logo: { show: true, size: 44, position: 'top' },
        orgName: { show: true, style: style({ fontFamily: 'DM Sans', size: 26, weight: 600, color: '#0f172a', uppercase: true, letterSpacing: 6 }) },
        tagline: { style: style({ fontFamily: 'Lato', size: 13, weight: 400, color: '#64748b', letterSpacing: 2 }) },
        border: { show: true, color: '#e2e8f0', thickness: 1 },
      },
      content: {
        background: { ...plate({ color: '#ffffff' }), type: 'pattern', pattern: 'lines' },
        decoration: 'none',
        decorationColor: '#0f172a',
        watermark: { show: false, opacity: 0.05 },
        headingColor: '#0f172a',
        bodyColor: '#475569',
        accentColor: '#0f172a',
        headingFont: 'DM Sans',
        bodyFont: 'Lato',
        infoCard: { background: '#f8fafc', border: '#e2e8f0', radius: 8, iconColor: '#0f172a' },
      },
      footer: {
        height: 84,
        layout: 3,
        background: plate({ color: '#ffffff' }),
        style: style({ fontFamily: 'Lato', size: 13, weight: 400, color: '#64748b', letterSpacing: 1 }),
        linkColor: '#0f172a',
        divider: { show: true, color: '#e2e8f0', thickness: 1 },
      },
    },
  },
  {
    id: 'festival',
    label: 'Festival',
    blurb: 'Warm gradients, rounded cards and a faint logo watermark. Suited to festivals and community events.',
    swatch: ['#f43f5e', '#a855f7', '#fbbf24'],
    patch: {
      preset: 'festival',
      colors: { primary: '#f43f5e', secondary: '#a855f7', accent: '#fbbf24', text: '#fff7ed', background: '#2e1065' },
      fonts: { heading: 'Poppins', body: 'Nunito' },
      textStyle: style({ fontFamily: 'Poppins', size: 26, weight: 700, color: '#2e1065' }),
      background: plate({ type: 'gradient', gradientFrom: '#2e1065', gradientTo: '#831843', gradientAngle: 160 }),
      header: {
        height: 130,
        alignment: 'center',
        background: plate({ type: 'gradient', gradientFrom: '#f43f5e', gradientTo: '#a855f7', gradientAngle: 80 }),
        logo: { show: true, size: 66, position: 'bottom' },
        orgName: { show: true, style: style({ fontFamily: 'Poppins', size: 32, weight: 700, color: '#fff7ed', uppercase: true, letterSpacing: 2 }) },
        tagline: { style: style({ fontFamily: 'Nunito', size: 15, weight: 500, color: '#ffe4e6' }) },
        border: { show: true, color: '#fbbf24', thickness: 5 },
      },
      content: {
        background: plate({ color: '#2e1065' }),
        decoration: 'circle',
        decorationColor: '#fbbf24',
        watermark: { show: true, opacity: 0.18 },
        headingColor: '#fef3c7',
        bodyColor: '#e0e7ff',
        accentColor: '#fbbf24',
        headingFont: 'Poppins',
        bodyFont: 'Nunito',
        infoCard: { background: '#312e81', border: '#fbbf24', radius: 24, iconColor: '#fbbf24' },
      },
      footer: {
        height: 150,
        layout: 3,
        background: plate({ color: '#1e1b4b' }),
        style: style({ fontFamily: 'Nunito', size: 14, weight: 500, color: '#e0e7ff' }),
        linkColor: '#fbbf24',
        divider: { show: true, color: '#fbbf24', thickness: 3 },
      },
    },
  },
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, incoming) {
  if (!isPlainObject(incoming)) return incoming;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(incoming)) {
    out[key] = isPlainObject(value) ? mergeDeep(out[key], value) : value;
  }
  return out;
}

/** Preset over the current form — anything the preset omits keeps its value. */
export function applyBrandPreset(kit, presetId) {
  const preset = BRAND_PRESET_LIST.find((item) => item.id === presetId);
  if (!preset) return kit;
  return mergeDeep(isPlainObject(kit) ? kit : {}, preset.patch);
}

export default BRAND_PRESET_LIST;
