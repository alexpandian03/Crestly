import React from 'react';
import PosterCanvas from './PosterCanvas';
import { resolveTemplateSize } from '../utils/templateRender';

/**
 * A template drawn at a fixed pixel width: the real renderer, scaled down.
 * Used by the template grid and the layout picker so both show what the
 * layout actually does rather than an icon.
 */
export default function TemplateThumb({ brandKit, template, content, width = 96, className = '' }) {
  const { width: canvasW, height: canvasH } = resolveTemplateSize(template);
  const scale = width / canvasW;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width: `${width}px`, height: `${Math.round(canvasH * scale)}px` }}
      aria-hidden="true"
    >
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
        <PosterCanvas brandKit={brandKit} template={template} content={content} />
      </div>
    </div>
  );
}
