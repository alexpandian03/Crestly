import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, X } from 'lucide-react';

/**
 * Shows the one picture made for this poster and lets the person take it or leave it. Nothing is
 * changed on the poster until "Use this picture" is pressed, so a picture nobody wants costs
 * nothing but the ask.
 */
export default function AiPictureDialog({
  subject = '',
  url = '',
  stockUrl = '',
  message = '',
  error = '',
  busy = false,
  onUse,
  onDiscard,
  onRetry,
}) {
  const shown = url || stockUrl;
  const [broken, setBroken] = useState(false);
  const useButtonRef = useRef(null);

  useEffect(() => {
    setBroken(false);
  }, [shown]);

  useEffect(() => {
    if (!busy && shown) useButtonRef.current?.focus();
  }, [busy, shown]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onDiscard();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [busy, onDiscard]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-heading/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-picture-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDiscard();
      }}
    >
      <div className="card-surface w-full max-w-lg space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-chip bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="ai-picture-title" className="text-base font-semibold text-heading">
              {busy ? 'Making a picture for your poster…' : 'A picture for your poster'}
            </h2>
            <p className="mt-1 text-sm text-body leading-snug">
              {busy
                ? 'This usually takes a few seconds. Your poster stays as it is until you choose.'
                : stockUrl && !url
                  ? 'We could not draw one, so here is a photo that fits instead.'
                  : 'Nothing changes on your poster until you press Use this picture.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-chip p-1.5 text-muted transition-colors hover:bg-canvas hover:text-heading disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {subject && !busy && (
          <p className="text-xs text-muted">
            Drawn from <span className="font-medium text-body">{subject}</span> in your brand colors.
          </p>
        )}

        <div className="overflow-hidden rounded-card border border-line bg-canvas">
          {busy ? (
            <div className="flex aspect-[4/5] w-full items-center justify-center bg-primary/5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : shown && !broken ? (
            <img
              src={shown}
              alt={`Picture for ${subject || 'your poster'}`}
              onError={() => setBroken(true)}
              className="max-h-[52vh] w-full object-contain"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 bg-primary/5 text-muted">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">This picture did not open.</span>
            </div>
          )}
        </div>

        {(message || error || (broken && shown)) && (
          <p className="text-sm text-danger" role="alert">
            {broken && shown ? 'This picture did not open. Try another one.' : error || message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy}
            className="btn-ghost border border-line px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? 'Keep waiting' : 'Discard'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="btn-ghost border border-line px-4 py-2 text-sm disabled:opacity-60"
          >
            Make another
          </button>
          <button
            ref={useButtonRef}
            type="button"
            onClick={() => onUse(shown)}
            disabled={busy || !shown || broken}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            <span>{stockUrl && !url ? 'Use this photo' : 'Use this picture'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
