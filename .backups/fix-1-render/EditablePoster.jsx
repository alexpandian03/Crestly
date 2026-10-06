import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PosterPreview from '../PosterPreview';
import FieldTextEditor, { typeOfElement } from './FieldTextEditor';
import PhotoBar from './PhotoBar';
import SizeStepper from './SizeStepper';
import { resolvePosterBrand } from '../../utils/brandRender';
import { resolveTemplateRender, resolveTemplateSize, templateElements, usesTemplateElements } from '../../utils/templateRender';
import {
  FIELD_LABELS,
  LOCKED_MESSAGE,
  blankFitOf,
  clampSize,
  currentSizeOf,
  emptyView,
  limitOf,
  normalizeFieldName,
  photoUrlOf,
  sizeRangeOf,
  withBlankFit,
  withFieldSize,
  withFieldWords,
  withPhotoFit,
  withWholeMax,
  wordsOf,
} from '../../utils/posterContentFields.js';
import {
  BLANK_MESSAGES,
  BLANK_IMAGE_MAX_BYTES,
  blankImageProblem,
  blankLimitOf,
  checkBlankImageFile,
  imageOfBlank,
  withBlankImage,
  withBlankWords,
  wordsOfBlank,
} from '../../utils/posterVariables.js';
import { friendlyError, uploadBrandImage } from '../../utils/brandImage.js';

/* ------------------------------------------------------------------ *
 * Editing a poster where it is shown.
 *
 * The poster itself is the ordinary renderer, drawn 1:1 and shrunk by one transform.
 * Everything on top of it is measured from that drawing in screen pixels, so a click
 * lands on the words the user can see. Two things may be changed here: the poster's
 * own words, and the blanks a template left for the person filling it in. Nothing may
 * be moved, resized or taken away. Fixed writing, fixed shapes and the two brand bands
 * answer with "Locked by your organization".
 * ------------------------------------------------------------------ */

const FLOW_NAMES = ['headline', 'description', 'date', 'time', 'venue', 'details', 'photo'];

const STATIC_LABELS = { text: 'Fixed words', image: 'Fixed picture', shape: 'Fixed shape' };

/** The two boxes that hold a picture, whether it is the poster's own or a blank's. */
function isPhotoEntry(entry) {
  return entry?.field === 'photo' || entry?.blank?.kind === 'image';
}

