import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import useGoogleFonts from '../hooks/useGoogleFonts';

/* ------------------------------------------------------------------ *
 * Design reference: content zone 940 x 1080 (default 1080x1350 poster,
 * 140px header / 130px footer). Every size is a "design unit" that is
 * multiplied by --u at runtime, where --u = formatFactor(k) * fitScale(s).
 * k adapts the type scale to the poster format; s is auto-fitted so the
 * content never overflows and never hides text.
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

function ContentZone({
  zoneW,
  zoneH,
  content,
  brandKit,
  fontsReady,
  onOverflow,
  onImageFail,
  onLayoutSettled,
}) {
  const columnRef = useRef(null);
  const posterImgRef = useRef(null);
  const measureSeqRef = useRef(0);

  const headingFont = `'${brandKit?.fonts?.heading || 'Outfit'}', sans-serif`;
  const bodyFont = `'${brandKit?.fonts?.body || 'Inter'}', sans-serif`;
  const accent = brandKit?.colors?.accent || '#10b981';
  const primary = brandKit?.colors?.primary || '#059669';
  const textColor = brandKit?.colors?.text || '#ffffff';
  const bgColor = brandKit?.colors?.background || '#0b0f17';

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
        color: textColor,
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
          borderRadius: px(DESIGN.radius),
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
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
                  background: `${primary}28`,
                  color: accent,
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
          background: `linear-gradient(to top, ${bgColor} 0%, transparent 42%)`,
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
      {!hasImage && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-18%',
            right: '-22%',
            width: '78%',
            height: '70%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}28 0%, ${primary}14 42%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {!hasImage && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '18%',
            left: '-40%',
            width: '90%',
            height: '42%',
            transform: 'rotate(-18deg)',
            background: `linear-gradient(90deg, ${primary}18 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
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
          color: textColor,
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

export default function PosterCanvas({
  brandKit,
  template,
  content,
  showZoneBorders = false,
  onOverflow = null,
  onImageFail = null,
  onLayoutSettled = null,
}) {
  const headingFont = brandKit?.fonts?.heading || 'Outfit';
  const bodyFont = brandKit?.fonts?.body || 'Inter';
  const fontsReady = useGoogleFonts(headingFont, bodyFont);

  const width = template?.size?.width || 1080;
  const height = template?.size?.height || 1350;
  const zones = template?.zones || [];

  const primaryLogoUrl =
    brandKit?.logos?.find((l) => l.isPrimary)?.url || brandKit?.logos?.[0]?.url;

  const primary = brandKit?.colors?.primary || '#059669';
  const accent = brandKit?.colors?.accent || '#10b981';
  const textColor = brandKit?.colors?.text || '#ffffff';
  const bgColor = brandKit?.colors?.background || '#0b0f17';

  const contentZone = zones.find((z) => z.type === 'content');
  const headerZone = zones.find((z) => z.type === 'header');
  const footerZone = zones.find((z) => z.type === 'footer');

  const headerBottom = headerZone ? headerZone.y + headerZone.h : 0;
  const footerTop = footerZone ? footerZone.y : height;

  /* Content lives in the full band between the locked header and footer. */
  const cZoneX = Math.round(
    clamp(contentZone?.x ?? width * 0.065, width * 0.03, width * 0.12)
  );
  const cZoneW = Math.max(120, width - cZoneX * 2);
  const cZoneY = headerBottom;
  const cZoneH = Math.max(80, footerTop - headerBottom);

  /* Locked brand bands scale their typography with their own band size. */
  const headerK = clamp((headerZone?.h ?? DESIGN.refHeaderH) / DESIGN.refHeaderH, 0.6, 2.4);
  const footerK = clamp((footerZone?.h ?? DESIGN.refFooterH) / DESIGN.refFooterH, 0.6, 2.4);

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
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: `'${bodyFont}', sans-serif`,
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${primary}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '100px',
          left: '-150px',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {headerZone &&
        (() => {
          const align = brandKit?.header?.alignment || 'left';
          const justifyContent =
            align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
          const padX = Math.round(36 * headerK);
          return (
            <div
              style={{
                position: 'absolute',
                left: `${headerZone.x}px`,
                top: `${headerZone.y}px`,
                width: `${headerZone.w}px`,
                height: `${headerZone.h}px`,
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: brandKit?.header?.background || 'rgba(15,23,42,0.95)',
                borderBottom: `${Math.max(2, Math.round(2 * headerK))}px solid ${primary}40`,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: `${padX}px`,
                paddingRight: `${padX}px`,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${Math.round(16 * headerK)}px`,
                  justifyContent,
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {brandKit?.header?.showLogo && primaryLogoUrl && (
                  <img
                    src={primaryLogoUrl}
                    alt={brandKit?.orgName || 'Logo'}
                    crossOrigin="anonymous"
                    style={{
                      maxHeight: `${Math.round(64 * headerK)}px`,
                      maxWidth: `${Math.round(200 * headerK)}px`,
                      objectFit: 'contain',
                      flexShrink: 0,
                    }}
                  />
                )}
                {brandKit?.header?.showOrgName && (
                  <span
                    style={{
                      fontFamily: `'${headingFont}', sans-serif`,
                      fontWeight: 800,
                      fontSize: `${Math.round(20 * headerK)}px`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: textColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {brandKit?.orgName || 'Brand Organization'}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

      <div
        style={{
          position: 'absolute',
          left: `${cZoneX}px`,
          top: `${cZoneY}px`,
          width: `${cZoneW}px`,
          height: `${cZoneH}px`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <ContentZone
          zoneW={cZoneW}
          zoneH={cZoneH}
          content={content}
          brandKit={brandKit}
          fontsReady={fontsReady}
          onOverflow={onOverflow}
          onImageFail={onImageFail}
          onLayoutSettled={onLayoutSettled}
        />
      </div>

      {footerZone && (
        <div
          style={{
            position: 'absolute',
            left: `${footerZone.x}px`,
            top: `${footerZone.y}px`,
            width: `${footerZone.w}px`,
            height: `${footerZone.h}px`,
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: brandKit?.footer?.background || 'rgba(11,15,23,0.98)',
            borderTop: `${Math.max(2, Math.round(2 * footerK))}px solid ${primary}30`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: `${Math.round(36 * footerK)}px`,
            paddingRight: `${Math.round(36 * footerK)}px`,
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: `${Math.round(13 * footerK)}px`,
              letterSpacing: '0.04em',
              opacity: 0.85,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${Math.round(16 * footerK)}px`,
                minWidth: 0,
              }}
            >
              {brandKit?.footer?.website && (
                <span style={{ fontWeight: 600, color: accent }}>{brandKit.footer.website}</span>
              )}
              {brandKit?.footer?.contactText && <span>{brandKit.footer.contactText}</span>}
            </div>
            {brandKit?.footer?.socials?.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: `${Math.round(12 * footerK)}px`,
                  opacity: 0.7,
                }}
              >
                {brandKit.footer.socials.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
            )}
          </div>
          {brandKit?.footer?.legalText && (
            <div
              style={{
                fontSize: `${Math.round(11 * footerK)}px`,
                opacity: 0.45,
                marginTop: `${Math.round(6 * footerK)}px`,
                textAlign: 'center',
              }}
            >
              {brandKit.footer.legalText}
            </div>
          )}
        </div>
      )}

      {showZoneBorders && (
        <div data-export-ignore="true" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
          {headerZone && (
            <div
              style={{
                position: 'absolute',
                left: headerZone.x,
                top: headerZone.y,
                width: headerZone.w,
                height: headerZone.h,
                ...outline('#f59e0b'),
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: cZoneX,
              top: cZoneY,
              width: cZoneW,
              height: cZoneH,
              ...outline('#3b82f6'),
            }}
          />
          {footerZone && (
            <div
              style={{
                position: 'absolute',
                left: footerZone.x,
                top: footerZone.y,
                width: footerZone.w,
                height: footerZone.h,
                ...outline('#f59e0b'),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
