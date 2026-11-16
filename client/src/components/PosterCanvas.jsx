import React from 'react';
import useGoogleFonts from '../hooks/useGoogleFonts';
import { gradientCss, resolvePosterBrand } from '../utils/brandRender';
import { withKitBands } from '../utils/brandBands';
import { pickReadableColor } from '../utils/contrast';
import {
  fontStackFor,
  hasTamil,
  tamilCssOverrides,
} from '../../../shared/textScripts.js';

function BandBackground({ bg }) {
  if (!bg) return null;
  if (bg.type === 'color') {
    return <div style={{ position: 'absolute', inset: 0, backgroundColor: bg.color, zIndex: 0 }} />;
  }
  if (bg.type === 'gradient') {
    return <div style={{ position: 'absolute', inset: 0, background: gradientCss(bg), zIndex: 0 }} />;
  }
  if (bg.type === 'image' && bg.imageUrl) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <img
          src={bg.imageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {bg.overlayOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: bg.overlayColor || '#000000',
              opacity: bg.overlayOpacity,
            }}
          />
        )}
      </div>
    );
  }
  return null;
}

function BrandText({ style = {}, text = '', extra = {} }) {
  if (!text) return null;
  const isTamil = hasTamil(text);
  const stack = fontStackFor(style.fontFamily || 'Outfit', isTamil);
  const overrides = isTamil ? tamilCssOverrides(style.size || 24) : {};

  return (
    <span
      style={{
        fontFamily: stack,
        fontSize: `${style.size || 24}px`,
        fontWeight: style.weight || 600,
        color: style.color || '#ffffff',
        lineHeight: style.lineHeight || 1.2,
        letterSpacing: isTamil ? 'normal' : style.letterSpacing ? `${style.letterSpacing}px` : 'normal',
        textTransform: isTamil ? 'none' : style.uppercase ? 'uppercase' : 'none',
        display: 'inline-block',
        ...overrides,
        ...extra,
      }}
    >
      {text}
    </span>
  );
}

function HeaderBand({ brand }) {
  const h = brand.header;
  if (!h || !h.present) return null;

  const hasBannerImage = h.bg?.type === 'image' && Boolean(h.bg?.imageUrl);
  const bg = hasBannerImage ? { ...h.bg, overlayOpacity: 0 } : h.bg;

  const toAlign = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justify = toAlign[h.alignment] || 'flex-start';

  const logo = !hasBannerImage && h.logo?.show && h.logo?.url ? (
    <img
      src={h.logo.url}
      alt={h.orgName?.text || 'Logo'}
      crossOrigin="anonymous"
      style={{
        height: `${h.logo.pxHeight || 48}px`,
        width: 'auto',
        maxWidth: `${Math.round(h.width * 0.4)}px`,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
      }}
    />
  ) : null;

  const texts = !hasBannerImage ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: justify,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {h.orgName?.show && h.orgName?.text && (
        <BrandText style={h.orgName.style} text={h.orgName.text} extra={{ maxWidth: '100%' }} />
      )}
      {h.tagline?.show && h.tagline?.text && (
        <BrandText style={h.tagline.style} text={h.tagline.text} extra={{ maxWidth: '100%', opacity: 0.9 }} />
      )}
    </div>
  ) : null;

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
        borderBottom: h.border?.show && h.border?.thickness ? `${h.border.thickness}px solid ${h.border.color}` : 'none',
        zIndex: 20,
      }}
    >
      <BandBackground bg={bg} ink={brand.accent} scale={brand.scale} />
      {!hasBannerImage && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: justify,
            gap: `${h.gap}px`,
          }}
        >
          {h.logo?.position !== 'right' && logo}
          {texts}
          {h.logo?.position === 'right' && logo}
        </div>
      )}
    </div>
  );
}

