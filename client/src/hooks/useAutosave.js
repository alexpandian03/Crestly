import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Shared autosave hook for templates and posters.
 * Debounces saves to 3 seconds after the last change, ensures only 1 request is in-flight,
 * tracks status ('Saving...', 'Draft saved', or error), handles offline retry,
 * warns on tab/window close when unsaved changes exist, and manages the restore-on-open flow.
 */
export function useAutosave({
  id,
  type = 'template', // 'template' | 'poster'
  baseVersion,
  isDirty,
  getData,
  initialDraft = null,
  onRestore,
  onDiscard,
  enabled = true,
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [draftPrompt, setDraftPrompt] = useState(null); // { data, savedAt, basedOnVersion }

  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const offlinePendingRef = useRef(false);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const endpoint = type === 'poster' ? `/posters/${id}/draft` : `/templates/${id}/draft`;

  // Restore on open check
  useEffect(() => {
    if (initialDraft && initialDraft.data && enabled) {
      setDraftPrompt(initialDraft);
    }
  }, [initialDraft, enabled]);

  // Execute an autosave request
  const runAutosave = useCallback(async () => {
    if (!enabled || !id || !isDirtyRef.current) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('error');
      setErrorMessage('Offline — will save when connected');
      offlinePendingRef.current = true;
      return;
    }

    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    inFlightRef.current = true;
    setStatus('saving');
    setErrorMessage('');

    try {
      const payload = getData ? getData() : null;
      if (!payload) {
        inFlightRef.current = false;
        setStatus('idle');
        return;
      }

      await api.put(endpoint, {
        basedOnVersion: baseVersion,
        ...(payload.data !== undefined ? payload : { data: payload }),
      });

      setStatus('saved');
      setErrorMessage('');
    } catch (err) {
      const statusNum = err?.response?.status;
      if (statusNum === 409) {
        setStatus('error');
        setErrorMessage('Changed elsewhere. Reload to continue.');
      } else if (statusNum === 429) {
        setStatus('error');
        setErrorMessage('Too many saves. Please wait.');
      } else {
        setStatus('error');
        setErrorMessage(err?.response?.data?.error?.message || 'Could not save draft');
      }
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        // Schedule next save after short break
        setTimeout(runAutosave, 500);
      }
    }
  }, [enabled, id, endpoint, baseVersion, getData]);

  // Debounced autosave: 3 seconds after last change
  useEffect(() => {
    if (!enabled || !id || !isDirty) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runAutosave();
    }, 3000);

    return () => clearTimeout(timerRef.current);
  }, [isDirty, enabled, id, runAutosave]);

  // Retry when offline connection returns
  useEffect(() => {
    const handleOnline = () => {
      if (offlinePendingRef.current || isDirtyRef.current) {
        offlinePendingRef.current = false;
        runAutosave();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [runAutosave]);

  // Warning before leaving with unsaved work
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const continueDraft = useCallback(() => {
    if (draftPrompt?.data && onRestore) {
      onRestore(draftPrompt.data);
    }
    setDraftPrompt(null);
  }, [draftPrompt, onRestore]);

  const discardDraft = useCallback(async () => {
    setDraftPrompt(null);
    try {
      await api.delete(endpoint);
    } catch (err) {
      console.warn('Could not discard draft from server', err);
    }
    if (onDiscard) onDiscard();
  }, [endpoint, onDiscard]);

  return {
    status, // 'idle' | 'saving' | 'saved' | 'error'
    errorMessage,
    draftPrompt,
    continueDraft,
    discardDraft,
    forceAutosave: runAutosave,
    setStatus,
  };
}
