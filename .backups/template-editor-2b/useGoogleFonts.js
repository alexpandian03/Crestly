import { useState, useEffect } from 'react';

/**
 * Custom hook to dynamically load Google Fonts into the document
 * and await document.fonts.ready to prevent layout shifts.
 *
 * @param {string} headingFont - e.g. "Outfit", "Playfair Display"
 * @param {string} bodyFont - e.g. "Inter", "Roboto"
 * @param {string[]} extraFonts - additional families used by brand text styles
 * @returns {boolean} fontsLoaded
 */
export function useGoogleFonts(headingFont = 'Outfit', bodyFont = 'Inter', extraFonts = []) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const fontKey = [...[headingFont, bodyFont, ...(Array.isArray(extraFonts) ? extraFonts : [])]]
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (typeof window === 'undefined') {
      setFontsLoaded(true);
      return;
    }

    const uniqueFonts = [...new Set(fontKey.split(',').filter(Boolean))];
    if (uniqueFonts.length === 0) {
      setFontsLoaded(true);
      return;
    }
    const familyQueries = uniqueFonts
      .map((font) => `family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800;900`)
      .join('&');

    const linkId = 'poster-google-fonts';
    let linkElem = document.getElementById(linkId);

    const href = `https://fonts.googleapis.com/css2?${familyQueries}&display=swap`;

    if (!linkElem) {
      linkElem = document.createElement('link');
      linkElem.id = linkId;
      linkElem.rel = 'stylesheet';
      linkElem.href = href;
      document.head.appendChild(linkElem);
    } else if (linkElem.href !== href) {
      linkElem.href = href;
    }

    let isMounted = true;

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(() => {
        if (isMounted) {
          setFontsLoaded(true);
        }
      });
    } else {
      // Fallback
      setFontsLoaded(true);
    }

    return () => {
      isMounted = false;
    };
  }, [fontKey]);

  return fontsLoaded;
}

export default useGoogleFonts;
