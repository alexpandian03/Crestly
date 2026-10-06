import { useState, useLayoutEffect, useRef } from 'react';

/**
 * Hook to auto-fit text inside a bounded container.
 *
 * Strategy:
 *  1. Start at maxFont and check if the text fits.
 *  2. If it fits, keep maxFont — do not shrink unnecessarily.
 *  3. If it overflows, binary-search downward to find the largest size that fits.
 *  4. If even minFont overflows, set isOverflowing: true.
 *
 * @param {React.RefObject} containerRef
 * @param {string|any} text - Changes to this trigger a re-measurement
 * @param {{ minFont, maxFont, fontsReady }} options
 * @returns {{ fontSize, isOverflowing, overflowWarning }}
 */
export function useAutoFitText(
  containerRef,
  text,
  { minFont = 12, maxFont = 48, fontsReady = true } = {}
) {
  const [fontSize, setFontSize] = useState(maxFont);
  const [isOverflowing, setIsOverflowing] = useState(false);
  // Track the last text we measured so we can reset to maxFont when content changes
  const lastTextRef = useRef(null);

  useLayoutEffect(() => {
    const el = containerRef?.current;
    if (!el || !fontsReady) return;

    // If no text (empty / null), lock to maxFont, no overflow
    if (!text || String(text).trim() === '') {
      el.style.fontSize = `${maxFont}px`;
      setFontSize(maxFont);
      setIsOverflowing(false);
      lastTextRef.current = text;
      return;
    }

    // When text changes, reset the element to maxFont before measuring
    if (lastTextRef.current !== text) {
      el.style.fontSize = `${maxFont}px`;
    }
    lastTextRef.current = text;

    const fits = (size) => {
      el.style.fontSize = `${size}px`;
      // Read layout — must happen synchronously in useLayoutEffect
      return el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2;
    };

    // Fast path: already fits at maxFont
    if (fits(maxFont)) {
      setFontSize(maxFont);
      setIsOverflowing(false);
      return;
    }

    // Binary search from minFont..maxFont-1 to find largest fitting size
    let low = Math.max(8, minFont);
    let high = maxFont - 1;
    let bestSize = low;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) {
        bestSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    el.style.fontSize = `${bestSize}px`;
    setFontSize(bestSize);

    // Overflow only if even minFont doesn't fit
    const stillOverflows = !fits(minFont);
    setIsOverflowing(stillOverflows);
  }, [containerRef, text, minFont, maxFont, fontsReady]);

  return {
    fontSize,
    isOverflowing,
    overflowWarning: isOverflowing
      ? `Content is too long to fit. Consider shortening it.`
      : null,
  };
}

export default useAutoFitText;