function roundBox(box) {
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

function boxesOf(list) {
  return list.map((entry) => `${entry.key}:${JSON.stringify(roundBox(entry.box))}`).join('|');
}

export default function EditablePoster({
  brandKit,
  template,
  content,
  view,
  onContentChange,
  onViewChange,
  onBlankEdited = null,
  canUploadImage = false,
  onOverflow = null,
  onImageFail = null,
  photoOptions = [],
  className = '',
}) {
  const wrapRef = useRef(null);
  const posterRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [settled, setSettled] = useState(0);
  const [upload, setUpload] = useState({ busy: false, progress: null, error: '' });

  const canvasSize = useMemo(() => resolveTemplateSize(template), [template]);
  const cleanView = view || emptyView();

  /* What may be clicked, in the order the poster stacks it. Placed-item templates answer
   * with every item they carry; an older layout answers with the word groups it paints. */
  const descriptors = useMemo(() => {
    const list = [];
    if (usesTemplateElements(template)) {
      for (const item of templateElements(template, brandKit)) {
        const field = item.kind === 'field' ? normalizeFieldName(item.field) : '';
        /* A text box or a picture a person fills in later is theirs to fill, wherever it is. */
        const blank =
          item.variable && (item.kind === 'text' || item.kind === 'image')
            ? {
                kind: item.kind,
                key: item.key,
                label: item.label || item.key,
                hint: item.hint || '',
                maxLength: blankLimitOf(item),
                placeholder: item.kind === 'text' ? (item.text || '').trim() : (item.imageUrl || '').trim(),
              }
            : null;
        const editable = blank ? true : Boolean(field) && !item.locked;
        list.push({
          key: `item-${item.id}`,
          attr: 'data-element',
          id: item.id,
          field,
          blank,
          editable,
          label:
            (blank ? blank.label : '') ||
            (field ? FIELD_LABELS[field] : '') ||
            STATIC_LABELS[item.kind] ||
            'Locked by your organization',
          rect: { x: item.x, y: item.y, w: item.w, h: item.h },
        });
      }
    } else {
      const rendered = resolveTemplateRender(template);
      const imageZone = rendered.zones.image;
      const photoRect =
        imageZone && !rendered.layout.hidePhoto
          ? { x: imageZone.x, y: imageZone.y, w: imageZone.w, h: imageZone.h }
          : null;
      for (const name of FLOW_NAMES) {
        const field = normalizeFieldName(name);
        list.push({
          key: `flow-${name}`,
          attr: 'data-item',
          id: name,
          field,
          editable: true,
          label: FIELD_LABELS[field],
          rect: field === 'photo' ? photoRect : null,
        });
      }
    }
    const brand = resolvePosterBrand(brandKit, template);
    if (brand?.header?.height) {
      list.push({
        key: 'band-header',
        field: '',
        editable: false,
        label: 'Organization header',
        band: roundRect(brand.header),
      });
    }
    if (brand?.footer?.height) {
      list.push({
        key: 'band-footer',
        field: '',
        editable: false,
        label: 'Organization footer',
        band: roundRect(brand.footer),
      });
    }
    return list;
  }, [template, brandKit]);

  /* A poster with no picture of its own shows the organization's one, so taking the
   * picture out still leaves a picture on the poster and has to say so. */
  const brandDefaultPhoto = useMemo(
    () => resolvePosterBrand(brandKit, template)?.content?.defaultImageUrl || '',
    [brandKit, template]
  );

  /* Where each one actually is, in screen pixels. An empty piece of writing paints
   * nothing, so a placed item falls back to the rectangle the layout gave it. */
  const measure = useCallback(() => {
    const poster = posterRef.current;
    const wrap = wrapRef.current;
    if (!poster || !wrap) return;
    const posterRect = poster.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scale = posterRect.width / (canvasSize.width || 1080);
    if (!scale || !Number.isFinite(scale)) return;
    const originX = posterRect.left - wrapRect.left;
    const originY = posterRect.top - wrapRect.top;

    const next = [];
    for (const entry of descriptors) {
      const rect = entry.band || entry.rect;
      const node = entry.attr ? poster.querySelector(`[${entry.attr}="${entry.id}"]`) : null;
      if (node) {
        const r = node.getBoundingClientRect();
        next.push({ ...entry, box: roundBox({ left: r.left - wrapRect.left, top: r.top - wrapRect.top, width: r.width, height: r.height }), scale });
      } else if (rect && rect.w !== undefined) {
        next.push({
          ...entry,
          box: roundBox({ left: originX + rect.x * scale, top: originY + rect.y * scale, width: rect.w * scale, height: rect.h * scale }),
          scale,
        });
      } else if (rect) {
        next.push({
          ...entry,
          box: roundBox({ left: originX + rect.left * scale, top: originY + rect.top * scale, width: rect.width * scale, height: rect.height * scale }),
          scale,
        });
      }
    }
    setBoxes((prev) => (boxesOf(prev) === boxesOf(next) ? prev : next));
  }, [descriptors, canvasSize.width]);

  useLayoutEffect(() => {
    measure();
  }, [measure, content, cleanView, settled]);

  /* The poster re-sizes its own words once the real faces arrive, so measure again when
   * it says it has settled and whenever the space it sits in changes size. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(wrap);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectedBox = boxes.find((entry) => entry.key === selected) || null;
  const photoBox = boxes.find((entry) => entry.field === 'photo') || null;
  const selectedBlank = selectedBox?.blank || null;

  const choose = (entry) => {
    if (!entry.editable) {
      setSelected('');
      setEditing(null);
      setNotice(`${entry.label}: ${LOCKED_MESSAGE}.`);
      return;
    }
    setNotice('');
    if (upload.error) setUpload({ busy: false, progress: null, error: '' });
    setSelected(entry.key);
  };

  const startEdit = (entry) => {
    if (!entry.editable || isPhotoEntry(entry)) return;
    const poster = posterRef.current;
    const painted =
      poster?.querySelector(`[${entry.attr}="${entry.id}"]`) ||
      poster?.querySelector(`[data-item="${entry.field === 'tagline' ? 'description' : entry.field}"]`);
    setEditing({
      key: entry.key,
      field: entry.field,
      blank: entry.blank || null,
      box: entry.box,
      type: typeOfElement(painted, entry.scale),
    });
  };

  /* The words one box shows right now: the answer, or what the designer left there until
   * somebody answers it. */
  const textOf = (entry) =>
    entry.blank?.kind === 'text'
      ? wordsOfBlank(content, entry.blank.key) || entry.blank.placeholder
      : wordsOf(content, entry.field);

  const commitWords = (entry, text) => {
    setEditing(null);
    const words = text ?? '';
    if (words === textOf(entry)) return;
    if (entry.blank?.kind === 'text') {
      onBlankEdited?.(entry.blank.key);
      onContentChange?.(withBlankWords(content, entry.blank.key, words, entry.blank.maxLength));
      return;
    }
    onContentChange?.(withFieldWords(content, entry.field, words));
  };

  const isPicture = isPhotoEntry(selectedBox);
  const range =
    selectedBox && !isPicture && !selectedBox.blank
      ? sizeRangeOf(template, brandKit, selectedBox.field)
      : null;
  const sizeNow = range ? clampSize(range, currentSizeOf(cleanView, range, selectedBox.field)) : null;

  const applySize = (value) => {
    if (!range || !selectedBox) return;
    const next = clampSize(range, value);
    onViewChange?.(
      range.mode === 'field'
        ? withFieldSize(cleanView, selectedBox.field, next === range.current ? null : next)
        : withWholeMax(cleanView, next === range.current ? null : next)
    );
  };

  const resetSize = () => {
    if (!range || !selectedBox) return;
    onViewChange?.(
      range.mode === 'field' ? withFieldSize(cleanView, selectedBox.field, null) : withWholeMax(cleanView, null)
    );
  };

  /* The picture: another one this poster already has, one from this device, none at all,
   * or the whole picture instead of a filled space. */
  const currentPhoto = photoUrlOf(content);

  const sendPhoto = (url) => {
    const next = { ...(content || {}), imageUrl: url || '', image: url || '' };
    onContentChange?.(next);
  };

  const uploadPhoto = async (file) => {
    setUpload({ busy: true, progress: 4, error: '' });
    try {
      const result = await uploadBrandImage({
        file,
        kind: 'template',
        onProgress: (value) => setUpload({ busy: true, progress: value, error: '' }),
      });
      sendPhoto(result.url);
      setUpload({ busy: false, progress: null, error: '' });
      setNotice('Your picture is on the poster.');
    } catch (err) {
      setUpload({ busy: false, progress: null, error: friendlyError(err, 'We could not send your picture. Try again.') });
    }
  };

  const removePhoto = () => {
    sendPhoto('');
    if (brandDefaultPhoto) setNotice('Your organization’s picture takes its place.');
  };

  const setFit = (fit) => onViewChange?.(withPhotoFit(cleanView, fit === cleanView.photoFit ? null : fit));

  /* One space a person fills in with a picture of their own. The same four things as the
   * poster's picture, but the answer is stored under the space's own name, and a new file
   * can only come in through a signed upload, which a plain account cannot ask for. */
  const blankPhotoKey = selectedBlank?.kind === 'image' ? selectedBlank.key : '';
  const blankPhotoNow = blankPhotoKey
    ? imageOfBlank(content, blankPhotoKey) || selectedBlank.placeholder
    : '';

  const sendBlankImage = (url) => {
    if (!blankPhotoKey) return;
    const problem = blankImageProblem(url);
    if (problem) {
      setNotice(problem);
      return;
    }
    onContentChange?.(withBlankImage(content, blankPhotoKey, url));
  };

  const uploadBlankImage = async (file) => {
    const problem = checkBlankImageFile(file);
    if (problem) {
      setUpload({ busy: false, progress: null, error: problem });
      return;
    }
    setUpload({ busy: true, progress: 4, error: '' });
    try {
      const result = await uploadBrandImage({
        file,
        kind: 'content',
        onProgress: (value) => setUpload({ busy: true, progress: value, error: '' }),
      });
      sendBlankImage(result.url);
      setUpload({ busy: false, progress: null, error: '' });
      setNotice('Your picture is in that space.');
    } catch (err) {
      setUpload({
        busy: false,
        progress: null,
        error: friendlyError(err, 'We could not send your picture. Try again.'),
      });
    }
  };

  const removeBlankImage = () => sendBlankImage('');

  const setBlankFit = (fit) => {
    if (!selectedBox) return;
    const now = blankFitOf(cleanView, selectedBox.id);
    onViewChange?.(withBlankFit(cleanView, selectedBox.id, now === fit ? null : fit));
  };

  /* Pictures this space may take without sending anything anywhere first. */
  const blankPhotoChoices = [];
  if (blankPhotoKey) {
    const add = (url, label) => {
      const value = String(url || '').trim();
      if (!value || value === blankPhotoNow) return;
      if (blankPhotoChoices.some((option) => option.url === value)) return;
      blankPhotoChoices.push({ url: value, label });
    };
    add(selectedBlank.placeholder, 'The picture left for this space');
    add(brandDefaultPhoto, 'Your organization’s picture');
    add(currentPhoto, 'This poster’s own picture');
    Object.entries(content?.images || {}).forEach(([key, url]) => {
      if (key !== blankPhotoKey) add(url, 'A picture already used on this poster');
    });
  }

  const toolbarLeft = (box) => {
    const wrap = wrapRef.current;
    const wide = wrap ? wrap.clientWidth : 0;
    return Math.max(4, Math.min(box.left, Math.max(4, wide - 268)));
  };

  /** What a click on one box does, in words a person can act on. */
  const hitHint = (entry) => {
    if (!entry.editable) return LOCKED_MESSAGE;
    if (isPhotoEntry(entry)) return 'Click to change the picture';
    if (entry.blank) return 'Double-click to write in this space';
    return 'Click to change the size, double-click to write new words';
  };

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <PosterPreview
        brandKit={brandKit}
        template={template}
        content={content}
        view={cleanView}
        exportRef={posterRef}
        onOverflow={onOverflow}
        onImageFail={onImageFail}
        onLayoutSettled={() => setSettled((n) => n + 1)}
      />

      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 40 }}>
        {boxes.map((entry) => {
          const chosen = selected === entry.key && entry.editable;
          return (
            <button
              key={entry.key}
              type="button"
              tabIndex={0}
              data-poster-hit={entry.blank ? `blank:${entry.blank.key}` : entry.field || entry.key}
              aria-label={
                entry.editable
                  ? `${entry.label}${isPhotoEntry(entry) ? ', change the picture' : entry.blank ? ', fill this in' : ', change these words'}`
                  : `${entry.label}, ${LOCKED_MESSAGE}`
              }
              title={hitHint(entry)}
              onClick={(event) => {
                event.stopPropagation();
                choose(entry);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (isPhotoEntry(entry)) choose(entry);
                else startEdit(entry);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && entry.editable && !isPhotoEntry(entry)) {
                  event.preventDefault();
                  startEdit(entry);
                }
              }}
              className={`absolute rounded-[3px] ${entry.editable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              style={{
                left: `${entry.box.left}px`,
                top: `${entry.box.top}px`,
                width: `${entry.box.width}px`,
                height: `${entry.box.height}px`,
                pointerEvents: 'auto',
                background: chosen ? 'rgba(37,99,235,0.10)' : 'transparent',
                outline: chosen ? '2px solid #2563eb' : 'none',
                outlineOffset: '-2px',
              }}
            />
          );
        })}
      </div>

      {selectedBox && isPicture ? (
        <div
          className="absolute"
          style={{
            left: `${
              (selectedBlank
                ? toolbarLeft(selectedBox.box)
                : photoBox
                  ? photoBox.box.left + 8
                  : toolbarLeft(selectedBox.box))
            }px`,
            top: `${(selectedBlank ? selectedBox : photoBox || selectedBox).box.top + 8}px`,
            zIndex: 50,
          }}
        >
          <PhotoBar
            label={selectedBlank ? `${selectedBlank.label} picture` : 'Poster photo'}
            currentUrl={selectedBlank ? blankPhotoNow : currentPhoto}
            alternatives={
              selectedBlank
                ? blankPhotoChoices
                : photoOptions.filter((option) => option.url && option.url !== currentPhoto)
            }
            fit={
              selectedBlank
                ? blankFitOf(cleanView, selectedBox.id) === 'contain'
                  ? 'contain'
                  : 'cover'
                : cleanView.photoFit === 'contain'
                  ? 'contain'
                  : 'cover'
            }
            busy={upload.busy}
            progress={upload.progress}
            error={upload.error}
            canUpload={selectedBlank ? canUploadImage : true}
            maxBytes={selectedBlank ? BLANK_IMAGE_MAX_BYTES : undefined}
            uploadNotice={selectedBlank ? BLANK_MESSAGES.uploadNeedsAdmin : ''}
            onPick={(url) => (selectedBlank ? sendBlankImage(url) : sendPhoto(url))}
            onUpload={(file) => (selectedBlank ? uploadBlankImage(file) : uploadPhoto(file))}
            onRemove={() => (selectedBlank ? removeBlankImage() : removePhoto())}
            onFit={(value) => (selectedBlank ? setBlankFit(value) : setFit(value))}
          />
        </div>
      ) : null}

      {selectedBox && !isPicture && range ? (
        <div
          className="absolute"
          style={{
            left: `${toolbarLeft(selectedBox.box)}px`,
            top: `${selectedBox.box.top - 40 < 0 ? selectedBox.box.top + selectedBox.box.height + 6 : selectedBox.box.top - 40}px`,
            zIndex: 50,
          }}
        >
          <SizeStepper
            label={range.mode === 'field' ? selectedBox.label : 'Poster text'}
            size={sizeNow}
            range={range}
            disabled={Boolean(editing) || upload.busy}
            onChange={applySize}
            onReset={resetSize}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="absolute inset-0" style={{ zIndex: 55 }}>
          <FieldTextEditor
            box={editing.box}
            type={editing.type}
            text={textOf(editing)}
            maxChars={editing.blank ? editing.blank.maxLength : limitOf(editing.field)}
            multiline={editing.field === 'details' && !editing.blank}
            onCommit={(text) => commitWords(editing, text)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="mt-2 text-center text-xs font-medium text-body">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/** The brand band rectangles arrive with different key names; keep one shape. */
function roundRect(band) {
  return {
    left: Number(band.left) || 0,
    top: Number(band.top) || 0,
    width: Number(band.width) || 0,
    height: Number(band.height) || 0,
    x: Number(band.left) || 0,
    y: Number(band.top) || 0,
    w: Number(band.width) || 0,
    h: Number(band.height) || 0,
  };
}
