import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import PhotoBar from './PhotoBar';
import { blankFitOf, withBlankFit } from '../../utils/posterContentFields.js';
import {
  BLANK_MESSAGES,
  BLANK_IMAGE_MAX_BYTES,
  blankImageProblem,
  blanksOfDesign,
  checkBlankImageFile,
  imageOfBlank,
  withBlankImage,
  withBlankWords,
  wordsOfBlank,
} from '../../utils/posterVariables.js';
import { friendlyError, uploadBrandImage } from '../../utils/brandImage.js';

/* ------------------------------------------------------------------ *
 * The spaces the layout left to be filled in.
 *
 * Every one of them is listed here, whether the writing arrived or not, so a person can
 * always finish the poster by hand. The words go in as they are typed and the poster
 * changes on the screen at the same time; nothing is stored until Save changes.
 * ------------------------------------------------------------------ */

const PUSH_MS = 150;

function Counter({ current, max }) {
  return (
    <span
      className={`text-[11px] font-mono tabular-nums ${
        current >= max ? 'text-danger font-semibold' : current >= max * 0.9 ? 'text-amber-600' : 'text-muted'
      }`}
    >
      {current}/{max}
    </span>
  );
}

export default function VariableFields({
  design,
  content,
  view,
  alternatives = [],
  canUpload = false,
  onContentChange,
  onViewChange,
  onEdited = null,
}) {
  const slots = useMemo(() => blanksOfDesign(design), [design]);
  const [drafts, setDrafts] = useState({});
  const [upload, setUpload] = useState({ key: '', busy: false, progress: null, error: '' });

  const timersRef = useRef({});
  const sentRef = useRef({});
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
    },
    []
  );

  /* Words that came from somewhere else - the assistant, undo, opening the poster again -
   * move into the boxes. Anything this panel just sent stays exactly as it was typed. */
  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      slots.texts.forEach((slot) => {
        const incoming = wordsOfBlank(content, slot.key);
        if (incoming === sentRef.current[slot.key]) return;
        if ((prev[slot.key] || '') !== incoming) {
          next[slot.key] = incoming;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [content, slots]);

  const sendWords = (slot, words) => {
    const next = withBlankWords(contentRef.current, slot.key, words, slot.maxLength);
    sentRef.current[slot.key] = next.extras?.[slot.key] ?? '';
    onContentChange?.(next);
  };

  const typeWords = (slot, words) => {
    const limited = String(words || '').slice(0, slot.maxLength);
    setDrafts((prev) => ({ ...prev, [slot.key]: limited }));
    onEdited?.(slot.key);
    clearTimeout(timersRef.current[slot.key]);
    timersRef.current[slot.key] = setTimeout(() => sendWords(slot, limited), PUSH_MS);
  };

  const sendImage = (slot, url) => {
    const problem = blankImageProblem(url);
    if (problem) {
      setUpload({ key: slot.key, busy: false, progress: null, error: problem });
      return;
    }
    const next = withBlankImage(contentRef.current, slot.key, url);
    sentRef.current[slot.key] = next.images?.[slot.key] ?? '';
    onContentChange?.(next);
    if (!url) setUpload({ key: '', busy: false, progress: null, error: '' });
  };

  const uploadImage = async (slot, file) => {
    const problem = checkBlankImageFile(file);
    if (problem) {
      setUpload({ key: slot.key, busy: false, progress: null, error: problem });
      return;
    }
    setUpload({ key: slot.key, busy: true, progress: 4, error: '' });
    try {
      const result = await uploadBrandImage({
        file,
        kind: 'content',
        onProgress: (value) => setUpload({ key: slot.key, busy: true, progress: value, error: '' }),
      });
      sendImage(slot, result.url);
      setUpload({ key: slot.key, busy: false, progress: null, error: '' });
    } catch (err) {
      setUpload({
        key: slot.key,
        busy: false,
        progress: null,
        error: friendlyError(err, 'We could not send your picture. Try again.'),
      });
    }
  };

  const choicesFor = (slot) => {
    const now = imageOfBlank(content, slot.key) || '';
    const list = [];
    const add = (url, label) => {
      const value = String(url || '').trim();
      if (!value || value === now) return;
      if (list.some((option) => option.url === value)) return;
      list.push({ url: value, label });
    };
    add(slot.placeholder, 'The picture left for this space');
    alternatives.forEach((option) => add(option.url, option.label));
    Object.entries(content?.images || {}).forEach(([key, url]) => {
      if (key !== slot.key) add(url, 'A picture already used on this poster');
    });
    return list;
  };

  if (!slots.texts.length && !slots.images.length) return null;

  return (
    <div className="space-y-5 pt-4 border-t border-line">
      <div>
        <h3 className="text-xs font-semibold text-heading uppercase tracking-wider">Spaces to fill in</h3>
        <p className="text-xs text-muted mt-0.5">
          Your layout left room for these. The poster changes as you write, and nothing is kept until you save.
        </p>
      </div>

      {slots.texts.map((slot) => {
        /* A box this panel has not touched yet shows the answer that is already on the poster. */
        const value = drafts[slot.key] === undefined ? wordsOfBlank(content, slot.key) : drafts[slot.key];
        return (
          <div key={slot.key}>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={`blank-text-${slot.key}`}
                className="text-xs font-semibold text-heading uppercase tracking-wider"
              >
                {slot.label}
              </label>
              <Counter current={value.length} max={slot.maxLength} />
            </div>
            <input
              id={`blank-text-${slot.key}`}
              type="text"
              value={value}
              maxLength={slot.maxLength}
              placeholder={slot.placeholder || 'Write something here'}
              onChange={(event) => typeWords(slot, event.target.value)}
              className="input-field"
            />
            {!value ? <p className="mt-1 text-[11px] text-muted">{BLANK_MESSAGES.emptyHint}</p> : null}
          </div>
        );
      })}

      {slots.images.map((slot) => {
        const answer = imageOfBlank(content, slot.key);
        const shown = answer || slot.placeholder || '';
        const busy = upload.busy && upload.key === slot.key;
        return (
          <div key={slot.key} className="space-y-2 rounded-card border border-line bg-section/40 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-heading uppercase tracking-wider">{slot.label}</p>
              <span className="text-[11px] text-muted">
                {answer
                  ? 'Your picture is in place'
                  : slot.placeholder
                    ? "The designer's picture is here so far"
                    : 'Nothing here yet'}
              </span>
            </div>
            <div className="aspect-[4/3] w-full overflow-hidden rounded-chip border border-dashed border-line bg-preview">
              {shown ? (
                <img
                  src={shown}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-full w-full"
                  style={{
                    objectFit: blankFitOf(view, slot.id) === 'contain' ? 'contain' : 'cover',
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center gap-2 text-[11px] text-muted">
                  <ImageOff className="w-4 h-4" />
                  <span>Choose a picture for this space</span>
                </div>
              )}
            </div>
            <PhotoBar
              label={`${slot.label} picture`}
              currentUrl={answer}
              alternatives={choicesFor(slot)}
              fit={blankFitOf(view, slot.id) === 'contain' ? 'contain' : 'cover'}
              busy={busy}
              progress={busy ? upload.progress : null}
              error={upload.key === slot.key ? upload.error : ''}
              canUpload={canUpload}
              maxBytes={BLANK_IMAGE_MAX_BYTES}
              uploadNotice={BLANK_MESSAGES.uploadNeedsAdmin}
              onPick={(url) => sendImage(slot, url)}
              onUpload={(file) => uploadImage(slot, file)}
              onRemove={() => sendImage(slot, '')}
              onFit={(value) =>
                onViewChange?.(withBlankFit(view, slot.id, blankFitOf(view, slot.id) === value ? null : value))
              }
            />
          </div>
        );
      })}
    </div>
  );
}
