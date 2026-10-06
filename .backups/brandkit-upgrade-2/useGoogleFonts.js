import { useState, useEffect } from 'react';

/**
 * Custom hook to dynamically load Google Fonts into the document
 * and await document.fonts.ready to prevent layout shifts.
 *
 * @param {string} headingFont - e.g. "Outfit", "Playfair Display"
 * @param {string} bodyFont - e.g. "Inter", "Roboto"
 * @returns {boolean} fontsLoaded
 */
export function useGoogleFonts(headingFont = 'Outfit', bodyFont = 'Inter') {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setFontsLoaded(true);
      return;
    }

    const fontsToLoad = [headingFont, bodyFont].filter(Boolean);
    if (fontsToLoad.length === 0) {
      setFontsLoaded(true);
      return;
    }

    const uniqueFonts = [...new Set(fontsToLoad)];
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
  }, [headingFont, bodyFont]);

  return fontsLoaded;
}

export default useGoogleFonts;
