import { useState, useEffect, useRef } from 'react';

/**
 * Every poster on the page asks for the families it actually draws with, and this module
 * keeps one <link> holding the union of the requests that are currently mounted. A shared
 * link written by whichever poster rendered last would drop the fonts another poster needs,
 * so the text would silently switch to a fallback face - in the preview and in the export.
 */
const LINK_ID = 'poster-google-fonts';
const requests = new Map();
let seq = 0;

function syncLink() {
  if (typeof document === 'undefined') return;
  const families = [...new Set([...requests.values()].flat())];
  if (families.length === 0) return;
  const href = `https://fonts.googleapis.com/css2?${families
    .map((font) => `family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800;900`)
    .join('&')}&display=swap`;
  let linkElem = document.getElementById(LINK_ID);
  if (!linkElem) {
    linkElem = document.createElement('link');
    linkElem.id = LINK_ID;
    linkElem.rel = 'stylesheet';
    document.head.appendChild(linkElem);
  }
  if (linkElem.href !== href) linkElem.href = href;
}

/**
 * @param {string} headingFont - e.g. "Outfit", "Playfair Display"
 * @param {string} bodyFont - e.g. "Inter", "Roboto"
 * @param {string[]} extraFonts - every other family this poster draws: brand text styles
 * and the fonts its placed items name
 * @returns {boolean} fontsLoaded
 */
export function useGoogleFonts(headingFont = 'Outfit', bodyFont = 'Inter', extraFonts = []) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const slotRef = useRef(null);
  const fontKey = [...[headingFont, bodyFont, ...(Array.isArray(extraFonts) ? extraFonts : [])]]
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (typeof window === 'undefined') {
      setFontsLoaded(true);
      return undefined;
    }

    const uniqueFonts = [...new Set(fontKey.split(',').filter(Boolean))];
    if (uniqueFonts.length === 0) {
      setFontsLoaded(true);
      return undefined;
    }

    if (slotRef.current === null) slotRef.current = `f${(seq += 1)}`;
    requests.set(slotRef.current, uniqueFonts);
    syncLink();

    let isMounted = true;

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(() => {
        if (isMounted) setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }

    return () => {
      isMounted = false;
      requests.delete(slotRef.current);
      syncLink();
    };
  }, [fontKey]);

  return fontsLoaded;
}

export default useGoogleFonts;
