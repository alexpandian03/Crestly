import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import useGoogleFonts from '../hooks/useGoogleFonts';
import SocialIcon from './SocialIcon';
import { alpha, gradientCss, patternLayer, resolvePosterBrand } from '../utils/brandRender';
import { pickReadableColor } from '../utils/contrast';
import {
  readableItems,
  resolveTemplateRender,
  templateElements,
  usesTemplateElements,
} from '../utils/templateRender';
import { resolveStyleTokens } from '../../../shared/templateElements.js';
import PosterElementLayer, { isSamplePlaceholder } from './PosterElementLayer';

/* ------------------------------------------------------------------ *
 * Design reference: content zone 940 x 1080 (default 1080x1350 poster,
 * 140px header / 130px footer). Every size is a "design unit" that is
 * multiplied by --u at runtime, where --u = formatFactor(k) * fitScale(s).
 * k adapts the type scale to the poster format; s is auto-fitted so the
 * content never overflows and never hides text.
 *
 * Brand styling (header/footer bands, content surface, typography) is
 * resolved in utils/brandRender so this file stays presentational.
 * ------------------------------------------------------------------ */
const DESIGN = {
  refZoneW: 940,
  refZoneH: 1080,
  refHeaderH: 140,
  refFooterH: 130,
  tagline: 30,
  title: 96,
  titleNoImage: 120,
  infoLabel: 20,
  infoValue: 44,
  infoValueCompact: 34,
  details: 32,
  detailsNoImage: 34,
  gap: 38,
  padding: 48,
  radius: 24,
  iconBox: 52,
  laneGap: 36,
  infoColMin: 340,
};

const S_MAX = 1.12;
const S_HARD = 0.42;
const SEARCH_STEPS = 12;
const TOLERANCE = 4;
const GAP_FACTORS = [1, 0.82, 0.64];
const WIDE_RATIO = 1.45;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function waitForImg(img) {
  return new Promise((resolve) => {
    if (!img) {
      resolve('none');
      return;
    }

    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      resolve(status);
    };

    const okOrFail = () => finish(img.naturalWidth > 0 ? 'ok' : 'fail');

    const t = setTimeout(okOrFail, 8000);
    img.addEventListener(
      'load',
      () => {
        clearTimeout(t);
        okOrFail();
      },
      { once: true }
    );
    img.addEventListener(
      'error',
      () => {
        clearTimeout(t);
        finish('fail');
      },
      { once: true }
    );

    if (typeof img.decode === 'function') {
      img
        .decode()
        .then(() => {
          clearTimeout(t);
          okOrFail();
        })
        .catch(() => {
          /* load/error/timeout still pending */
        });
    } else if (img.complete && img.naturalWidth > 0) {
      clearTimeout(t);
      finish('ok');
    }
  });
}

/* Height the column actually needs, measured from laid-out children
 * (offsetHeight is immune to the preview's CSS transform scaling). */
function requiredHeight(el, padPx) {
  let maxBottom = 0;
  for (const child of el.children) {
    if (!child.offsetHeight) continue;
    maxBottom = Math.max(maxBottom, child.offsetTop + child.offsetHeight);
  }
  return maxBottom + padPx;
}

/* Adaptive number of info columns for the available width at scale s. */
function infoColsFor(s, { zoneW, k, gridMode, infoCount }) {
  const padPx = DESIGN.padding * k * s;
  const innerW = Math.max(0, zoneW - padPx * 2);
  const laneW = gridMode
    ? Math.max(0, innerW - DESIGN.laneGap * k * s) * (1.25 / 2.25)
    : innerW;
  return clamp(Math.floor(laneW / (DESIGN.infoColMin * k * s)), 1, Math.max(1, infoCount));
}

/* Reserved image block sizing for the current format. */
function imageSizingFor(zoneW, zoneH, k, gridMode) {
  const u0 = k * S_MAX;
  const padPx = DESIGN.padding * u0;
  const innerW = Math.max(0, zoneW - padPx * 2);
  const laneW = gridMode
    ? Math.max(0, innerW - DESIGN.laneGap * u0) * (1 / 2.25)
    : innerW;
  const target = Math.min(zoneH * (gridMode ? 0.42 : 0.32), laneW * 0.5);
  const imgH0 = Math.round(clamp(target, 220 * u0, 560 * u0));
  const imgFloor = Math.round(clamp(imgH0 * 0.42, 140 * u0, imgH0));
  const imgCap = Math.round(Math.max(imgH0, Math.min(zoneH * (gridMode ? 0.62 : 0.46), 620 * u0)));
  return { imgH0, imgFloor, imgCap };
}

function imageStepsFor(imgH0, imgFloor) {
  const steps = [
    ...new Set(
      [imgH0, Math.round(imgH0 * 0.8), Math.round(imgH0 * 0.62), imgFloor].filter((h) => h >= imgFloor)
    ),
  ];
  return steps.sort((a, b) => b - a);
}

/* A template's photo rectangle is the size the renderer aims for; it may only
 * shrink when the text cannot fit beside it. */
function imageSizingFromRect(rect, k) {
  const imgH0 = Math.max(Math.round(80 * k), rect.h);
  const imgFloor = Math.round(Math.max(60 * k, imgH0 * 0.42));
  return { imgH0, imgFloor, imgCap: imgH0 };
}

/* ---------------------------- brand pieces ---------------------------- */

/** Colour, gradient, image+overlay and CSS pattern, layered for one band. */
function BandBackground({ bg, ink, scale = 1 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = bg.type === 'image' && Boolean(bg.imageUrl);
  const showImage = hasImage && !imageFailed;
  /* A replaced photo must be tried again, not stay hidden from the old failure. */
  useEffect(() => setImageFailed(false), [bg.imageUrl]);
  const plate =
    bg.type === 'gradient'
      ? gradientCss(bg)
      : bg.type === 'pattern'
        ? bg.color
        : bg.color;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: plate }} />
      {bg.pattern !== 'none' && (
        <div style={{ position: 'absolute', inset: 0, ...patternLayer(bg.pattern, ink || bg.color, scale) }} />
      )}
      {showImage && (
        <img
          src={bg.imageUrl}
          alt=""
          crossOrigin="anonymous"
          onError={() => setImageFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: bg.position,
            display: 'block',
          }}
        />
      )}
      {bg.type === 'image' && bg.overlayOpacity > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: alpha(bg.overlayColor, bg.overlayOpacity) }} />
      )}
    </div>
  );
}

