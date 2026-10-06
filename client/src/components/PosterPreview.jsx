import React, { useRef, useState, useEffect } from 'react';
import PosterCanvas from './PosterCanvas';

/**
 * <PosterPreview /> Component
 *
 * Responsive wrapper that scales the 1:1 high-resolution <PosterCanvas />
 * to fit the available container width using CSS transform (scale).
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
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.4);
  const [containerWidth, setContainerWidth] = useState(450);

  const canvasWidth = template?.size?.width || 1080;
  const canvasHeight = template?.size?.height || 1350;

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
        />
      </div>
    </div>
  );
}
