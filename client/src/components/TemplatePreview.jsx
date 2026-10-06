import React, { useEffect, useRef, useState } from 'react';
import PosterCanvas from './PosterCanvas';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import { resolveTemplateSize, templateIdOf } from '../utils/templateRender';

/**
 * The one way a template is shown before it belongs to a poster: the real renderer with the
 * items the template actually stores (an older layout is read from its areas by the same rule
 * the poster uses), this client's brand kit and a fixed set of sample words, shrunk with a CSS
 * transform. Card grids, the Create page's picker, the brand kit preview, the version list and
 * the editor's Preview all draw through here, so what an administrator sees in a list is the
 * poster itself and nothing else.
 */

/** Start drawing a poster a little before it is on screen, so scrolling never shows blanks. */
const LAZY_MARGIN = '240px';

/**
 * Two states of one template may never share a drawing, so every preview is keyed by the
 * template's own id plus the version and moment the server saved it.
 */
export function templateSignature(template) {
  if (!template) return 'no-template';
  const id = templateIdOf(template) || template.name || 'template';
  const when = template.updatedAt || template.createdAt || '';
  const items = Array.isArray(template.elements) ? template.elements.length : 0;
  return `${id}|${template.version || 1}|${when}|${items}|${template.editorVersion || 1}`;
}

export default function TemplatePreview({
  template,
  brandKit,
  sample = TEMPLATE_SAMPLE_CONTENT,
  size,
  className = '',
  onOverflow = null,
  eager = false,
  showZoneBorders = false,
}) {
  const boxRef = useRef(null);
  const [visible, setVisible] = useState(eager);
  const [fill, setFill] = useState(0);

  const { width: canvasW, height: canvasH } = resolveTemplateSize(template);
  const signature = templateSignature(template);

  /* A card far down the list costs a full poster render, so it waits until it is nearly in view. */
  useEffect(() => {
    if (eager || visible) return undefined;
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver !== 'function') {
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
    observer.observe(box);
    return () => observer.disconnect();
  }, [eager, visible, signature]);

  /* Without a fixed width the poster fills whatever box it is given, like the preview does. */
  useEffect(() => {
    if (size) return undefined;
    const box = boxRef.current;
    if (!box || typeof ResizeObserver !== 'function') return undefined;
    const measure = () => setFill(box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [size]);

  const shown = size || fill;
  if (!shown || !template) {
    return (
      <div
        ref={boxRef}
        className={`bg-section ${className}`}
        style={{ width: size ? `${size}px` : '100%', aspectRatio: `${canvasW} / ${canvasH}` }}
        aria-hidden="true"
      />
    );
  }

  const scale = shown / canvasW;

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        width: size ? `${size}px` : '100%',
        aspectRatio: `${canvasW} / ${canvasH}`,
      }}
      aria-hidden="true"
    >
      {visible ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${canvasW}px`,
            height: `${canvasH}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <PosterCanvas
            key={signature}
            brandKit={brandKit}
            template={template}
            content={sample}
            onOverflow={onOverflow}
            showZoneBorders={showZoneBorders}
          />
        </div>
      ) : null}
    </div>
  );
}
