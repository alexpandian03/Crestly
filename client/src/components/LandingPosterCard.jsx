import React, { useEffect, useRef, useState } from 'react';
import PosterPreview from './PosterPreview';
import ErrorBoundary from './ErrorBoundary';
import { DEMO_BRAND_KIT, DEMO_TEMPLATE } from '../data/demoPosters';

export default function LandingPosterCard({ poster, onUse, defaultVisible = false }) {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(defaultVisible);

  useEffect(() => {
    if (defaultVisible) {
      setVisible(true);
      return;
    }
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
  }, [defaultVisible]);

  const brandKit = poster?.brandKit || DEMO_BRAND_KIT;
  const template = poster?.template || DEMO_TEMPLATE;

  return (
    <div
      ref={wrapRef}
      className="group relative rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none transition-colors hover:border-[#9CA3AF] flex flex-col"
    >
      <div className="bg-[#FAFAFA] p-3 flex-1 flex flex-col justify-center">
        {visible ? (
          <ErrorBoundary
            fallback={
              <div
                className="aspect-[4/5] rounded-[6px] bg-[#E5E7EB] flex items-center justify-center text-xs text-[#9CA3AF]"
                aria-label="Preview unavailable"
              >
                Preview unavailable
              </div>
            }
          >
            <PosterPreview
              brandKit={brandKit}
              template={template}
              content={poster?.content}
            />
          </ErrorBoundary>
        ) : (
          <div className="aspect-[4/5] rounded-[6px] bg-[#E5E7EB] animate-pulse" aria-hidden />
        )}
      </div>

      <div className="absolute inset-x-0 top-0 bottom-[60px] flex items-end justify-center pb-6 bg-[#111827]/0 group-hover:bg-[#111827]/10 transition-colors pointer-events-none">
        <button
          type="button"
          onClick={() => onUse(poster)}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-[#2563EB] text-white hover:bg-[#1D4ED8] text-xs font-medium px-3.5 py-1.5 rounded-[6px] pointer-events-auto shadow-sm"
        >
          Use this template
        </button>
      </div>

      <div className="p-3 pt-2.5 border-t border-[#F3F4F6] bg-white shrink-0">
        <div className="text-sm font-semibold text-[#111827] truncate" title={poster?.content?.title}>
          {poster?.content?.title}
        </div>
        <div className="text-xs text-[#6B7280] mt-0.5">
          {poster?.category}
        </div>
      </div>

      <p className="sr-only">{poster?.content?.title}, {poster?.category} sample poster</p>
    </div>
  );
}
