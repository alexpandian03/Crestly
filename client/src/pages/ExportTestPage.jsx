import React, { useEffect, useRef, useState } from 'react';
import PosterCanvas from '../components/PosterCanvas';
import PosterExportButtons from '../components/PosterExportButtons';
import { exportPoster } from '../utils/exportPoster';

// Helper to generate distinct SVG photo data URIs
function makeTestPhoto(idx, color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${color}" rx="20"/>
    <circle cx="150" cy="110" r="50" fill="#ffffff" opacity="0.9"/>
    <path d="M70 240 C70 180, 230 180, 230 240 Z" fill="#ffffff" opacity="0.9"/>
    <text x="150" y="280" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PHOTO_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#9333EA',
  '#0D9488', '#E11D48', '#4F46E5', '#0891B2', '#CA8A04',
  '#059669', '#7C3AED', '#DB2777', '#EA580C', '#0284C7'
];

export const TEST_BRAND_KIT = {
  orgName: 'தமிழ் கலாச்சார சங்கம்',
  orgNameAlt: 'Tamil Cultural Association',
  logoUrl: makeTestPhoto(0, '#1E40AF', 'தமிழ் சங்கம்'),
  colors: {
    primary: '#1E3A8A',
    secondary: '#3B82F6',
    accent: '#F59E0B',
    background: '#FFFFFF',
    heading: '#111827',
    body: '#374151',
  },
  fonts: {
    heading: 'Noto Sans Tamil',
    body: 'Noto Sans Tamil',
  },
  header: {
    height: 140,
    showLogo: true,
    showOrgName: true,
    style: { background: '#1E3A8A', color: '#FFFFFF' },
  },
  footer: {
    height: 130,
    contactText: 'தொடர்புக்கு: +91 98765 43210 | www.tamilculture.org | கலைவாணர் அரங்கம், சென்னை',
    style: { background: '#111827', color: '#F9FAFB' },
  },
};

// Generate 15 photos placed neatly in a 5x3 grid in the gallery zone
const photoElements = Array.from({ length: 15 }, (_, i) => {
  const col = i % 5;
  const row = Math.floor(i / 5);
  const photoUrl = makeTestPhoto(i + 1, PHOTO_COLORS[i], `கலைஞர் ${i + 1}`);
  const rowY = row === 0 ? 610 : row === 1 ? 775 : 940;
  return {
    id: `photo-${i + 1}`,
    kind: 'image',
    x: 60 + col * 195,
    y: rowY,
    w: 175,
    h: 105,
    imageUrl: photoUrl,
    src: photoUrl,
    url: photoUrl,
    style: { radius: 10, border: '#E5E7EB', borderWidth: 2, opacity: 1 },
  };
});

