import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import PosterCanvas from './PosterCanvas';
import { exportPoster } from '../utils/exportPoster';
import { canvasBaseColor } from '../utils/brandRender';

const FORMATS = [
  { id: 'png', label: 'PNG' },
  { id: 'jpg', label: 'JPG' },
  { id: 'pdf', label: 'PDF' },
];

export default function PosterExportButtons({ brandKit, template, content, orgName, view = null }) {
  const [exporting, setExporting] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const effectiveBrandKit = content?.design?.brandKit || brandKit;
  const effectiveTemplate = template || content?.design?.template;
  const width = effectiveTemplate?.size?.width || 1080;
  const height = effectiveTemplate?.size?.height || 1350;
  const bgColor = canvasBaseColor(effectiveBrandKit, effectiveTemplate);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleExport = async (format) => {
    if (exporting) return;
    setExporting(format);
    setOpen(false);

    const org = (orgName || effectiveBrandKit?.orgName || 'poster').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const title = (content?.title || 'poster').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${org}-${title}`.replace(/-+/g, '-').slice(0, 60);

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -10000px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      z-index: -1;
      pointer-events: none;
    `;
    document.body.appendChild(container);

    let settleResolve;
    const settled = new Promise((resolve) => {
      settleResolve = resolve;
    });

    try {
      await new Promise((resolve) => {
        ReactDOM.render(
          <PosterCanvas
            brandKit={effectiveBrandKit}
            template={effectiveTemplate}
            content={content}
            view={view}
            onLayoutSettled={settleResolve}
          />,
          container,
          resolve
        );
      });

      await Promise.race([settled, new Promise((r) => setTimeout(r, 3500))]);

      const node = container.firstElementChild;
      const imgs = node ? Array.from(node.querySelectorAll('img')) : [];
      await Promise.all(
        imgs.map((img) => (typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()))
      );
      await new Promise((r) => setTimeout(r, 200));

      const result = await exportPoster(node, format, filename, { width, height }, bgColor);

      if (result.warnings?.length > 0) {
        result.warnings.forEach((w) => toast(w, { icon: '⚠️', duration: 5000 }));
      } else {
        toast.success(`${format.toUpperCase()} downloaded`);
      }
    } catch (err) {
      toast.error(err.message || "We couldn't create the file. Please try again.");
    } finally {
      ReactDOM.unmountComponentAtNode(container);
      document.body.removeChild(container);
      setExporting(null);
    }
  };

  return (
    <div className="flex justify-center" ref={wrapRef}>
      <div className="relative">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={!!exporting}
          onClick={() => setOpen((o) => !o)}
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
          )}
          <span>{exporting ? "Preparing…" : "Download"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-36 rounded-[6px] border border-[#E5E7EB] bg-white shadow-sm py-1 z-20"
          >
            {FORMATS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-1.5 text-xs text-[#111827] hover:bg-[#F9FAFB] transition-colors"
                onClick={() => handleExport(id)}
              >
                Download {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
