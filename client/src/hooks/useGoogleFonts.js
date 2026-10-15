import { useState, useEffect, useRef } from 'react';
import { TAMIL_FALLBACK_FONT } from '../../../shared/textScripts.js';
import { weightsFor } from '../../../shared/templateElements.js';

/**
 * Every poster on the page asks for the faces it actually draws, and this module keeps one
 * <link> holding the union of the requests that are currently mounted. A shared link written
 * by whichever poster rendered last would drop the fonts another poster needs, so the text
 * would silently switch to a fallback face - in the preview and in the export.
 *
 * A request is `{ family, weights }`. Only the weights asked for are ever fetched, and the
 * Tamil fallback face only joins the request list when a poster really prints Tamil, so a
 * Latin poster downloads nothing of the Tamil files.
 */
const LINK_ID = 'poster-google-fonts';
const TAMIL_LINK_ID = 'poster-google-fonts-tamil';
/** The weights the app ever offers a user, for a family named without any of its own. */
const STANDARD_WEIGHTS = [400, 500, 600, 700, 800];
const requests = new Map();
let seq = 0;

function toRequest(entry) {
  if (typeof entry === 'string') return { family: entry, weights: STANDARD_WEIGHTS };
  if (!entry || typeof entry.family !== 'string' || !entry.family.trim()) return null;
  const weights = (Array.isArray(entry.weights) ? entry.weights : [])
    .map((weight) => Number(weight))
    .filter((weight) => Number.isFinite(weight));
  return { family: entry.family, weights: weights.length ? weights : STANDARD_WEIGHTS };
}

/** One family, one `family=` term listing exactly the weights that face is drawn with.
 *  A family is only asked for the weights it publishes; the service drops a whole term - and
 *  with it the face - when one of them does not exist. */
function familyTerm({ family, weights }) {
  const sorted = weightsFor(family, weights);
  return `family=${encodeURIComponent(family)}:wght@${sorted.join(';')}`;
}

function hrefFor(list, subset) {
  if (list.length === 0) return '';
  const query = list.map(familyTerm).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap${subset ? `&subset=${subset}` : ''}`;
}

function syncLink(id, href) {
  let linkElem = document.getElementById(id);
  if (!href) {
    if (linkElem) linkElem.remove();
    return;
  }
  if (!linkElem) {
    linkElem = document.createElement('link');
    linkElem.id = id;
    linkElem.rel = 'stylesheet';
    document.head.appendChild(linkElem);
  }
  if (linkElem.href !== href) linkElem.href = href;
}

function syncLinks() {
  if (typeof document === 'undefined') return;
  const merged = new Map();
  for (const list of requests.values()) {
    for (const entry of list) {
      const request = toRequest(entry);
      if (!request) continue;
      const seen = merged.get(request.family);
      if (seen) merged.set(request.family, { family: request.family, weights: [...seen.weights, ...request.weights] });
      else merged.set(request.family, request);
    }
  }
  const all = [...merged.values()];
  /* A Tamil face only earns its bytes when Tamil is on the page, and then it is asked for as
     the Tamil subset, so the Latin half of that family is never fetched. */
  const tamil = all.filter((request) => request.family === TAMIL_FALLBACK_FONT);
  const latin = all.filter((request) => request.family !== TAMIL_FALLBACK_FONT);
  syncLink(LINK_ID, hrefFor(latin));
  syncLink(TAMIL_LINK_ID, hrefFor(tamil, 'tamil'));
}

/** Asks the browser for the exact faces the poster paints, so a measurement is never made
 *  against a fallback that is about to be swapped out. Tamil asks with Tamil letters, because
 *  a face is only fetched when the words it is asked for really fall inside its own range. */
function loadFaces(list) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const tamilOnPoster = list.some((entry) => toRequest(entry)?.family === TAMIL_FALLBACK_FONT);
  const sample = tamilOnPoster ? 'BESbswy\u0B95\u0BC0\u0BA8\u0BCD\u0BB1\u0BC1' : undefined;
  const samples = [];
  for (const entry of list) {
    const request = toRequest(entry);
    if (!request) continue;
    for (const weight of weightsFor(request.family, request.weights)) {
      samples.push(document.fonts.load(`${weight} 32px "${request.family}"`, sample));
    }
  }
  if (samples.length === 0) return Promise.resolve();
  return Promise.allSettled(samples).then(() => undefined);
}

/**
 * @param {Array<string|{family: string, weights: number[]}>} fontRequests - every family this
 *   poster draws, with the weights it draws them at
 * @returns {boolean} fontsLoaded
 */
export function useGoogleFonts(fontRequests = []) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const slotRef = useRef(null);
  const requestKey = (Array.isArray(fontRequests) ? fontRequests : [fontRequests])
    .filter(Boolean)
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : `${entry.family}@${[...(entry.weights || [])].sort((a, b) => a - b).join(',')}`,
    )
    .join('|');

  useEffect(() => {
    if (typeof window === 'undefined') {
      setFontsLoaded(true);
      return undefined;
    }

    const unique = [...new Set(requestKey.split('|').filter(Boolean))];
    if (unique.length === 0) {
      setFontsLoaded(true);
      return undefined;
    }

    if (slotRef.current === null) slotRef.current = `f${(seq += 1)}`;
    const list = unique.map((part) => {
      const [family, weights = ''] = part.split('@');
      return weights ? { family, weights: weights.split(',').map(Number) } : family;
    });
    requests.set(slotRef.current, list);
    syncLinks();

    let isMounted = true;
    const ready = typeof document.fonts?.ready?.then === 'function' ? document.fonts.ready : Promise.resolve();

    loadFaces(list)
      .then(() => ready)
      .then(() => {
        if (isMounted) setFontsLoaded(true);
      })
      .catch(() => {
        if (isMounted) setFontsLoaded(true);
      });

    return () => {
      isMounted = false;
      requests.delete(slotRef.current);
      syncLinks();
    };
  }, [requestKey]);

  return fontsLoaded;
}

/** The faces and weights a poster draws, so the export asks for the same files it loaded. */
export function loadedFontRequests() {
  const merged = new Map();
  for (const list of requests.values()) {
    for (const entry of list) {
      const request = toRequest(entry);
      if (!request) continue;
      const seen = merged.get(request.family);
      merged.set(request.family, seen ? { ...seen, weights: [...seen.weights, ...request.weights] } : request);
    }
  }
  return [...merged.values()];
}

export default useGoogleFonts;