/** The accent shapes a poster can carry behind its text. */
function ContentDecoration({ kind, color, scale }) {
  if (kind === 'band') {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-12%',
          right: '-12%',
          top: '16%',
          height: '26%',
          transform: 'rotate(-12deg)',
          background: `linear-gradient(90deg, ${alpha(color, 0.2)} 0%, ${alpha(color, 0.07)} 62%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }
  if (kind === 'circle') {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-16%',
          bottom: '-14%',
          width: '62%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(color, 0.24)} 0%, ${alpha(color, 0.08)} 46%, transparent 72%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }
  if (kind === 'corners') {
    const ring = {
      position: 'absolute',
      width: '46%',
      aspectRatio: '1',
      borderRadius: '50%',
      border: `${Math.max(2, Math.round(4 * scale))}px solid ${alpha(color, 0.45)}`,
      pointerEvents: 'none',
      zIndex: 0,
    };
    return (
      <>
        <div aria-hidden="true" style={{ ...ring, top: '-20%', left: '-14%' }} />
        <div aria-hidden="true" style={{ ...ring, bottom: '-20%', right: '-14%' }} />
      </>
    );
  }
  return null;
}

/** Old poster look: two soft accent shapes when there is no photo. */
function LegacyDecor({ accent, primary }) {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-18%',
          right: '-22%',
          width: '78%',
          height: '70%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(accent, 0.16)} 0%, ${alpha(primary, 0.08)} 42%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '18%',
          left: '-40%',
          width: '90%',
          height: '42%',
          transform: 'rotate(-18deg)',
          background: `linear-gradient(90deg, ${alpha(primary, 0.09)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </>
  );
}

const textStyleCss = (style, extra = {}) => ({
  fontFamily: `'${style.fontFamily}', sans-serif`,
  fontSize: `${style.size}px`,
  fontWeight: style.weight,
  color: style.color,
  lineHeight: 1.18,
  letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
  textTransform: style.uppercase ? 'uppercase' : 'none',
  margin: 0,
  ...extra,
});

function BrandText({ style, text, extra = {} }) {
  return (
    <span style={textStyleCss(style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, ...extra })}>
      {text}
    </span>
  );
}

/* ------------------------------ content ------------------------------ */

function ContentZone({
  zoneW,
  zoneH,
  content,
  brand,
  fontsReady,
  onOverflow,
  onImageFail,
  onLayoutSettled,
  layout,
  image = null,
  imageOutside = false,
  fontCap = S_MAX,
  fontFloor = S_HARD,
  photoFit = null,
}) {
  const columnRef = useRef(null);
  const posterImgRef = useRef(null);
  const measureSeqRef = useRef(0);

  const c = brand.content;
  const headingFont = `'${c.fonts.heading}', sans-serif`;
  const bodyFont = `'${c.fonts.body}', sans-serif`;
  const accent = c.accentColor;
  const headingColor = c.headingColor;
  const card = c.card;
  const plateColor = c.bg.type === 'color' || c.bg.type === 'pattern' ? c.bg.color : brand.canvas.color;

  /* Template layout, already normalised (missing fields fall back to defaults). */
  const align = layout.alignment;
  const centered = align === 'center';
  const spacing = layout.spacingFactor;
  const infoStyle = layout.infoStyle;
  const declaredImage = Boolean(image);

  const posterImgUrl = (content?.imageUrl || content?.image || '').trim();
  const titleText = (content?.title || '').trim();
  const kickerRaw = (content?.extras?.title_sub || content?.kicker || '').trim();
  const kickerText = isSamplePlaceholder(kickerRaw) ? '' : kickerRaw;
  const subtitleRaw = (content?.tagline || content?.subtitle || '').trim();
  const subtitleText = isSamplePlaceholder(subtitleRaw) ? '' : subtitleRaw;
  const detailsArr = (
    Array.isArray(content?.details)
      ? content.details
      : content?.details
        ? [content.details]
        : []
  )
    .map((d) => String(d).trim())
    .filter(Boolean)
    .slice(0, 3);

  const infoItems = [
    { key: 'date', icon: <Calendar />, label: 'Date', value: String(content?.date || '').trim() || 'Date to be announced' },
    { key: 'time', icon: <Clock />, label: 'Time', value: String(content?.time || '').trim() || 'Time to be announced' },
    { key: 'venue', icon: <MapPin />, label: 'Venue', value: String(content?.venue || '').trim() || 'Venue to be announced' },
  ];

  const [imageFailed, setImageFailed] = useState(false);
  /* A photo rectangle outside the text column is painted by the canvas itself,
   * so the column neither reserves room for it nor waits for it to load. The
   * same flag covers a template that turns its photo area off. */
  const wantsFlowImage = Boolean(posterImgUrl) && !imageOutside;
  const hasImage = wantsFlowImage && !imageFailed;

  /* Format model: k folds the poster format into one unit multiplier. A
   * template that declares a photo area places it by layout.imagePlacement,
   * so the wide-format two-lane mode only applies to templates without one. */
  const k = clamp(Math.min(zoneW / DESIGN.refZoneW, zoneH / DESIGN.refZoneH), 0.45, 3);
  const gridMode = !declaredImage && zoneW / zoneH >= WIDE_RATIO;
  const imageSizing = declaredImage ? imageSizingFromRect(image, k) : imageSizingFor(zoneW, zoneH, k, gridMode);
  const maxFitScale = Math.min(S_MAX, fontCap);
  const infoCtx = { zoneW, k, gridMode, infoCount: infoItems.length };

  const [fit, setFit] = useState(() => ({
    s: maxFitScale,
    imgH: posterImgUrl ? imageSizing.imgH0 : 0,
    g: 1,
    overflow: false,
  }));

  const overflowCbRef = useRef(onOverflow);
  overflowCbRef.current = onOverflow;
  const imageFailCbRef = useRef(onImageFail);
  imageFailCbRef.current = onImageFail;
  const settledCbRef = useRef(onLayoutSettled);
  settledCbRef.current = onLayoutSettled;

  /* Reset the committed fit whenever the content image or format changes. */
  useLayoutEffect(() => {
    setImageFailed(false);
    setFit({
      s: maxFitScale,
      imgH: posterImgUrl ? imageSizing.imgH0 : 0,
      g: 1,
      overflow: false,
    });
    // imageSizing derives from zoneW/zoneH, which are listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterImgUrl, zoneW, zoneH, maxFitScale]);

  const contentKey = [
    titleText,
    subtitleText,
    posterImgUrl,
    detailsArr.join('\n'),
    infoItems.map((i) => `${i.key}:${i.value}`).join('|'),
    imageFailed ? 'F' : 'K',
  ].join('§');

  const runFitSearch = () => {
    const el = columnRef.current;

    const apply = (s, imgH, g) => {
      const cols = infoColsFor(s, infoCtx);
      el.style.setProperty('--u', String(k * s));
      el.style.setProperty('--img-h', `${imgH}px`);
      el.style.setProperty('--g', String(g));
      el.style.setProperty('--info-cols', String(cols));

      const lastInfo = el.querySelector('[data-info-last]');
      if (lastInfo) {
        const span = infoItems.length > 1 && cols > 1 && infoItems.length % cols === 1;
        lastInfo.style.gridColumn = span ? '1 / -1' : 'auto';
      }

      /* Measure start-aligned so centering never distorts the height. */
      const prevJustify = el.style.justifyContent;
      el.style.justifyContent = 'flex-start';
      const required = requiredHeight(el, DESIGN.padding * k * s);
      el.style.justifyContent = prevJustify;
      return required;
    };

    const fitsAt = (s, imgH, g) => apply(s, imgH, g) <= zoneH + TOLERANCE;

    /* cap = the template's maxFont, hard = never smaller than this or the text
     * would be unreadable, floor = the template's minFont preference. */
    const cap = maxFitScale;
    const hard = Math.min(S_HARD, fontFloor);
    const belowFloor = (s) => s < fontFloor - 0.001;

    const maxSAt = (imgH, g) => {
      if (!fitsAt(hard, imgH, g)) return null;
      if (fitsAt(cap, imgH, g)) return cap;
      let lo = hard;
      let hi = cap;
      let bestS = hard;
      for (let i = 0; i < SEARCH_STEPS; i += 1) {
        const mid = (lo + hi) / 2;
        if (fitsAt(mid, imgH, g)) {
          bestS = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return bestS;
    };

    const imgSteps = hasImage ? imageStepsFor(imageSizing.imgH0, imageSizing.imgFloor) : [0];
    const topImg = imgSteps[0];

    let best = null;
    if (fitsAt(cap, topImg, GAP_FACTORS[0])) {
      /* Absolute best case: max text, max image, loose gaps. */
      best = { s: cap, imgH: topImg, g: GAP_FACTORS[0] };
    } else {
      /* Prefer text at the template's ceiling; on ties keep the bigger image,
       * then looser gaps. A scale under the template's minFont only wins when
       * nothing at minFont fits - hiding text is worse than small text. */
      for (const imgH of imgSteps) {
        for (const g of GAP_FACTORS) {
          const s = maxSAt(imgH, g);
          if (s == null) continue;
          const better =
            !best ||
            (!belowFloor(s) && belowFloor(best.s)) ||
            (belowFloor(s) === belowFloor(best.s) &&
              (s > best.s + 0.001 ||
                (Math.abs(s - best.s) <= 0.001 && imgH > best.imgH) ||
                (Math.abs(s - best.s) <= 0.001 && imgH === best.imgH && g > best.g)));
          if (better) best = { s, imgH, g };
        }
      }
    }

    let overflow = false;
    if (!best) {
      const imgH = hasImage ? imgSteps[imgSteps.length - 1] : 0;
      const g = GAP_FACTORS[GAP_FACTORS.length - 1];
      apply(hard, imgH, g);
      best = { s: hard, imgH, g };
      overflow = true;
    } else if (hasImage && best.s >= cap - 0.001 && !declaredImage) {
      /* Text is maxed out and space is left: let the image absorb it. */
      const slack = zoneH - apply(best.s, best.imgH, best.g);
      if (slack > 20 * k * best.s) {
        const growTo = Math.min(imageSizing.imgCap, Math.round(best.imgH + slack * 0.55));
        if (growTo > best.imgH + 4 && apply(best.s, growTo, best.g) <= zoneH + TOLERANCE) {
          best = { ...best, imgH: growTo };
        } else {
          apply(best.s, best.imgH, best.g);
        }
      }
    }

    return { s: best.s, imgH: hasImage ? best.imgH : 0, g: best.g, overflow };
  };

  const measure = useCallback(async () => {
    const el = columnRef.current;
    if (!el || !fontsReady) return;

    const seq = measureSeqRef.current + 1;
    measureSeqRef.current = seq;

    await document.fonts.ready;
    if (measureSeqRef.current !== seq) return;

    if (wantsFlowImage && !imageFailed) {
      const img = posterImgRef.current;
      if (!img) {
        requestAnimationFrame(() => {
          if (measureSeqRef.current === seq) measure();
        });
        return;
      }
      const status = await waitForImg(img);
      if (measureSeqRef.current !== seq) return;
      if (status === 'fail') {
        setImageFailed(true);
        imageFailCbRef.current?.();
        return;
      }
    }

    const result = runFitSearch();
    setFit(result);
    overflowCbRef.current?.(
      result.overflow,
      result.overflow ? 'This poster is too full. Shorten the title or details.' : null
    );
    settledCbRef.current?.({ overflow: result.overflow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady, zoneW, zoneH, contentKey, maxFitScale, fontFloor, declaredImage, spacing]);

  useLayoutEffect(() => {
    let cancelled = false;

    const run = () => {
      if (!cancelled) measure();
    };

    run();

    const onFontDone = () => run();
    if (document.fonts?.addEventListener) {
      document.fonts.addEventListener('loadingdone', onFontDone);
    }

    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', onFontDone);
    };
  }, [measure, zoneW, zoneH, fontsReady]);

  const px = (n) => `calc(${n}px * var(--u))`;
  const gapU = (n) => `calc(${n}px * var(--u) * var(--g) * ${spacing})`;
  const blockAlign = centered ? 'center' : 'stretch';

  /* layout.itemOffsets: the nudge the builder put on one word group, in poster pixels.
   * A shift is painted, never re-laid-out, so it cannot change how the text auto-fits. */
  const shift = (key) => {
    const offset = layout.itemOffsets?.[key];
    if (!offset || (!offset.dx && !offset.dy)) return null;
    return { transform: `translate(${offset.dx}px, ${offset.dy}px)` };
  };
  const shifted = (key, style) => {
    const extra = shift(key);
    return extra ? { ...style, ...extra } : style;
  };

  const committedCols = 3;

  const kickerBlock = kickerText ? (
    <div
      data-item="kicker"
      style={shifted('kicker', {
        fontSize: px(22),
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: accent,
        lineHeight: 1.1,
        overflowWrap: 'anywhere',
        flexShrink: 0,
        marginBottom: px(16),
      })}
    >
      {kickerText}
    </div>
  ) : null;

  const titleBlock = titleText ? (
    <h1
      data-item="headline"
      style={shifted('headline', {
        margin: 0,
        fontFamily: headingFont,
        fontSize: px(hasImage ? (titleText.length > 36 ? 68 : 80) : (titleText.length > 36 ? 80 : 96)),
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: '-0.02em',
        color: headingColor,
        textWrap: 'balance',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        flexShrink: 0,
        marginBottom: subtitleText ? px(16) : 0,
      })}
    >
      {titleText}
    </h1>
  ) : null;

  const subtitleBlock = subtitleText ? (
    <div
      data-item="subtitle"
      style={shifted('subtitle', {
        fontSize: px(28),
        fontWeight: 600,
        lineHeight: 1.25,
        color: c.bodyColor,
        opacity: 0.9,
        overflowWrap: 'anywhere',
        flexShrink: 0,
      })}
    >
      {subtitleText}
    </div>
  ) : null;

  const imageBlock = hasImage ? (
    <div
      data-item="photo"
      style={{
        height: 'var(--img-h)',
        minHeight: 'var(--img-h)',
        maxHeight: 'var(--img-h)',
        width: image ? `${image.w}px` : '100%',
        maxWidth: image ? undefined : '100%',
        marginLeft: image ? `calc(${image.x}px - ${DESIGN.padding}px * var(--u))` : undefined,
        alignSelf: image ? 'flex-start' : undefined,
        borderRadius: px(DESIGN.radius),
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      <img
        ref={posterImgRef}
        src={posterImgUrl}
        alt=""
        crossOrigin="anonymous"
        style={{
          width: '100%',
          height: '100%',
          objectFit: photoFit === 'contain' ? 'contain' : 'cover',
          display: 'block',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `linear-gradient(to top, ${plateColor} 0%, transparent 42%)`,
        }}
      />
    </div>
  ) : null;

  const titleGroup = (kickerBlock || titleBlock || subtitleBlock) ? (
    <div
      data-item="title-group"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: centered ? 'center' : 'flex-start',
        textAlign: align,
        width: '100%',
        flexShrink: 0,
        marginTop: imageBlock ? px(32) : 0,
      }}
    >
      {kickerBlock}
      {titleBlock}
      {subtitleBlock}
    </div>
  ) : null;

  const infoBlock = (
    <div
      data-item="info"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: px(16),
        width: '100%',
        marginTop: px(48),
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {infoItems.map(({ key, icon, label, value }) => (
        <div
          key={key}
          data-info-item="true"
          data-item={key}
          style={shifted(key, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: `${px(18)} ${px(14)}`,
            borderRadius: px(12),
            border: `1px solid ${alpha(brand.primary, 0.22)}`,
            background: alpha(brand.primary, 0.06),
            color: c.bodyColor,
            minWidth: 0,
            boxSizing: 'border-box',
          })}
        >
          <div style={{ color: brand.primary, marginBottom: px(8), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(icon, { style: { width: px(28), height: px(28) } })}
          </div>
          <div
            style={{
              fontSize: px(20),
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              opacity: 0.65,
              lineHeight: 1,
              marginBottom: px(6),
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: px(32),
              fontWeight: 700,
              lineHeight: 1.18,
              color: headingColor,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              maxWidth: '100%',
              textAlign: 'center',
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );

  const dateStr = String(content?.date || '').trim();
  const dayMatch = dateStr.match(/\b([0-2]?[1-9]|3[01])\b/);
  const dayNumber = dayMatch ? dayMatch[1] : null;
  const monthMatch = dateStr.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  const monthStr = monthMatch ? monthMatch[1].toUpperCase() : '';

  const hasRoom = zoneW >= 600;

  const bulletsNode = detailsArr.length > 0 ? (
    <ul
      data-item="details"
      style={shifted('details', {
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: px(14),
        justifyContent: 'center',
        flex: 1,
      })}
    >
      {detailsArr.map((item, idx) => (
        <li
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: px(12),
            fontSize: px(24),
            lineHeight: 1.35,
            color: c.bodyColor,
          }}
        >
          <span
            style={{
              width: px(10),
              height: px(10),
              borderRadius: '50%',
              background: accent,
              flexShrink: 0,
              marginTop: px(10),
            }}
          />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item}</span>
        </li>
      ))}
    </ul>
  ) : null;

  const highlightNode = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: `${px(20)} ${px(16)}`,
        borderRadius: px(12),
        border: `1px solid ${alpha(brand.primary, 0.22)}`,
        background: alpha(brand.primary, 0.05),
        boxSizing: 'border-box',
        height: '100%',
        minHeight: px(120),
      }}
    >
      {dayNumber ? (
        <>
          <div style={{ fontSize: px(72), fontWeight: 800, lineHeight: 1, color: brand.primary }}>
            {dayNumber}
          </div>
          <div style={{ fontSize: px(20), fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: headingColor, marginTop: px(8) }}>
            {monthStr || 'SPECIAL EVENT'}
          </div>
        </>
      ) : (
        <div style={{ fontSize: px(24), fontWeight: 700, fontStyle: 'italic', lineHeight: 1.3, color: headingColor }}>
          "Every drop counts. Be someone's lifeline today."
        </div>
      )}
    </div>
  );

  const bulletsAndHighlightBlock = (bulletsNode || hasRoom) ? (
    <div
      data-item="details-highlight-group"
      style={{
        width: '100%',
        marginTop: px(40),
        flexShrink: 0,
        boxSizing: 'border-box',
        ...(hasRoom ? {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
          gap: px(20),
          alignItems: 'stretch',
        } : {
          display: 'flex',
          flexDirection: 'column',
          alignItems: centered ? 'center' : 'stretch',
        }),
      }}
    >
      {bulletsNode}
      {hasRoom ? highlightNode : null}
    </div>
  ) : null;

  const ctaLine = (content?.extras?.cta_line || '').trim();
  const brandContact = [
    brand.footer?.phone ? `Call ${brand.footer.phone}` : null,
    brand.footer?.email,
    brand.footer?.website,
  ].filter(Boolean).join('  ·  ');
  const ctaBarText = brandContact
    ? `Register at the front desk  |  ${brandContact}`
    : (content?.extras?.cta_button || 'Register at the front desk  |  Contact staff for details');

  const ctaBlock = (
    <div
      data-item="cta"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        marginTop: px(40),
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {ctaLine ? (
        <div
          style={{
            fontSize: px(20),
            fontWeight: 600,
            color: headingColor,
            marginBottom: px(12),
            textAlign: 'center',
          }}
        >
          {ctaLine}
        </div>
      ) : null}
      <div
        style={{
          width: '100%',
          padding: `${px(14)} ${px(24)}`,
          background: brand.primary,
          color: '#ffffff',
          borderRadius: px(20),
          fontWeight: 700,
          fontSize: px(20),
          letterSpacing: '0.04em',
          textAlign: 'center',
          boxSizing: 'border-box',
          userSelect: 'none',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {ctaBarText}
      </div>
    </div>
  );

  const laneStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: gapU(DESIGN.gap),
    minWidth: 0,
    justifyContent: 'safe center',
  };

  /* layout.decoration wins over the brand's own accent shapes. */
  const decoration =
    layout.decoration !== 'none' ? (
      <ContentDecoration kind={layout.decoration} color={accent} scale={brand.scale} />
    ) : c.decoration === 'legacy' ? (
      !hasImage && <LegacyDecor accent={accent} primary={brand.primary} />
    ) : (
      c.decoration !== 'none' && (
        <ContentDecoration kind={c.decoration} color={c.decorationColor} scale={brand.scale} />
      )
    );

  return (
    <div
      style={{
        width: `${zoneW}px`,
        height: `${zoneH}px`,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {decoration}

      <div
        ref={columnRef}
        style={{
          '--u': String(k * fit.s),
          '--img-h': `${hasImage ? fit.imgH : 0}px`,
          '--g': String(fit.g),
          '--info-cols': String(committedCols),
          width: `${zoneW}px`,
          height: `${zoneH}px`,
          padding: px(DESIGN.padding),
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: blockAlign,
          textAlign: align,
          color: c.bodyColor,
          fontFamily: bodyFont,
          position: 'relative',
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        {gridMode ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.25fr 1fr',
              columnGap: px(DESIGN.laneGap),
              width: '100%',
            }}
          >
            <div style={laneStyle}>
              {titleGroup}
              {infoBlock}
            </div>
            <div style={laneStyle}>
              {imageBlock}
              {bulletsAndHighlightBlock}
              {ctaBlock}
            </div>
          </div>
        ) : (
          <>
            {imageBlock}
            {titleGroup}
            {infoBlock}
            {bulletsAndHighlightBlock}
            {ctaBlock}
          </>
        )}
      </div>

      {fit.overflow ? (
        <div
          data-export-ignore="true"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.92)',
            color: '#0b0f17',
            fontWeight: 700,
            fontSize: 11,
            pointerEvents: 'none',
          }}
        >
          Content is too long
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- header ------------------------------- */

function HeaderBand({ brand }) {
  const h = brand.header;
  if (!h.present) return null;

  const toAlign = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justify = toAlign[h.alignment];
  const vertical = h.logo.position === 'top' || h.logo.position === 'bottom';
  const textStackAlign = vertical ? justify : h.alignment;

  const logo = h.logo.show ? (
    <img
      src={h.logo.url}
      alt={h.orgName.text || 'Logo'}
      crossOrigin="anonymous"
      style={{
        height: `${h.logo.pxHeight}px`,
        width: 'auto',
        maxWidth: `${Math.round(h.width * 0.6)}px`,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
      }}
    />
  ) : null;

  const texts = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: textStackAlign,
        gap: Math.max(2, Math.round(h.orgName.style.size * 0.22)),
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {h.orgName.show && h.orgName.text && (
        <BrandText style={h.orgName.style} text={h.orgName.text} extra={{ maxWidth: '100%' }} />
      )}
      {h.tagline.show && (
        <BrandText style={h.tagline.style} text={h.tagline.text} extra={{ maxWidth: '100%', opacity: 0.92 }} />
      )}
    </div>
  );

  const before = h.logo.position === 'bottom' || h.logo.position === 'right';
  const inner = (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: vertical ? justify : 'center',
        justifyContent: vertical ? 'center' : justify,
        gap: `${h.gap}px`,
        width: '100%',
        minWidth: 0,
      }}
    >
      {logo && before ? <React.Fragment>{logo}</React.Fragment> : null}
      {texts}
      {logo && !before ? <React.Fragment>{logo}</React.Fragment> : null}
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: `${h.left}px`,
        top: `${h.top}px`,
        width: `${h.width}px`,
        height: `${h.height}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: `${h.padX}px`,
        paddingRight: `${h.padX}px`,
        borderBottom: h.border.show && h.border.thickness ? `${h.border.thickness}px solid ${h.border.color}` : 'none',
        zIndex: 20,
      }}
    >
      <BandBackground bg={h.bg} ink={brand.content.decorationColor} scale={brand.scale} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', minWidth: 0 }}>{inner}</div>
    </div>
  );
}

/* ------------------------------- footer ------------------------------- */

function FooterBand({ brand }) {
  const f = brand.footer;
  if (!f.present) return null;

  const footerFontSize = Math.max(20, Math.round(f.style.size || 20));
  const footerSurface = f.bg?.type === 'color' ? f.bg.color : (brand.canvas.color || '#ffffff');
  const safeColor = pickReadableColor([f.style.color, '#ffffff', '#0b0f17'], footerSurface, 4.5) || f.style.color;
  const typography = textStyleCss({ ...f.style, size: footerFontSize, color: safeColor });
  const iconSize = Math.max(20, Math.round(footerFontSize * 1.15));
  const cellGap = Math.max(8, Math.round(footerFontSize * 0.45));

  const socialIcons = f.social.length ? (
    <div key="socials" style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(footerFontSize * 0.9)}px`, color: f.linkColor, flexShrink: 0 }}>
      {f.social.map((s) => (
        <SocialIcon key={`${s.platform}-${s.url}`} platform={s.platform} size={iconSize} />
      ))}
    </div>
  ) : null;

  const legacySocialText = !f.social.length && f.legacySocials.length ? (
    <div key="legacy-socials" style={{ display: 'flex', alignItems: 'center', gap: `${f.gap}px`, opacity: 0.72 }}>
      {f.legacySocials.map((s) => (
        <span key={s}>{s}</span>
      ))}
    </div>
  ) : null;

  const website = f.website ? <span key="site" style={{ color: f.linkColor, fontWeight: 600 }}>{f.website}</span> : null;

  const columns = [];
  if (f.legacyPresentation) {
    /* Pre-style kits kept the single contact line plus written handles. */
    const left = [website, f.legacyContact ? <span key="contact">{f.legacyContact}</span> : null].filter(Boolean);
    if (left.length) columns.push(left);
    if (legacySocialText) columns.push([legacySocialText]);
  } else {
    const groups = [
      f.address ? [<span key="addr">{f.address}</span>] : null,
      f.phone || f.email ? [<span key="reach">{[f.phone, f.email].filter(Boolean).join('  ·  ')}</span>] : null,
      website || socialIcons ? [website, socialIcons].filter(Boolean) : null,
    ].filter(Boolean);

    if (groups.length <= 1) columns.push(groups.flat());
    else if (f.layout === 3) groups.forEach((group) => columns.push(group));
    else {
      columns.push(groups.slice(0, groups.length - 1).flat());
      columns.push(groups[groups.length - 1]);
    }
  }

  const legal = f.legalText ? (
    <div
      style={{
        ...textStyleCss({ ...f.style, size: Math.max(20, Math.round(footerFontSize * 0.9)), color: safeColor }),
        display: 'block',
        opacity: 0.85,
        marginTop: Math.max(4, Math.round(footerFontSize * 0.3)),
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {f.legalText}
    </div>
  ) : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${f.left}px`,
        top: `${f.top}px`,
        width: `${f.width}px`,
        height: `${f.height}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: `${f.padX}px`,
        paddingRight: `${f.padX}px`,
        borderTop: f.divider.show && f.divider.thickness ? `${f.divider.thickness}px solid ${f.divider.color}` : 'none',
        zIndex: 20,
      }}
    >
      <BandBackground bg={f.bg} ink={brand.content.decorationColor} scale={brand.scale} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', minWidth: 0 }}>
        <div
          style={{
            ...typography,
            display: 'flex',
            alignItems: 'center',
            justifyContent: columns.length > 1 ? 'space-between' : 'center',
            gap: `${f.gap}px`,
            width: '100%',
            minWidth: 0,
          }}
        >
          {columns.map((cells, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${cellGap}px`,
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {cells}
            </div>
          ))}
        </div>
        {legal}
      </div>
    </div>
  );
}

/* ------------------------------ canvas ------------------------------ */

export default function PosterCanvas({
  brandKit,
  template,
  content,
  showZoneBorders = false,
  onOverflow = null,
  onImageFail = null,
  onLayoutSettled = null,
  /* Size and photo-shape changes the Create page makes on screen. They are never saved
   * with the poster; they only decide how the poster is drawn right now, in the preview,
   * in the downloaded file and in the card picture alike. */
  view = null,
  isEditor = false,
}) {
  const effectiveBrandKit = content?.design?.brandKit || brandKit;
  const effectiveTemplate = template || content?.design?.template;
  const brand = useMemo(() => resolvePosterBrand(effectiveBrandKit, effectiveTemplate), [effectiveBrandKit, effectiveTemplate]);
  const rendered = useMemo(() => resolveTemplateRender(effectiveTemplate), [effectiveTemplate]);

  /* A poster always carries the locked header and footer from its own brand kit. If one
   * is missing here, the brand layer was lost somewhere upstream, so say so loudly while
   * developing and stay quiet in the shipped app. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const missing = [!brand.header.present && 'header', !brand.footer.present && 'footer'].filter(Boolean);
    if (missing.length === 0) return;
    console.error(
      `PosterCanvas: this poster is rendering without its ${missing.join(' and ')}. The locked brand layer is missing.`
    );
  }, [brand.header.present, brand.footer.present]);

  /* A template that carries items of its own is drawn from those items; everything
   * saved before the editor keeps the flow layout it has always had. */
  const items = useMemo(() => {
    if (!usesTemplateElements(effectiveTemplate)) return null;
    const placed = templateElements(effectiveTemplate, effectiveBrandKit).map((item) =>
      resolveStyleTokens(item, effectiveBrandKit)
    );
    const sizes = view?.sizes;
    const fit = view?.photoFit;
    const blankFits = view?.blankFits;
    const drawn =
      !sizes && !fit && !blankFits
        ? placed
        : placed.map((item) => {
            const size = item.kind === 'field' ? sizes?.[item.field] : undefined;
            const isPhoto = item.kind === 'image' || item.field === 'photo';
            /* A filled-in picture can be shown whole or filling its box, this one only. */
            const blankFit = item.kind === 'image' && item.variable ? blankFits?.[item.id] : undefined;
            if (!size && !(isPhoto && fit) && !blankFit) return item;
            return {
              ...item,
              style: {
                ...item.style,
                ...(size ? { size } : {}),
                ...(isPhoto && fit ? { fit } : {}),
                ...(blankFit ? { fit: blankFit } : {}),
              },
            };
          });
    /* The design's own colour wins whenever it reads; only a colour that would be hard
     * to see on the pill, plate or background behind it is exchanged for a brand one. */
    return readableItems(drawn, {
      surface: brand.content.surface,
      candidates: [
        brand.content.headingColor,
        brand.content.bodyColor,
        brand.content.accentColor,
        '#ffffff',
        '#0b0f17',
      ],
    }).items;
  }, [effectiveTemplate, effectiveBrandKit, view, brand]);

  /* Only the faces this poster really draws: active brand bands, plus placed items
   * showing words (or content fonts when using the flow layout).
   * Brand tokens are resolved, and unknown or token strings are never sent to Google Fonts. */
  const usedFonts = useMemo(() => {
    const list = [];
    if (brand.header.present) {
      if (brand.header.orgName?.show) list.push(brand.header.orgName.style?.fontFamily);
      if (brand.header.tagline?.show) list.push(brand.header.tagline.style?.fontFamily);
    }
    if (brand.footer.present) {
      list.push(brand.footer.style?.fontFamily);
    }
    if (items) {
      for (const item of items) {
        if (item.kind === 'field' || item.kind === 'text') {
          list.push(item.style?.fontFamily);
        }
      }
    } else {
      list.push(brand.content.fonts.heading);
      list.push(brand.content.fonts.body);
    }
    return [...new Set(list.filter((f) => typeof f === 'string' && f.trim() && !f.startsWith('brand:')))];
  }, [brand, items]);
  const fontsReady = useGoogleFonts(usedFonts[0] || '', usedFonts[1] || '', usedFonts.slice(2));

  /* The flow layout announces when it is done fitting. Placed items announce it through
   * this layer, once nothing is resizing any more. */
  const [itemsFitted, setItemsFitted] = useState(false);
  const handleItemFitted = useCallback(() => setItemsFitted(true), []);
  useEffect(() => setItemsFitted(false), [items]);

  /* An item whose words will not fit even at its smallest size. The note sits outside the
   * poster itself, so no export can ever carry it. */
  const [itemsOverflow, setItemsOverflow] = useState(false);
  const handleItemOverflow = useCallback(
    (isOverflow, message) => {
      setItemsOverflow(Boolean(isOverflow));
      onOverflow?.(isOverflow, message);
    },
    [onOverflow]
  );

  useEffect(() => {
    if (items && itemsFitted) onLayoutSettled?.({ overflow: false });
  }, [items, itemsFitted, onLayoutSettled]);

  const width = rendered.size.width;
  const height = rendered.size.height;

  /* The photo rectangle either sits inside the text column (band in the flow)
   * or outside it (its own block on the canvas). */
  const contentBox = { x: brand.content.x, y: brand.content.y, w: brand.content.w, h: brand.content.h };
  const imageZone = rendered.zones.image;
  const imageInsideBox =
    imageZone && imageZone.y >= contentBox.y - 2 && imageZone.y + imageZone.h <= contentBox.y + contentBox.h + 2;
  const imageLocal = imageInsideBox
    ? { x: imageZone.x - contentBox.x, y: imageZone.y - contentBox.y, w: imageZone.w, h: imageZone.h }
    : null;
  const imageAbsolute = imageZone && !imageInsideBox ? imageZone : null;

  /* Same unit the content column uses, so the zone's font range is in poster px. */
  const unitK = clamp(
    Math.min(contentBox.w / DESIGN.refZoneW, contentBox.h / DESIGN.refZoneH),
    0.45,
    3
  );
  /* The largest the text column may start at: the template's own ceiling, or the smaller
   * size the user stepped down to on the Create page. */
  const capFont = clamp(
    Number.isFinite(view?.wholeMax) ? Math.min(view.wholeMax, rendered.fonts.maxFont) : rendered.fonts.maxFont,
    rendered.fonts.minFont,
    rendered.fonts.maxFont
  );
  const photoFit = view?.photoFit || null;

  const fontCap = clamp(capFont / (DESIGN.details * unitK), S_HARD, S_MAX);
  const fontFloor = clamp(rendered.fonts.minFont / (DESIGN.details * unitK), S_HARD, S_MAX);

  const [outsideImageFailed, setOutsideImageFailed] = useState(false);
  useEffect(() => setOutsideImageFailed(false), [imageZone?.w, imageZone?.h, content?.imageUrl, content?.image]);

  /* The brand's photo takes the poster over when the content has none. */
  const photoUrl = (content?.imageUrl || content?.image || '').trim() || brand.content.defaultImageUrl;
  const contentForCanvas = photoUrl === (content?.imageUrl || content?.image || '').trim() ? content : { ...content, imageUrl: photoUrl };

  const outline = (color) =>
    showZoneBorders
      ? {
          outline: `2px dashed ${color}`,
          outlineOffset: '-2px',
        }
      : {};

  return (
    /* The poster, then the notes an editor may show beside it. Only the node carrying
     * this id is ever drawn or exported, so a note can never end up in a finished poster. */
    <>
    <div
      id="poster-canvas-root"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        backgroundColor: brand.canvas.color,
        color: brand.content.bodyColor,
        fontFamily: `'${brand.content.fonts.body}', sans-serif`,
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}
    >
      {!brand.canvas.bgUntouched && (
        <BandBackground bg={brand.canvas.bg} ink={brand.content.decorationColor} scale={brand.scale} />
      )}

      {brand.content.bgFullBleed && (
        <BandBackground bg={brand.content.bg} ink={brand.content.decorationColor} scale={brand.scale} />
      )}

      {/* A brand's pattern is one whisper across the whole poster, edge to edge and behind
          everything - never a fill inside the text box or an item, and never over words. */}
      {brand.content.pattern !== 'none' && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            ...patternLayer(brand.content.pattern, brand.content.patternColor, brand.scale),
          }}
        />
      )}

      {brand.content.decoration === 'legacy' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -150,
              right: -150,
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(brand.primary, 0.13)} 0%, transparent 70%)`,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 100,
              left: -150,
              width: 550,
              height: 550,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(brand.accent, 0.07)} 0%, transparent 70%)`,
            }}
          />
        </div>
      )}

      <HeaderBand brand={brand} />

      <div
        style={{
          position: 'absolute',
          left: `${brand.content.x}px`,
          top: `${brand.content.y}px`,
          width: `${brand.content.w}px`,
          height: `${brand.content.h}px`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {!brand.content.bgUntouched && !brand.content.bgFullBleed && (
          <BandBackground bg={brand.content.bg} ink={brand.content.decorationColor} scale={brand.scale} />
        )}

        {brand.content.watermark.show && (
          <img
            src={brand.content.watermark.url}
            alt=""
            crossOrigin="anonymous"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '56%',
              height: 'auto',
              objectFit: 'contain',
              opacity: brand.content.watermark.opacity,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {!items && (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <ContentZone
              zoneW={brand.content.w}
              zoneH={brand.content.h}
              content={contentForCanvas}
              brand={brand}
              fontsReady={fontsReady}
              onOverflow={onOverflow}
              onImageFail={onImageFail}
              onLayoutSettled={onLayoutSettled}
              layout={rendered.layout}
              image={imageLocal}
              imageOutside={Boolean(imageAbsolute) || rendered.layout.hidePhoto}
              fontCap={fontCap}
              fontFloor={fontFloor}
              photoFit={photoFit}
            />
          </div>
        )}
      </div>

      {items && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none' }}>
          <PosterElementLayer
            elements={items}
            content={contentForCanvas}
            photoUrl={photoUrl}
            fontsReady={fontsReady}
            onOverflow={handleItemOverflow}
            onFitted={handleItemFitted}
            isEditor={isEditor}
            onImageFail={onImageFail}
          />
        </div>
      )}

      {!items && imageAbsolute && photoUrl && !outsideImageFailed && (
        <div
          data-item="photo"
          style={{
            position: 'absolute',
            left: `${imageAbsolute.x}px`,
            top: `${imageAbsolute.y}px`,
            width: `${imageAbsolute.w}px`,
            height: `${imageAbsolute.h}px`,
            borderRadius: Math.round(24 * brand.scale),
            overflow: 'hidden',
            zIndex: 12,
          }}
        >
          <img
            src={photoUrl}
            alt=""
            crossOrigin="anonymous"
            onError={() => setOutsideImageFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: photoFit === 'contain' ? 'contain' : 'cover',
              display: 'block',
            }}
          />
        </div>
      )}

      <FooterBand brand={brand} />

      {showZoneBorders && (
        <div data-export-ignore="true" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
          {brand.header.present && (
            <div
              style={{
                position: 'absolute',
                left: brand.header.left,
                top: brand.header.top,
                width: brand.header.width,
                height: brand.header.height,
                ...outline('#f59e0b'),
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: brand.content.x,
              top: brand.content.y,
              width: brand.content.w,
              height: brand.content.h,
              ...outline('#3b82f6'),
            }}
          />
          {brand.footer.present && (
            <div
              style={{
                position: 'absolute',
                left: brand.footer.left,
                top: brand.footer.top,
                width: brand.footer.width,
                height: brand.footer.height,
                ...outline('#f59e0b'),
              }}
            />
          )}
          {imageZone && (
            <div
              style={{
                position: 'absolute',
                left: imageZone.x,
                top: imageZone.y,
                width: imageZone.w,
                height: imageZone.h,
                ...outline('#22c55e'),
              }}
            />
          )}
          {/* A design built from a recipe has no areas of its own - every word and mark sits
              in a box the design chose, so those boxes are what the outlines show here. */}
          {(items || []).map((item) => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                width: item.w,
                height: item.h,
                ...outline('#f472b6'),
              }}
            />
          ))}
        </div>
      )}
    </div>

      {items && itemsOverflow ? (
        <div
          data-export-ignore="true"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 60,
            padding: `${Math.max(4, Math.round(4 * brand.scale))}px ${Math.max(8, Math.round(10 * brand.scale))}px`,
            borderRadius: 999,
            background: 'rgba(245,158,11,0.92)',
            color: '#0b0f17',
            fontWeight: 700,
            fontSize: Math.max(11, Math.round(11 * brand.scale)),
            pointerEvents: 'none',
          }}
        >
          Words do not fit
        </div>
      ) : null}
    </>
  );
}
