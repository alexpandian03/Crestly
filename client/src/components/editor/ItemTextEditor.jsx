import React, { useLayoutEffect, useRef } from 'react';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';

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

export default function ItemTextEditor({ item, scale, onCommit, onCancel }) {
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

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="false"
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
        }
        if (event.key === 'Enter') {
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
        height: `${Math.round(item.h * scale)}px`,
        boxSizing: 'border-box',
        zIndex: 45,
        padding: '2px',
        overflow: 'hidden',
        background: '#ffffff',
        outline: '2px solid #2563eb',
        cursor: 'text',
        fontFamily: `'${style.fontFamily || 'Inter'}', sans-serif`,
        fontSize: `${Math.max(6, (style.size || 20) * scale)}px`,
        lineHeight: style.lineHeight || 1.2,
        fontWeight: style.weight || 500,
        color: style.color || '#0f172a',
        textAlign: style.align || 'left',
        fontStyle: style.italic ? 'italic' : 'normal',
        letterSpacing: style.letterSpacing ? `${style.letterSpacing * scale}px` : undefined,
        textTransform: style.uppercase ? 'uppercase' : 'none',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        userSelect: 'text',
        touchAction: 'auto',
      }}
    />
  );
}