function FooterBand({ brand }) {
  const f = brand.footer;
  if (!f || !f.present) return null;

  const hasBannerImage = f.bg?.type === 'image' && Boolean(f.bg?.imageUrl);
  const bg = hasBannerImage ? { ...f.bg, overlayOpacity: 0 } : f.bg;

  const footerFontSize = Math.max(18, Math.round(f.style?.size || 20));
  const footerSurface = bg?.type === 'color' ? bg.color : (brand.canvas?.color || '#ffffff');
  const safeColor = pickReadableColor([f.style?.color, '#ffffff', '#0b0f17'], footerSurface, 4.5) || f.style?.color || '#ffffff';

  const footerItems = [f.address, f.phone, f.email, f.website].filter(Boolean);

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
        borderTop: f.divider?.show && f.divider?.thickness ? `${f.divider.thickness}px solid ${f.divider.color}` : 'none',
        zIndex: 20,
      }}
    >
      <BandBackground bg={bg} ink={brand.accent} scale={brand.scale} />
      {!hasBannerImage && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            color: safeColor,
            fontSize: `${footerFontSize}px`,
            fontFamily: f.style?.fontFamily || 'Inter',
          }}
        >
          {footerItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: `${f.gap}px`,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {footerItems.map((item, idx) => (
                <span key={idx}>{item}</span>
              ))}
            </div>
          )}
          {f.legalText && (
            <div style={{ fontSize: `${Math.round(footerFontSize * 0.85)}px`, opacity: 0.85 }}>
              {f.legalText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContentTypographyOverlay({ content, brand }) {
  if (!content?.hasTextOverlay) return null;
  const { title, tagline, date, time, venue, details } = content;
  if (!title && !date && !time && !venue && (!details || details.length === 0)) return null;

  const hasTamilTitle = hasTamil(title);
  const headingFont = fontStackFor(brand?.fonts?.heading || 'Outfit', hasTamilTitle);
  const bodyFont = fontStackFor(brand?.fonts?.body || 'Inter', hasTamil(tagline));

  const metaItems = [
    date ? `📅 ${date}` : null,
    time ? `⏰ ${time}` : null,
    venue ? `📍 ${venue}` : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 40px',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Top: Headline & Tagline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px',
        }}
      >
        {title && (
          <h1
            style={{
              fontFamily: headingFont,
              fontSize: title.length > 32 ? '44px' : '56px',
              fontWeight: 800,
              lineHeight: 1.15,
              textTransform: hasTamilTitle ? 'none' : 'uppercase',
              color: '#0F172A',
              margin: 0,
              padding: '8px 24px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              maxWidth: '94%',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </h1>
        )}
        {tagline && (
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: '22px',
              fontWeight: 600,
              color: '#334155',
              margin: 0,
              padding: '4px 16px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              maxWidth: '85%',
            }}
          >
            {tagline}
          </p>
        )}
      </div>

      {/* Bottom: Date/Time/Venue Pill & Highlights */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {metaItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              padding: '10px 24px',
              borderRadius: '9999px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            {metaItems.map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontFamily: bodyFont,
                  fontSize: '19px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {Array.isArray(details) && details.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px',
              maxWidth: '92%',
            }}
          >
            {details.map((detail, idx) => (
              <span
                key={idx}
                style={{
                  fontFamily: bodyFont,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1E293B',
                  backgroundColor: 'rgba(255, 255, 255, 0.94)',
                  padding: '6px 18px',
                  borderRadius: '9999px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                }}
              >
                🎖️ {detail}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PosterCanvas({
  brandKit,
  template,
  content = {},
  showZoneBorders = false,
  className = '',
  style = {},
  exportRef = null,
}) {
  const effectiveTemplate = template || { size: { width: 1080, height: 1350 } };
  const effectiveSections = withKitBands(effectiveTemplate.sections, brandKit, effectiveTemplate);
  const templateWithBands = { ...effectiveTemplate, sections: effectiveSections };

  const brand = resolvePosterBrand(brandKit, templateWithBands);
  const width = effectiveTemplate.size?.width || 1080;
  const height = effectiveTemplate.size?.height || 1350;

  useGoogleFonts(brand.fonts);

  const photoUrl = content?.imageUrl || content?.photoUrl || '';

  return (
    <div
      ref={exportRef}
      className={`poster-canvas relative select-none overflow-hidden ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: brand.canvas?.color || '#ffffff',
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 1. Locked Brand Header Band */}
      <div data-section="header">
        <HeaderBand brand={brand} />
      </div>

      {/* 2. Full-bleed Content Area (AI Image or Blank Box) */}
      <div data-section="content">
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: `${brand.content.y}px`,
            width: `${width}px`,
            height: `${brand.content.h}px`,
            overflow: 'hidden',
            boxSizing: 'border-box',
            backgroundColor: brand.canvas?.color || '#ffffff',
          }}
        >
          {brand.content.watermark?.show && brand.content.watermark?.url && (
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

          {photoUrl ? (
            <img
              src={photoUrl}
              alt={content?.title || 'Poster'}
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center center',
                display: 'block',
                position: 'relative',
                zIndex: 1,
              }}
            />
          ) : null}

          {content?.hasTextOverlay ? (
            <ContentTypographyOverlay content={content} brand={brand} />
          ) : null}
        </div>
      </div>

      {/* 3. Locked Brand Footer Band */}
      <div data-section="footer">
        <FooterBand brand={brand} />
      </div>

      {/* Optional Zone Outlines */}
      {showZoneBorders && (
        <div data-export-ignore="true" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${width}px`,
              height: `${brand.header.height}px`,
              border: '2px dashed #f59e0b',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: `${brand.content.y}px`,
              width: `${width}px`,
              height: `${brand.content.h}px`,
              border: '2px dashed #3b82f6',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: `${brand.footer.top}px`,
              width: `${width}px`,
              height: `${brand.footer.height}px`,
              border: '2px dashed #f59e0b',
            }}
          />
        </div>
      )}
    </div>
  );
}
