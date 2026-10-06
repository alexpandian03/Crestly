import React, { useEffect, useRef, useState } from 'react';
import PosterPreview from './PosterPreview';
import { DEMO_BRAND_KIT, DEMO_TEMPLATE } from '../data/demoPosters';

export default function LandingPosterCard({ poster, onUse }) {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="group relative rounded-card border border-line bg-canvas shadow-soft overflow-hidden transition-transform hover:-translate-y-1"
    >
      <div className="bg-preview p-3">
        {visible ? (
          <PosterPreview brandKit={DEMO_BRAND_KIT} template={DEMO_TEMPLATE} content={poster.content} />
        ) : (
          <div className="aspect-[4/5] rounded-btn bg-line/60 animate-pulse" aria-hidden />
        )}
      </div>
      <div className="absolute inset-0 flex items-end justify-center pb-6 bg-heading/0 group-hover:bg-heading/20 transition-colors">
        <button
          type="button"
          onClick={() => onUse(poster)}
          className="btn-primary opacity-0 group-hover:opacity-100 focus:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
        >
          Use this template
        </button>
      </div>
      <p className="sr-only">{poster.content.title}, {poster.category} sample poster</p>
    </div>
  );
}