// Generate 40 text elements (Tamil & English), carefully sized so no clipping occurs
const tamilTexts = [
  { text: 'தமிழ் பாரம்பரிய இசை மற்றும் கலைத் திருவிழா 2026', size: 34, weight: 700, x: 60, y: 155, w: 960, h: 54, color: '#1E3A8A' },
  { text: 'அனைவரும் வருக! அனுமதி இலவசம் — குடும்பத்துடன் கொண்டாடுங்கள்', size: 22, weight: 600, x: 60, y: 218, w: 960, h: 36, color: '#D97706' },
  { text: 'ஞாயிறு, 15 நவம்பர் 2026', size: 20, weight: 600, x: 60, y: 260, w: 460, h: 32, color: '#111827' },
  { text: 'காலை 9:00 முதல் இரவு 9:00 மணி வரை', size: 20, weight: 500, x: 540, y: 260, w: 480, h: 32, color: '#111827' },
  { text: 'இடம்: கலைவாணர் அரங்கம், வாலாஜா சாலை, சென்னை', size: 18, weight: 500, x: 60, y: 298, w: 960, h: 30, color: '#374151' },
  { text: 'சிறப்பு விருந்தினர்: முனைவர் க. சுப்பிரமணியன் (தமிழ் பல்கலைக்கழகம்)', size: 17, weight: 600, x: 60, y: 334, w: 960, h: 28, color: '#1E3A8A' },
  { text: 'நிகழ்ச்சி நிரல் மற்றும் சிறப்பம்சங்கள்', size: 20, weight: 700, x: 60, y: 370, w: 960, h: 32, color: '#1E3A8A' },
  { text: '09:00 AM — மங்கள இசை & திருமுறை விண்ணப்பம்', size: 15, weight: 500, x: 60, y: 408, w: 460, h: 26, color: '#1F2937' },
  { text: '10:30 AM — பாரம்பரிய பரதநாட்டிய நாட்டியாஞ்சலி', size: 15, weight: 500, x: 60, y: 438, w: 460, h: 26, color: '#1F2937' },
  { text: '12:00 PM — கர்நாடக சங்கீத வாய்ப்பாட்டு கச்சேரி', size: 15, weight: 500, x: 60, y: 468, w: 460, h: 26, color: '#1F2937' },
  { text: '02:00 PM — நாட்டுப்புற கலைகள் & சிலம்பாட்டம்', size: 15, weight: 500, x: 540, y: 408, w: 480, h: 26, color: '#1F2937' },
  { text: '04:00 PM — சிறப்பு கவியரங்கம் & பட்டிமன்றம்', size: 15, weight: 500, x: 540, y: 438, w: 480, h: 26, color: '#1F2937' },
  { text: '06:30 PM — மெல்லிசை விழா & விருதுகள் வழங்குதல்', size: 15, weight: 500, x: 540, y: 468, w: 480, h: 26, color: '#1F2937' },
  { text: 'பங்கேற்கும் தலைசிறந்த கலைஞர்கள்', size: 19, weight: 700, x: 60, y: 572, w: 960, h: 30, color: '#1E3A8A' },
  { text: '1. இசைவாணி காயத்ரி', size: 13, weight: 600, x: 60, y: 720, w: 175, h: 44, color: '#111827' },
  { text: '2. நாட்டியமணி சுபஸ்ரீ', size: 13, weight: 600, x: 255, y: 720, w: 175, h: 44, color: '#111827' },
  { text: '3. தவில் செல்வம்', size: 13, weight: 600, x: 450, y: 720, w: 175, h: 44, color: '#111827' },
  { text: '4. நாதஸ்வரம் மணி', size: 13, weight: 600, x: 645, y: 720, w: 175, h: 44, color: '#111827' },
  { text: '5. புல்லாங்குழல் ராகவன்', size: 13, weight: 600, x: 840, y: 720, w: 175, h: 44, color: '#111827' },
  { text: '6. மிருதங்கம் பாலு', size: 13, weight: 600, x: 60, y: 885, w: 175, h: 44, color: '#111827' },
  { text: '7. கடம் சுந்தரேசன்', size: 13, weight: 600, x: 255, y: 885, w: 175, h: 44, color: '#111827' },
  { text: '8. கஞ்சிரா ரமேஷ்', size: 13, weight: 600, x: 450, y: 885, w: 175, h: 44, color: '#111827' },
  { text: '9. வயலின் மீனாட்சி', size: 13, weight: 600, x: 645, y: 885, w: 175, h: 44, color: '#111827' },
  { text: '10. வீணை சாவித்திரி', size: 13, weight: 600, x: 840, y: 885, w: 175, h: 44, color: '#111827' },
  { text: '11. சிலம்பம் சேகர்', size: 13, weight: 600, x: 60, y: 1050, w: 175, h: 44, color: '#111827' },
  { text: '12. கரகாட்டம் காவ்யா', size: 13, weight: 600, x: 255, y: 1050, w: 175, h: 44, color: '#111827' },
  { text: '13. ஒயிலாட்டம் முருகன்', size: 13, weight: 600, x: 450, y: 1050, w: 175, h: 44, color: '#111827' },
  { text: '14. பொய்க்கால் குதிரை வேலு', size: 13, weight: 600, x: 645, y: 1050, w: 175, h: 44, color: '#111827' },
  { text: '15. தப்பாட்டம் சக்தி', size: 13, weight: 600, x: 840, y: 1050, w: 175, h: 44, color: '#111827' },
  { text: 'அனுமதி இலவசம் — பதிவு தேவையில்லை', size: 14, weight: 600, x: 60, y: 502, w: 460, h: 32, color: '#059669' },
  { text: 'வாகன நிறுத்துமிடம் வசதி உண்டு', size: 14, weight: 500, x: 540, y: 502, w: 480, h: 32, color: '#4B5563' },
  { text: 'தமிழ் கலைகள் நமது அடையாளம்', size: 14, weight: 600, x: 60, y: 538, w: 300, h: 28, color: '#1E3A8A' },
  { text: 'பாரம்பரியத்தை காப்போம்', size: 14, weight: 600, x: 380, y: 538, w: 300, h: 28, color: '#1E3A8A' },
  { text: 'கலையை போற்றுவோம்', size: 14, weight: 600, x: 700, y: 538, w: 320, h: 28, color: '#1E3A8A' },
  { text: 'அனைத்து தமிழ் நெஞ்சங்களுக்கும் அன்பான அழைப்பு', size: 16, weight: 600, x: 60, y: 1106, w: 960, h: 28, color: '#1E40AF' },
  { text: 'ஆதரவு: தமிழ்நாடு இயல் இசை நாடக மன்றம்', size: 14, weight: 500, x: 60, y: 1140, w: 460, h: 26, color: '#6B7280' },
  { text: 'இணைப்பு: சென்னை பண்பாட்டு நடுவம்', size: 14, weight: 500, x: 540, y: 1140, w: 480, h: 26, color: '#6B7280' },
  { text: 'ஒழுங்கமைப்பாளர்: திரு. மு. அன்பழகன்', size: 13, weight: 500, x: 60, y: 1172, w: 300, h: 26, color: '#9CA3AF' },
  { text: 'ஒருங்கிணைப்பாளர்: திருமதி. எஸ். ரேவதி', size: 13, weight: 500, x: 380, y: 1172, w: 300, h: 26, color: '#9CA3AF' },
  { text: 'தொழில்நுட்ப உதவி: தமிழ் இணையக் கழகம்', size: 13, weight: 500, x: 700, y: 1172, w: 320, h: 26, color: '#9CA3AF' },
];

