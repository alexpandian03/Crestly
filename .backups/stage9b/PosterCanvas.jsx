import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import useGoogleFonts from '../hooks/useGoogleFonts';
import SocialIcon from './SocialIcon';
import { alpha, gradientCss, patternLayer, resolvePosterBrand } from '../utils/brandRender';

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

function ContentZone({ zoneW, zoneH, content, brand, fontsReady, onOverflow, onImageFail, onLayoutSettled }) {
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

  const posterImgUrl = (content?.imageUrl || content?.image || '').trim();
  const titleText = (content?.title || '').trim();
  const taglineText = (content?.tagline || '').trim();
  const detailsArr = (
    Array.isArray(content?.details)
      ? content.details
      : content?.details
        ? [content.details]
        : []
  )
    .map((d) => String(d).trim())
    .filter(Boolean)
    .slice(0, 4);

  const infoItems = [
    content?.date && { key: 'date', icon: <Calendar />, label: 'Date', value: String(content.date).trim() },
    content?.time && { key: 'time', icon: <Clock />, label: 'Time', value: String(content.time).trim() },
    content?.venue && { key: 'venue', icon: <MapPin />, label: 'Venue', value: String(content.venue).trim() },
  ].filter((i) => i && i.value);

  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = !!posterImgUrl && !imageFailed;

  /* Format model: k folds the poster format into one unit multiplier. */
  const gridMode = zoneW / zoneH >= WIDE_RATIO;
  const k = clamp(Math.min(zoneW / DESIGN.refZoneW, zoneH / DESIGN.refZoneH), 0.45, 3);
  const imageSizing = imageSizingFor(zoneW, zoneH, k, gridMode);
  const infoCtx = { zoneW, k, gridMode, infoCount: infoItems.length };

  const [fit, setFit] = useState(() => ({
    s: S_MAX,
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
      s: S_MAX,
      imgH: posterImgUrl ? imageSizing.imgH0 : 0,
      g: 1,
      overflow: false,
    });
    // imageSizing derives from zoneW/zoneH, which are listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterImgUrl, zoneW, zoneH]);

  const contentKey = [
    titleText,
    taglineText,
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

    const maxSAt = (imgH, g) => {
      if (!fitsAt(S_HARD, imgH, g)) return null;
      if (fitsAt(S_MAX, imgH, g)) return S_MAX;
      let lo = S_HARD;
      let hi = S_MAX;
      let bestS = S_HARD;
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
    if (fitsAt(S_MAX, topImg, GAP_FACTORS[0])) {
      /* Absolute best case: max text, max image, loose gaps. */
      best = { s: S_MAX, imgH: topImg, g: GAP_FACTORS[0] };
    } else {
      /* Prefer max text scale; on ties keep the bigger image, then looser gaps. */
      for (const imgH of imgSteps) {
        for (const g of GAP_FACTORS) {
          const s = maxSAt(imgH, g);
          if (s == null) continue;
          const better =
            !best ||
            s > best.s + 0.001 ||
            (Math.abs(s - best.s) <= 0.001 && imgH > best.imgH) ||
            (Math.abs(s - best.s) <= 0.001 && imgH === best.imgH && g > best.g);
          if (better) best = { s, imgH, g };
        }
      }
    }

    let overflow = false;
    if (!best) {
      const imgH = hasImage ? imgSteps[imgSteps.length - 1] : 0;
      const g = GAP_FACTORS[GAP_FACTORS.length - 1];
      apply(S_HARD, imgH, g);
      best = { s: S_HARD, imgH, g };
      overflow = true;
    } else if (hasImage && best.s >= S_MAX - 0.001) {
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

    if (posterImgUrl && !imageFailed) {
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
  }, [fontsReady, zoneW, zoneH, contentKey]);

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
  const gapU = (n) => `calc(${n}px * var(--u) * var(--g))`;

  const committedCols = infoColsFor(fit.s, infoCtx);
  const spanLast = infoItems.length > 1 && committedCols > 1 && infoItems.length % committedCols === 1;

  const taglineBlock = taglineText ? (
    <div
      style={{
        fontSize: px(DESIGN.tagline),
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: accent,
        lineHeight: 1.1,
        overflowWrap: 'anywhere',
        flexShrink: 0,
      }}
    >
      {taglineText}
    </div>
  ) : null;

  const titleBlock = titleText ? (
    <h1
      style={{
        margin: 0,
        fontFamily: headingFont,
        fontSize: px(hasImage ? DESIGN.title : DESIGN.titleNoImage),
        fontWeight: 800,
        lineHeight: 1.06,
        letterSpacing: '-0.02em',
        color: headingColor,
        textWrap: 'balance',
        overflowWrap: 'anywhere',
        flexShrink: 0,
      }}
    >
      {titleText}
    </h1>
  ) : null;

  const infoBlock =
    infoItems.length > 0 ? (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(var(--info-cols), minmax(0, 1fr))',
          gap: px(hasImage ? 14 : 20),
          padding: px(hasImage ? 18 : 24),
          borderRadius: card.radius == null ? px(DESIGN.radius) : px(card.radius),
          background: card.background,
          border: `1px solid ${card.border}`,
          color: card.textColor,
          flexShrink: 0,
        }}
      >
        {infoItems.map(({ key, icon, label, value }, i) => {
          const isLast = i === infoItems.length - 1;
          return (
            <div
              key={key}
              data-info-item="true"
              {...(isLast ? { 'data-info-last': 'true' } : {})}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: px(14),
                minWidth: 0,
                ...(isLast && spanLast ? { gridColumn: '1 / -1' } : {}),
              }}
            >
              <div
                style={{
                  width: px(DESIGN.iconBox),
                  height: px(DESIGN.iconBox),
                  borderRadius: px(14),
                  background: card.iconBg,
                  color: card.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {React.cloneElement(icon, {
                  style: { width: px(22), height: px(22) },
                })}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: px(DESIGN.infoLabel),
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: 0.55,
                    lineHeight: 1,
                    marginBottom: px(4),
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: px(hasImage ? DESIGN.infoValueCompact : DESIGN.infoValue),
                    fontWeight: 600,
                    lineHeight: 1.22,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  const imageBlock = hasImage ? (
    <div
      style={{
        height: 'var(--img-h)',
        minHeight: 'var(--img-h)',
        maxHeight: 'var(--img-h)',
        width: '100%',
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
          objectFit: 'cover',
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

  const detailsBlock =
    detailsArr.length > 0 ? (
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: gapU(hasImage ? 10 : 14),
          opacity: 0.88,
          flexShrink: 0,
        }}
      >
        {detailsArr.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: px(14),
              fontSize: px(hasImage ? DESIGN.details : DESIGN.detailsNoImage),
              lineHeight: 1.42,
            }}
          >
            <span
              style={{
                width: px(10),
                height: px(10),
                borderRadius: '50%',
                background: accent,
                flexShrink: 0,
                marginTop: 'calc(17.7px * var(--u))',
              }}
            />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item}</span>
          </li>
        ))}
      </ul>
    ) : null;

  const laneStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: gapU(DESIGN.gap),
    minWidth: 0,
    justifyContent: 'safe center',
  };

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
      {c.decoration === 'legacy'
        ? !hasImage && <LegacyDecor accent={accent} primary={brand.primary} />
        : c.decoration !== 'none' && (
            <ContentDecoration kind={c.decoration} color={c.decorationColor} scale={brand.scale} />
          )}

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
          justifyContent: 'safe center',
          gap: gapU(DESIGN.gap),
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
              {taglineBlock}
              {titleBlock}
              {infoBlock}
            </div>
            {imageBlock || detailsBlock ? (
              <div style={laneStyle}>
                {imageBlock}
                {detailsBlock}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {taglineBlock}
            {titleBlock}
            {infoBlock}
            {imageBlock}
            {detailsBlock}
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

  const typography = textStyleCss(f.style);
  const iconSize = Math.round(Math.max(12, f.style.size * 1.15));
  const cellGap = Math.max(4, Math.round(f.style.size * 0.45));

  const socialIcons = f.social.length ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(f.style.size * 0.9)}px`, color: f.linkColor, flexShrink: 0 }}>
      {f.social.map((s) => (
        <SocialIcon key={`${s.platform}-${s.url}`} platform={s.platform} size={iconSize} />
      ))}
    </div>
  ) : null;

  const legacySocialText = !f.social.length && f.legacySocials.length ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${f.gap}px`, opacity: 0.72 }}>
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
        ...textStyleCss({ ...f.style, size: Math.max(8, Math.round(f.style.size * 0.85)) }),
        display: 'block',
        opacity: 0.55,
        marginTop: Math.max(2, Math.round(f.style.size * 0.4)),
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
}) {
  const brand = useMemo(() => resolvePosterBrand(brandKit, template), [brandKit, template]);

  const extraFonts = useMemo(() => brand.fonts.filter(Boolean), [brand.fonts]);
  const fontsReady = useGoogleFonts(brand.content.fonts.heading, brand.content.fonts.body, extraFonts);

  const width = template?.size?.width || 1080;
  const height = template?.size?.height || 1350;
  const zones = template?.zones || [];
  const headerZone = zones.find((z) => z?.type === 'header');
  const footerZone = zones.find((z) => z?.type === 'footer');

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
          />
        </div>
      </div>

      <FooterBand brand={brand} />

      {showZoneBorders && (
        <div data-export-ignore="true" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
          {headerZone && (
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
          {footerZone && (
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
        </div>
      )}
    </div>
  );
}
