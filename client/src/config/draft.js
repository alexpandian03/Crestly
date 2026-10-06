export const DRAFT_KEY = 'brandframe-draft';

export function saveDraft(text) {
  sessionStorage.setItem(DRAFT_KEY, text);
}

export function readDraft() {
  return sessionStorage.getItem(DRAFT_KEY) || '';
}

export function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
}
