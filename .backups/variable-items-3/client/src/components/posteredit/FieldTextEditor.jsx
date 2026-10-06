import React, { useLayoutEffect, useRef } from 'react';

/* ------------------------------------------------------------------ *
 * Typing the poster's words where they stand.
 *
 * The box sits exactly on top of the words it replaces, in the same face and at the
 * same size, shrunk by the same factor as the poster. Only plain words may be typed
 * in, and only as many as the save rules accept for that piece of writing.
 * ------------------------------------------------------------------ */

/** The element that actually holds the words: the painted box is often a wrapper whose
 * own font size is only the inherited default. */
function wordsNode(node) {
  if (!node) return null;
  const holds = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
  if (holds(node)) return node;
  for (const each of node.querySelectorAll('*')) {
    if (holds(each)) return each;
  }
  return node;
}

/** Everything the painted words look like, already in screen pixels. */
export function typeOfElement(node, scale) {
  const holder = wordsNode(node);
  if (!holder) return null;
  const cs = window.getComputedStyle(holder);
  const size = parseFloat(cs.fontSize) || 20;
  return {
    fontFamily: cs.fontFamily,
    fontSize: Math.max(8, size * scale),
    lineHeight: cs.lineHeight && cs.lineHeight !== 'normal' ? `${parseFloat(cs.lineHeight) / size}` : 1.2,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    color: '#0f172a',
    letterSpacing: cs.letterSpacing && cs.letterSpacing !== 'normal' ? `${parseFloat(cs.letterSpacing) * scale}px` : undefined,
    textAlign: cs.textAlign === 'start' ? 'left' : cs.textAlign,
    uppercase: cs.textTransform === 'uppercase',
  };
}

function caretToEnd(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

export default function FieldTextEditor({ box, type, text, maxChars, multiline, onCommit, onCancel }) {
  const ref = useRef(null);
  const doneRef = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.textContent = text || '';
    node.focus();
    caretToEnd(node);
  }, [box.left, box.top, maxChars]);

  /* innerText keeps the line breaks the browser paints; textContent would lose them. */
  const read = () => {
    const node = ref.current;
    if (!node) return text || '';
    const value = multiline ? node.innerText || node.textContent || '' : node.textContent || '';
    return value.replace(/\r/g, '');
  };

  const finish = (keep) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (keep) onCommit?.(read());
    else onCancel?.();
  };

  const face = type || {};

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline={multiline ? 'true' : 'false'}
      aria-label="Change these words"
      contentEditable
      suppressContentEditableWarning
      spellCheck="false"
      data-poster-editing="true"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (multiline) {
            const lines = (read() || '').split('\n').length;
            if (lines < 4) {
              document.execCommand('insertLineBreak');
              return;
            }
          }
          finish(true);
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const words = event.clipboardData?.getData('text/plain') || '';
        const node = ref.current;
        if (!node) return;
        const room = Math.max(0, maxChars - (node.textContent || '').length);
        document.execCommand('insertText', false, words.slice(0, room).replace(/\r/g, ''));
      }}
      onInput={() => {
        const node = ref.current;
        if (!node) return;
        const value = node.textContent || '';
        if (value.length > maxChars) {
          node.textContent = value.slice(0, maxChars);
          caretToEnd(node);
        }
      }}
      onBlur={() => finish(true)}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${Math.round(box.left)}px`,
        top: `${Math.round(box.top)}px`,
        width: `${Math.round(box.width)}px`,
        height: `${Math.round(box.height)}px`,
        boxSizing: 'border-box',
        zIndex: 60,
        padding: '2px',
        overflow: 'hidden',
        background: '#ffffff',
        outline: '2px solid #2563eb',
        cursor: 'text',
        fontFamily: face.fontFamily || "'Inter', sans-serif",
        fontSize: `${face.fontSize || 14}px`,
        lineHeight: face.lineHeight || 1.2,
        fontWeight: face.fontWeight || 600,
        fontStyle: face.fontStyle || 'normal',
        color: face.color || '#0f172a',
        textAlign: face.textAlign || 'left',
        textTransform: face.uppercase ? 'uppercase' : 'none',
        letterSpacing: face.letterSpacing,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        userSelect: 'text',
        touchAction: 'auto',
      }}
    />
  );
}
