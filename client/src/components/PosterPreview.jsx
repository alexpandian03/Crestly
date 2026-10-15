import React, { useRef, useState, useEffect } from 'react';
import PosterCanvas from './PosterCanvas';

/** Start drawing a poster preview when near the viewport (240px) */
const LAZY_MARGIN = '240px';

/**
 * <PosterPreview /> Component
 *
 * Responsive wrapper that scales the 1:1 high-resolution <PosterCanvas />
 * to fit the available container width using CSS transform (scale).
 * Lazy-renders on screen only (via IntersectionObserver) unless eager=true or exportRef is attached.
 */
export default function PosterPreview({
  brandKit,
  template,
  content,
  showZoneBorders = false,
  onOverflow = null,
  onImageFail = null,
  onLayoutSettled = null,
  view = null,
  className = '',
  exportRef = null,   // ref to the inner full-res canvas div (used for export)
  eager = false,
  showPlaceholders = false,
  highlightSlotKey = null,
  onSlotClick = null,
  isThumbnail = false,
  isExporting = false,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  const [containerWidth, setContainerWidth] = useState(450);
  const [visible, setVisible] = useState(eager || !!exportRef);

  const canvasWidth = template?.size?.width || 1080;
  const canvasHeight = template?.size?.height || 1350;

  // Lazy-render on screen only: wait until the preview is near the viewport
  useEffect(() => {
    if (eager || visible || exportRef) return undefined;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver !== 'function') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible, exportRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
        const computedScale = width / canvasWidth;
        setScale(computedScale);
      }
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasWidth]);

  const scaledHeight = Math.round(canvasHeight * scale);
  const leftOffset = Math.max(0, Math.round((containerWidth - canvasWidth * scale) / 2));

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none transition-all duration-150 ${className}`}
      style={{
        height: `${scaledHeight}px`,
        minHeight: '200px',
      }}
    >
      {visible ? (
        <div
          ref={exportRef}
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: `${leftOffset}px`,
          }}
        >
          <PosterCanvas
            brandKit={brandKit}
            template={template}
            content={content}
            showZoneBorders={showZoneBorders}
            onOverflow={onOverflow}
            onImageFail={onImageFail}
            onLayoutSettled={onLayoutSettled}
            view={view}
            showPlaceholders={showPlaceholders}
            highlightSlotKey={highlightSlotKey}
            onSlotClick={onSlotClick}
            isThumbnail={isThumbnail}
            isExporting={isExporting}
          />
        </div>
      ) : (
        <div
          className="w-full h-full bg-[#FAFAFA] flex items-center justify-center animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