const textElements = tamilTexts.map((item, idx) => ({
  id: `text-${idx + 1}`,
  kind: 'text',
  text: item.text,
  x: item.x,
  y: item.y,
  w: item.w,
  h: item.h,
  style: {
    size: item.size,
    weight: item.weight,
    color: item.color,
    fontFamily: 'Noto Sans Tamil',
    lineHeight: 1.4,
  },
}));

export const TEST_TEMPLATE = {
  id: 'tamil-mega-template',
  name: 'Tamil Mega Cultural Poster',
  editorVersion: 2,
  size: { width: 1080, height: 1350 },
  elements: [...photoElements, ...textElements],
};

// ── Acceptance variant ────────────────────────────────────────────────────────
// A lighter fixture for the Playwright acceptance spec. Uses SVG data URIs so
// no network requests are needed. Covers: header portraits, footer bearers,
// guest cards, committee card list rows, Tamil headline.

function makeAcceptancePhoto(idx, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="${color}" rx="10"/>
    <circle cx="100" cy="80" r="40" fill="#fff" opacity="0.8"/>
    <rect x="30" y="140" width="140" height="50" rx="5" fill="#fff" opacity="0.7"/>
    <text x="100" y="175" font-family="sans-serif" font-size="14" fill="${color}" text-anchor="middle" font-weight="bold">Photo ${idx}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ACC_COLORS = ['#1e3a5f', '#c8a84b', '#4f46e5', '#059669', '#dc2626',
                    '#0891b2', '#9333ea', '#ea580c', '#0d9488', '#7c3aed',
                    '#db2777', '#16a34a', '#d97706'];

const PORTRAIT_1 = makeAcceptancePhoto(1, ACC_COLORS[0]);
const PORTRAIT_2 = makeAcceptancePhoto(2, ACC_COLORS[1]);
const PORTRAIT_3 = makeAcceptancePhoto(3, ACC_COLORS[2]);
const PORTRAIT_4 = makeAcceptancePhoto(4, ACC_COLORS[3]);
const GUEST_1    = makeAcceptancePhoto(5, ACC_COLORS[4]);
const GUEST_2    = makeAcceptancePhoto(6, ACC_COLORS[5]);
const FLORAL     = makeAcceptancePhoto(7, ACC_COLORS[6]);
const COMM_PHOTOS = ACC_COLORS.slice(7, 10).map((c, i) => makeAcceptancePhoto(8 + i, c));

export const ACCEPTANCE_BRAND_KIT = {
  orgName: 'இலக்கிய சங்கம்',
  orgNameAlt: 'Literary Society',
  colors: {
    primary: '#1e3a5f',
    secondary: '#c8a84b',
    accent: '#e8d5a3',
    background: '#0b1929',
    heading: '#ffffff',
    body: '#dddddd',
  },
  fonts: { heading: 'Poppins', body: 'Inter' },
  header: { height: 140, showLogo: true, showOrgName: true },
  footer: { height: 130 },
};

export const ACCEPTANCE_TEMPLATE = {
  id: 'acceptance-template',
  name: 'Acceptance Festival Poster',
  editorVersion: 2,
  size: { width: 1080, height: 1350 },
  elements: [
    // Header elements
    { id: 'h-logo', kind: 'field', field: 'logo', x: 20, y: 20, w: 100, h: 100, z: 0, locked: true },
    { id: 'h-orgname', kind: 'text', x: 130, y: 30, w: 500, h: 50, z: 1,
      text: 'இலக்கிய சங்கம்', style: { size: 28, minSize: 14, color: '#ffffff', align: 'left' } },
    { id: 'h-phone', kind: 'text', x: 130, y: 85, w: 300, h: 40, z: 2, variable: true,
      key: 'phone_header', label: 'Phone', hint: 'Contact number', maxLength: 30,
      text: '+91 98765 43210', style: { size: 18, minSize: 12, color: '#dddddd' } },
    { id: 'h-portrait-1', kind: 'image', x: 700, y: 10, w: 80, h: 80, z: 3,
      variable: true, key: 'portrait_1', label: 'Portrait 1',
      imageUrl: PORTRAIT_1, src: PORTRAIT_1, url: PORTRAIT_1, mask: 'circle' },
    { id: 'h-portrait-2', kind: 'image', x: 790, y: 10, w: 80, h: 80, z: 4,
      variable: true, key: 'portrait_2', label: 'Portrait 2',
      imageUrl: PORTRAIT_2, src: PORTRAIT_2, url: PORTRAIT_2, mask: 'circle' },
    { id: 'h-portrait-3', kind: 'image', x: 880, y: 10, w: 80, h: 80, z: 5,
      variable: true, key: 'portrait_3', label: 'Portrait 3',
      imageUrl: PORTRAIT_3, src: PORTRAIT_3, url: PORTRAIT_3, mask: 'circle' },
    { id: 'h-portrait-4', kind: 'image', x: 970, y: 10, w: 80, h: 80, z: 6,
      variable: true, key: 'portrait_4', label: 'Portrait 4',
      imageUrl: PORTRAIT_4, src: PORTRAIT_4, url: PORTRAIT_4, mask: 'circle' },
    // Footer elements
    { id: 'f-bearer-1', kind: 'text', x: 30, y: 1225, w: 300, h: 115, z: 0,
      variable: true, key: 'bearer_1', label: 'Bearer 1',
      text: 'A. Murugan · President', style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' } },
    { id: 'f-bearer-2', kind: 'text', x: 390, y: 1225, w: 300, h: 115, z: 1,
      variable: true, key: 'bearer_2', label: 'Bearer 2',
      text: 'S. Lakshmi · Secretary', style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' } },
    { id: 'f-bearer-3', kind: 'text', x: 750, y: 1225, w: 300, h: 115, z: 2,
      variable: true, key: 'bearer_3', label: 'Bearer 3',
      text: 'R. Senthil · Treasurer', style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' } },
    // Content: floral background
    { id: 'c-floral', kind: 'image', x: 70, y: 145, w: 940, h: 1070, z: -1, locked: true,
      imageUrl: FLORAL, src: FLORAL, url: FLORAL, style: { fit: 'cover', opacity: 0.25 } },
    // Content: headline
    { id: 'c-headline', kind: 'field', field: 'headline', x: 70, y: 160, w: 940, h: 120, z: 1,
      style: { size: 52, minSize: 24, color: '#ffffff', align: 'center' } },
    // Guest cards
    { id: 'c-guest-1', kind: 'image', x: 70, y: 300, w: 420, h: 300, z: 2,
      variable: true, key: 'guest_1', label: 'Guest 1',
      imageUrl: GUEST_1, src: GUEST_1, url: GUEST_1, mask: 'rounded' },
    { id: 'c-guest-2', kind: 'image', x: 590, y: 300, w: 420, h: 300, z: 3,
      variable: true, key: 'guest_2', label: 'Guest 2',
      imageUrl: GUEST_2, src: GUEST_2, url: GUEST_2, mask: 'rounded' },
    // Date and venue
    { id: 'c-date', kind: 'field', field: 'date', x: 70, y: 620, w: 450, h: 60, z: 4,
      style: { size: 24, minSize: 14, color: '#ffffff', align: 'left' } },
    { id: 'c-venue', kind: 'field', field: 'venue', x: 530, y: 620, w: 480, h: 60, z: 5,
      style: { size: 24, minSize: 14, color: '#ffffff', align: 'right' } },
    // Committee: 3 simple image+text groups (no cardlist kind in client renderer)
    { id: 'c-comm-img-1', kind: 'image', x: 70, y: 700, w: 280, h: 180, z: 6,
      imageUrl: COMM_PHOTOS[0], src: COMM_PHOTOS[0], url: COMM_PHOTOS[0] },
    { id: 'c-comm-txt-1', kind: 'text', x: 70, y: 890, w: 280, h: 50, z: 7,
      text: 'கார்த்திக் · Chair', style: { size: 18, minSize: 11, color: '#ffffff', align: 'center' } },
    { id: 'c-comm-img-2', kind: 'image', x: 400, y: 700, w: 280, h: 180, z: 8,
      imageUrl: COMM_PHOTOS[1], src: COMM_PHOTOS[1], url: COMM_PHOTOS[1] },
    { id: 'c-comm-txt-2', kind: 'text', x: 400, y: 890, w: 280, h: 50, z: 9,
      text: 'Priya S. · Co-chair', style: { size: 18, minSize: 11, color: '#ffffff', align: 'center' } },
    { id: 'c-comm-img-3', kind: 'image', x: 730, y: 700, w: 280, h: 180, z: 10,
      imageUrl: COMM_PHOTOS[2], src: COMM_PHOTOS[2], url: COMM_PHOTOS[2] },
    { id: 'c-comm-txt-3', kind: 'text', x: 730, y: 890, w: 280, h: 50, z: 11,
      text: 'Mohamed A. · Secretary', style: { size: 18, minSize: 11, color: '#ffffff', align: 'center' } },
    // Extra text block
    { id: 'c-details', kind: 'text', x: 70, y: 960, w: 940, h: 50, z: 12,
      text: 'Free Entry · Tamil & English Sessions', style: { size: 20, minSize: 14, color: '#e8d5a3', align: 'center' } },
  ],
};

export const ACCEPTANCE_CONTENT = {
  title: 'இலக்கிய விழா 2025',
  tagline: 'A celebration of literature',
  date: '15 Jan 2025',
  time: '10:00 AM',
  venue: 'Town Hall Auditorium',
  extras: {
    phone_header: '+91 98765 43210',
    bearer_1: 'A. Murugan · President',
    bearer_2: 'S. Lakshmi · Secretary',
    bearer_3: 'R. Senthil · Treasurer',
  },
  images: {
    portrait_1: PORTRAIT_1, portrait_2: PORTRAIT_2,
    portrait_3: PORTRAIT_3, portrait_4: PORTRAIT_4,
    guest_1: GUEST_1, guest_2: GUEST_2,
  },
};

export default function ExportTestPage() {
  // Read ?variant=acceptance from the URL to switch fixtures.
  const variant = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('variant')
    : null;
  const isAcceptance = variant === 'acceptance';

  const activeBrandKit   = isAcceptance ? ACCEPTANCE_BRAND_KIT   : TEST_BRAND_KIT;
  const activeTemplate   = isAcceptance ? ACCEPTANCE_TEMPLATE    : TEST_TEMPLATE;
  const activeContent    = isAcceptance ? ACCEPTANCE_CONTENT     : { title: 'தமிழ் பாரம்பரிய இசை மற்றும் கலைத் திருவிழா 2026' };
  const minImagesReady   = isAcceptance ? 10 : 15;

  const [exportState, setExportState] = useState(null);
  const [imagesReady, setImagesReady] = useState(false);
  const canvasNodeRef = useRef(null);

  useEffect(() => {
    // Expose helpers to window for Playwright automation
    window.__posterVariant = variant ?? 'default';
    window.__TEST_TEMPLATE = activeTemplate;
    window.__TEST_BRAND_KIT = activeBrandKit;
    window.__exportPoster = exportPoster;

    window.__checkImages = () => {
      const imgs = Array.from(document.querySelectorAll('#poster-canvas-root img'));
      const total = imgs.length;
      const loaded = imgs.filter((img) => img.complete && img.naturalWidth > 0).length;
      return { total, loaded, allReady: total >= minImagesReady && loaded === total };
    };

    window.__checkClipping = () => {
      const root = document.getElementById('poster-canvas-root');
      if (!root) return { hasClipping: true, reason: 'Root canvas not found' };
      const rootRect = root.getBoundingClientRect();
      const items = Array.from(root.querySelectorAll('[data-element], [data-item-id]'));
      const clipped = [];

      for (const el of items) {
        const id = el.getAttribute('data-element') || el.getAttribute('data-item-id');
        const rect = el.getBoundingClientRect();
        // Check element is within canvas boundaries
        if (rect.left < rootRect.left - 4 || rect.right > rootRect.right + 4 ||
            rect.top < rootRect.top - 4 || rect.bottom > rootRect.bottom + 4) {
          clipped.push({ id, reason: 'boundary overflow', bounds: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, root: rootRect } });
        }
        // Check text content inside is not clipped or overflowing client size
        if (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4) {
          clipped.push({ id, reason: 'internal overflow', scroll: { sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth } });
        }
      }
      return { hasClipping: clipped.length > 0, clippedCount: clipped.length, clipped };
    };

    // Periodically poll for images ready
    const interval = setInterval(() => {
      if (window.__checkImages().allReady) {
        setImagesReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeBrandKit, activeTemplate, minImagesReady, variant]);

  const handleRunExport = async (format = 'png') => {
    try {
      setExportState('exporting');
      const node = document.getElementById('poster-canvas-root');
      if (!node) throw new Error('Canvas root not found');

      const result = await exportPoster(
        node,
        format,
        isAcceptance ? 'acceptance-export' : 'tamil-mega-export',
        activeTemplate.size,
        '#FFFFFF'
      );
      window.__lastExportResult = result;
      setExportState('done');
      return result;
    } catch (err) {
      window.__lastExportError = err;
      setExportState('error');
      throw err;
    }
  };

  return (
    <div className="p-6 bg-[#F3F4F6] min-h-screen">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <header className="flex items-center justify-between bg-white p-4 rounded-md shadow-xs border border-gray-200">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {isAcceptance ? 'Acceptance Poster Export Test' : 'Tamil Mega Poster Export Test Page'}
            </h1>
            <p className="text-xs text-gray-500">
              {isAcceptance
                ? 'Header portraits · Footer bearers · Committee · Tamil + English · Chromium/WebKit'
                : '15 Photos, 40 Text Elements, Tamil Typography, Chromium/Firefox/WebKit Verification'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              data-testid="images-ready-indicator"
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                imagesReady ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {imagesReady ? 'Photos Loaded' : 'Loading Photos...'}
            </span>
            <button
              type="button"
              data-testid="run-export-btn"
              onClick={() => handleRunExport('png')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs"
            >
              Export PNG
            </button>
            <button
              type="button"
              data-testid="run-pdf-btn"
              onClick={() => handleRunExport('pdf')}
              className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs"
            >
              Export PDF
            </button>
            <PosterExportButtons
              brandKit={activeBrandKit}
              template={activeTemplate}
              content={activeContent}
            />
          </div>
        </header>

        <div className="flex justify-center bg-gray-100 p-4 rounded-md overflow-auto border border-gray-300">
          <div
            id="test-canvas-container"
            style={{ width: '1080px', height: '1350px' }}
            className="shadow-xl bg-white"
          >
            <PosterCanvas
              brandKit={activeBrandKit}
              template={activeTemplate}
              content={activeContent}
            />
          </div>
        </div>
        {exportState && (
          <p className={`text-xs text-center ${exportState === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {exportState === 'exporting' && 'Exporting…'}
            {exportState === 'done' && 'Export complete.'}
            {exportState === 'error' && 'Export failed — see console.'}
          </p>
        )}
      </div>
    </div>
  );
}
