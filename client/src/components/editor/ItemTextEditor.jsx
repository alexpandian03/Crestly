import React, { useLayoutEffect, useRef } from 'react';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';
import { fontStackFor, tamilCssOverrides } from '../../../../shared/textScripts.js';

/* ------------------------------------------------------------------ *
 * Typing words where they stand.
 *
 * Double-clicking a fixed piece of text opens a plain text box on top of it, in the
 * same face and at the same size, shrunk by the same factor as the poster. Nothing
 * fancy is allowed in: pasting brings words only, and the same 200 characters the
 * save rules accept.
 * ------------------------------------------------------------------ */

const MAX_CHARS = ELEMENT_LIMITS.textChars;

function caretToEnd(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

import { resolveColorToken, resolveFontToken } from '../../../../shared/templateElements.js';
import { contrastRatio } from '../../utils/contrast.js';

export default function ItemTextEditor({ item, scale, brandKit, onCommit, onCancel }) {
  const ref = useRef(null);
  const lastRef = useRef(item.text || '');
  const doneRef = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.textContent = item.text || '';
    node.focus();
    caretToEnd(node);
  }, [item.id]);

  const read = () => (ref.current ? ref.current.textContent || '' : lastRef.current);

  const finish = (keep) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const text = read();
    if (keep) onCommit?.(text);
    else onCancel?.();
  };

  const style = item.style || {};
  const resolvedFont = resolveFontToken(style.fontFamily || 'brand:body', brandKit) || style.fontFamily || 'Inter';
  const resolvedColor = resolveColorToken(style.color || 'brand:text', brandKit) || style.color || '#0f172a';
  const ratio = contrastRatio(resolvedColor, '#ffffff');
  const editColor = ratio !== null && ratio < 3 ? '#0f172a' : resolvedColor;
  const fontSize = Math.max(8, (style.size || style.fontSize || 20) * scale);
  const lineHeight = style.lineHeight || 1.2;
  const rot = Number(item.rotation) || 0;

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label="Edit these words"
      contentEditable
      suppressContentEditableWarning
      spellCheck="false"
      data-editing="true"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          finish(true);
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const words = event.clipboardData?.getData('text/plain') || '';
        const node = ref.current;
        if (!node) return;
        const room = Math.max(0, MAX_CHARS - (node.textContent || '').length);
        document.execCommand('insertText', false, words.slice(0, room));
      }}
      onInput={() => {
        const node = ref.current;
        if (!node) return;
        lastRef.current = node.textContent || '';
        if (lastRef.current.length > MAX_CHARS) {
          node.textContent = lastRef.current.slice(0, MAX_CHARS);
          lastRef.current = node.textContent;
          caretToEnd(node);
        }
      }}
      onBlur={() => finish(true)}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${Math.round(item.x * scale)}px`,
        top: `${Math.round(item.y * scale)}px`,
        width: `${Math.round(item.w * scale)}px`,
        minHeight: `${Math.round(item.h * scale)}px`,
        height: 'auto',
        boxSizing: 'border-box',
        zIndex: 55,
        padding: '2px',
        overflow: 'visible',
        background: '#ffffff',
        outline: '2px solid #2563eb',
        borderRadius: '2px',
        cursor: 'text',
        fontFamily: fontStackFor(resolvedFont, item.text),
        fontSize: `${fontSize}px`,
        lineHeight: lineHeight,
        fontWeight: style.weight || (style.bold ? 700 : 500),
        color: editColor,
        textAlign: style.align || 'left',
        fontStyle: style.italic ? 'italic' : 'normal',
        textDecoration: style.textDecoration || 'none',
        letterSpacing: style.letterSpacing ? `${style.letterSpacing * scale}px` : undefined,
        textTransform: style.uppercase || style.textTransform === 'uppercase' ? 'uppercase' : 'none',
        /* Typing Tamil needs the same room and the same face as the finished poster. */
        ...tamilCssOverrides(item.text || '', { lineHeight, letterSpacing: 0 }),
        transform: rot ? `rotate(${rot}deg)` : undefined,
        transformOrigin: '50% 50%',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        userSelect: 'text',
        touchAction: 'auto',
      }}
    />
  );
}
