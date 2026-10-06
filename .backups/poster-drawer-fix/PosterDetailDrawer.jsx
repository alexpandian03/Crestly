import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Check,
  History as HistoryIcon,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Eye,
  X,
} from 'lucide-react';
import api from '../services/api';
import PosterPreview from './PosterPreview';
import { fullDateTime, timeAgo } from '../utils/timeAgo';

const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Waiting for review',
  approved: 'Approved',
};

function versionNumberOf(version, index) {
  return version?.versionNumber ?? index + 1;
}

function toPreviewContent(content) {
  if (!content) return null;
  return { ...content, image: content.imageUrl || content.image || '' };
}

export default function PosterDetailDrawer({
  posterId,
  brandKit,
  template,
  namesById = {},
  currentUserId = '',
  canSeeAuthors = false,
  showAuthors = false,
  onClose,
  onChanged,
}) {
  const navigate = useNavigate();
  const [poster, setPoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewVersion, setPreviewVersion] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!posterId) return;
    try {
      setLoading(true);
      setError('');
      setRestoreError('');
      const response = await api.get(`/posters/${posterId}`);
      const loaded = response.data?.data?.poster;
      if (!response.data?.success || !loaded) throw new Error('missing');
      setPoster(loaded);
      setPreviewVersion(null);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "We couldn't find this poster. It may have been deleted."
          : 'We could not open this poster. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [posterId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const versions = useMemo(() => {
    if (!poster) return [];
    const list = Array.isArray(poster.versions) ? poster.versions : [];
    if (list.length === 0) {
      return [
        {
          content: poster.content,
          note: 'Created',
          versionNumber: poster.currentVersion || 1,
          createdBy: poster.userId,
          createdAt: poster.createdAt,
        },
      ];
    }
    return list;
  }, [poster]);

  const latestVersion = poster ? poster.currentVersion || versions.length : 1;

  const previewContent = useMemo(() => {
    if (!poster) return null;
    if (previewVersion == null) return toPreviewContent(poster.content);
    const match = versions.find(
      (version, index) => versionNumberOf(version, index) === previewVersion
    );
    return toPreviewContent(match ? match.content : poster.content);
  }, [poster, previewVersion, versions]);

  const authorName = (id) => {
    const key = String(id?._id || id || '');
    if (!key) return '';
    if (canSeeAuthors && namesById[key]) return namesById[key];
    if (currentUserId && key === String(currentUserId)) return 'You';
    return '';
  };

  const handleRestore = async (versionNumber) => {
    if (!poster) return;
    const ok = window.confirm(
      `Use version ${versionNumber} again?\n\nThe poster goes back to that text. Nothing you have now is lost — it stays in the list.`
    );
    if (!ok) return;

    try {
      setRestoring(versionNumber);
      const response = await api.post(`/posters/${poster._id}/restore`, {
        versionNumber,
        expectedVersion: poster.currentVersion,
      });
      const updated = response.data?.data?.poster;
      if (!response.data?.success || !updated) throw new Error('missing');
      setPoster(updated);
      setPreviewVersion(null);
      setRestoreError('');
      onChanged?.(updated);
      toast.success(`Version ${versionNumber} is now the latest`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setRestoreError('This poster changed somewhere else. Reload to continue.');
      } else if (status === 404) {
        setRestoreError("We couldn't find this poster. It may have been deleted.");
      } else {
        setRestoreError('We could not bring back that version. Please try again.');
      }
    } finally {
      setRestoring(null);
    }
  };

  const handleRegenerate = () => {
    onClose();
    navigate(`/create?poster=${posterId}`);
  };

  if (!posterId) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-heading/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-canvas border-l border-line shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Poster details"
      >
        <div className="p-4 sm:px-6 border-b border-line flex items-start justify-between gap-3 bg-section/50">
          <div className="min-w-0">
            <h2 className="text-base truncate" title={poster?.title || ''}>
              {poster ? poster.title || 'Untitled poster' : 'Poster details'}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {poster ? `Version ${latestVersion}` : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-chip border border-line flex items-center justify-center text-body hover:text-heading shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="space-y-4" aria-busy="true">
              <div className="w-full rounded-card bg-preview animate-pulse" style={{ aspectRatio: '0.8' }} />
              <div className="h-4 w-2/3 rounded bg-section animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-section animate-pulse" />
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <div
                role="alert"
                className="flex items-start gap-2 p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={() => setReloadToken((t) => t + 1)} className="btn-ghost border border-line text-xs">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          )}

          {!loading && !error && poster && (
            <>
              <div className="rounded-card overflow-hidden border border-line bg-preview">
                {template && brandKit && previewContent ? (
                  <PosterPreview
                    brandKit={brandKit}
                    template={template}
                    content={previewContent}
                    className="p-3"
                  />
                ) : poster.thumbnailUrl ? (
                  <img src={poster.thumbnailUrl} alt="" className="w-full object-cover" />
                ) : (
                  <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted text-sm">
                    <ImageIcon className="w-8 h-8" />
                    <span>Preview not available</span>
                  </div>
                )}
              </div>

              {restoreError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger/5 px-3 py-2.5"
                >
                  <span className="flex items-start gap-2 text-sm text-danger">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{restoreError}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReloadToken((token) => token + 1)}
                    className="text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Reload this poster
                  </button>
                </div>
              )}

              {previewVersion != null && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-section px-3 py-2">
                  <span className="text-xs text-body">
                    You are looking at version {previewVersion}. The poster itself is unchanged.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewVersion(null)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Back to the latest
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Status</p>
                  <p className="mt-0.5 text-body">{STATUS_LABELS[poster.status] || 'Draft'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Last changed</p>
                  <p className="mt-0.5 text-body" title={fullDateTime(poster.updatedAt)}>
                    {timeAgo(poster.updatedAt)}
                  </p>
                </div>
                {showAuthors && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted">Created by</p>
                    <p className="mt-0.5 text-body">{authorName(poster.userId) || '—'}</p>
                  </div>
                )}
              </div>

              <button type="button" onClick={handleRegenerate} className="btn-primary w-full justify-center">
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>

              <div>
                <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
                  <HistoryIcon className="w-3.5 h-3.5" /> Changes
                </h3>
                <ul className="space-y-2">
                  {versions
                    .map((version, index) => ({ version, number: versionNumberOf(version, index) }))
                    .sort((a, b) => b.number - a.number)
                    .map(({ version, number }) => {
                      const isLatest = number === latestVersion;
                      const isPreviewing = previewVersion === number;
                      const who = authorName(version.createdBy);
                      return (
                        <li
                          key={number}
                          className={`rounded-card border px-3 py-2.5 ${
                            isPreviewing ? 'border-primary bg-primary/5' : 'border-line bg-canvas'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-heading font-medium">
                                Version {number}
                                {isLatest && (
                                  <span className="ml-2 inline-flex items-center gap-1 rounded-chip bg-success/10 text-success px-2 py-0.5 text-[11px] font-medium">
                                    <Check className="w-3 h-3" /> Current
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted mt-0.5 truncate">{version.note || 'Saved'}</p>
                              <p
                                className="text-[11px] text-muted mt-1"
                                title={fullDateTime(version.createdAt)}
                              >
                                {[timeAgo(version.createdAt), who].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewVersion(isPreviewing ? null : number)}
                                className={`text-xs px-2.5 py-1 rounded-chip border transition-colors ${
                                  isPreviewing
                                    ? 'border-primary text-primary'
                                    : 'border-line text-body hover:text-heading'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                                {isPreviewing ? 'Previewing' : 'Preview'}
                              </button>
                              <button
                                type="button"
                                disabled={isLatest || restoring != null}
                                onClick={() => handleRestore(number)}
                                className="text-xs px-2.5 py-1 rounded-chip border border-line text-body hover:text-heading disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {restoring === number ? (
                                  <Loader2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                                )}
                                Restore this version
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
