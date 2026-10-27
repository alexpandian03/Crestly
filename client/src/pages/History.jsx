import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { PosterCardSkeleton } from "../components/PosterCard";
import PosterDetailDrawer from "../components/PosterDetailDrawer";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

function idOf(poster) {
  return String(poster?._id || poster?.id || "");
}

function friendlyListError(err) {
  const status = err.response?.status;
  if (status === 404) return "We could not find these posters. Please refresh.";
  return "We could not load your posters. Please try again.";
}

export default function History() {
  const navigate = useNavigate();
  const { user, role, activeClientId, can } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [templates, setTemplates] = useState([]);
  const [brandKit, setBrandKit] = useState(null);
  const [namesById, setNamesById] = useState({});

  const [busyIds, setBusyIds] = useState(() => new Set());
  const [posterToDelete, setPosterToDelete] = useState(null);
  const [deletingPoster, setDeletingPoster] = useState(false);
  const [openId, setOpenId] = useState("");

  const requestSeqRef = useRef(0);

  const canSeeAuthors = can ? can('posters:read:all') : (role === "clientadmin" || role === "superadmin");

  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(searchText.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      const [templatesRes, brandKitRes] = await Promise.all([
        api.get("/templates").catch(() => null),
        api.get("/brand-kit").catch(() => null),
      ]);
      if (!active) return;
      if (templatesRes?.data?.success)
        setTemplates(templatesRes.data.data?.templates || []);
      const loadedKit = brandKitRes?.data?.data?.brandKit;
      if (brandKitRes?.data?.success && loadedKit) setBrandKit(loadedKit);
    }

    loadContext();
    return () => {
      active = false;
    };
  }, [activeClientId]);

  useEffect(() => {
    if (!canSeeAuthors) return undefined;
    let active = true;

    async function loadNames() {
      try {
        const params = {};
        if (role === "superadmin" && activeClientId)
          params.clientId = activeClientId;
        const response = await api.get("/users", { params });
        const users = response.data?.data?.users || [];
        if (!active) return;
        setNamesById(
          users.reduce((acc, item) => {
            acc[String(item.id || item._id)] = item.name;
            return acc;
          }, {}),
        );
      } catch {
        /* names are a nicety — the page works without them */
      }
    }

    loadNames();
    return () => {
      active = false;
    };
  }, [canSeeAuthors, role, activeClientId]);

  const buildParams = useCallback(
    (targetPage) => {
      const params = { page: targetPage, limit: PAGE_SIZE };
      if (query) params.q = query;
      return params;
    },
    [query],
  );

  useEffect(() => {
    let active = true;
    const seq = ++requestSeqRef.current;

    async function loadFirstPage() {
      try {
        setLoading(true);
        setListError("");
        const response = await api.get("/posters", { params: buildParams(1) });
        if (!active || seq !== requestSeqRef.current) return;
        const data = response.data?.data;
        if (!response.data?.success || !data) throw new Error("bad response");
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setPage(1);
      } catch (err) {
        if (active && seq === requestSeqRef.current) {
          setListError(friendlyListError(err));
          setItems([]);
          setTotal(0);
          setPages(1);
        }
      } finally {
        if (active && seq === requestSeqRef.current) setLoading(false);
      }
    }

    loadFirstPage();
    return () => {
      active = false;
    };
  }, [buildParams, activeClientId, reloadToken]);

  const templatesById = useMemo(() => {
    const map = new Map();
    templates.forEach((template) => {
      map.set(String(template._id || template.id), template);
    });
    return map;
  }, [templates]);

  const categoryOf = (templateId) => {
    const template = templatesById.get(String(templateId || ""));
    if (!template) return "";
    return (template.category || "").trim() || template.name || "";
  };

  const setBusy = (id, nextBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (nextBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  async function handleDuplicate(poster) {
    const id = idOf(poster);
    setBusy(id, true);
    try {
      const response = await api.post(`/posters/${id}/duplicate`);
      const copy = response.data?.data?.poster;
      if (!response.data?.success || !copy) throw new Error("bad response");
      setItems((prev) => [
        copy,
        ...prev.filter((item) => idOf(item) !== idOf(copy)),
      ]);
      setTotal((prev) => prev + 1);
      toast.success("Duplicated. The copy is at the top of your list.");
    } catch (err) {
      toast.error(
        err.response?.status === 404
          ? "We couldn't find this poster. It may have been deleted."
          : "We could not duplicate this poster. Please try again.",
      );
    } finally {
      setBusy(id, false);
    }
  }

  function handleDelete(poster) {
    setPosterToDelete(poster);
  }

  async function confirmDeletePoster() {
    if (!posterToDelete) return;
    const id = idOf(posterToDelete);
    setDeletingPoster(true);
    setBusy(id, true);
    try {
      const response = await api.delete(`/posters/${id}`);
      if (!response.data?.success) throw new Error("bad response");
      setItems((prev) => prev.filter((item) => idOf(item) !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      if (openId === id) setOpenId("");
      toast.success("Poster deleted");
      setPosterToDelete(null);
    } catch (err) {
      toast.error(
        err.response?.status === 404
          ? "This poster is already gone. Refresh the list."
          : "We could not delete this poster. Please try again.",
      );
    } finally {
      setBusy(id, false);
      setDeletingPoster(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore || page >= pages) return;
    const seq = ++requestSeqRef.current;
    try {
      setLoadingMore(true);
      const response = await api.get("/posters", {
        params: buildParams(page + 1),
      });
      if (seq !== requestSeqRef.current) return;
      const data = response.data?.data;
      if (!response.data?.success || !data) throw new Error("bad response");
      setItems((prev) => {
        const seen = new Set(prev.map((item) => idOf(item)));
        return [
          ...prev,
          ...(data.items || []).filter((item) => !seen.has(idOf(item))),
        ];
      });
      setTotal(data.total || total);
      setPages(data.pages || pages);
      setPage(page + 1);
    } catch (err) {
      toast.error(friendlyListError(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const handlePosterChanged = useCallback((updated) => {
    setItems((prev) =>
      prev.map((item) =>
        idOf(item) === idOf(updated) ? { ...item, ...updated } : item,
      ),
    );
  }, []);

  const openInEditor = (poster) => navigate(`/create?poster=${idOf(poster)}`);

  const openPoster = useMemo(
    () => items.find((item) => idOf(item) === openId) || null,
    [items, openId],
  );
  const openTemplateId = openPoster?.templateId;
  const openTemplate = templatesById.get(String(openTemplateId || "")) || null;

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              Posters
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Every poster you have saved, with its earlier versions.
            </p>
          </div>
          <Button
            asChild
            className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Link to="/create">
              <Plus className="w-4 h-4" />
              <span>New poster</span>
            </Link>
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by headline or description"
              className="h-9 pl-9 pr-8 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] placeholder:text-[#9CA3AF] focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              aria-label="Search posters"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827]"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!loading && !listError && items.length > 0 && (
            <span className="text-xs text-[#6B7280]">
              Showing {items.length} of {total} poster{total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {listError && (
          <div className="p-4 rounded-[8px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-xs font-semibold text-[#DC2626]">
                  Posters not loaded
                </h2>
                <p className="text-xs text-[#DC2626] mt-0.5">{listError}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadToken((token) => token + 1)}
              className="h-8 rounded-[6px] border-[#DC2626]/30 bg-white text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] shrink-0"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Try again
            </Button>
          </div>
        )}

        {/* Loading state: shadcn Skeleton cards */}
        {loading && (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            aria-busy="true"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <PosterCardSkeleton key={index} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !listError && items.length === 0 && (
          <div className="rounded-[8px] border border-dashed border-[#D1D5DB] bg-white text-center py-16 px-6 space-y-4 max-w-md mx-auto">
            <div className="w-10 h-10 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5 text-[#9CA3AF]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                {query ? "No posters match your search" : "No posters yet"}
              </h2>
              <p className="text-xs text-[#6B7280] mt-1 max-w-xs mx-auto leading-relaxed">
                {query
                  ? "Try searching for a different word or clear your search to see all posters."
                  : "Describe what you need and we will write the words for your poster."}
              </p>
            </div>
            {query ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchText("")}
                className="h-8 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
              >
                <X className="w-3.5 h-3.5 mr-1 text-[#6B7280]" /> Clear search
              </Button>
            ) : (
              <Button
                asChild
                className="h-9 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Link to="/create">
                  <Plus className="w-4 h-4" /> Create poster
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Grid and Load More */}
        {!loading && !listError && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((poster) => {
                const template = templatesById.get(
                  String(poster.templateId || ""),
                );
                const size = poster.design?.template?.size || template?.size;
                return (
                  <PosterCard
                    key={idOf(poster)}
                    poster={poster}
                    category={categoryOf(poster.templateId)}
                    createdByName={
                      canSeeAuthors ? namesById[String(poster.userId)] || "" : ""
                    }
                    aspectRatio={
                      size?.width && size?.height ? size.width / size.height : 0.8
                    }
                    busy={busyIds.has(idOf(poster))}
                    onOpenDetail={(item) => setOpenId(idOf(item))}
                    onOpenInEditor={openInEditor}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                );
              })}
            </div>

            {page < pages && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="h-9 px-4 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] transition-colors"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1.5 text-[#6B7280]" />
                  )}
                  <span>{loadingMore ? "Loading…" : "Load more"}</span>
                </Button>
              </div>
            )}
          </>
        )}

        {openId && (
          <PosterDetailDrawer
            key={openId}
            posterId={openId}
            brandKit={brandKit}
            template={openTemplate}
            templates={templates}
            namesById={namesById}
            currentUserId={user?.id || ""}
            canSeeAuthors={canSeeAuthors}
            showAuthors={canSeeAuthors}
            onClose={() => setOpenId("")}
            onChanged={handlePosterChanged}
          />
        )}
      </div>
    
        {/* Delete poster confirmation modal */}
        <Dialog
          open={Boolean(posterToDelete)}
          onOpenChange={(open) => {
            if (!open && !deletingPoster) setPosterToDelete(null);
          }}
        >
          <DialogContent className="sm:max-w-md rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#111827]">
                Delete poster
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                Are you sure you want to delete{" "}
                <strong className="font-semibold text-[#111827]">
                  {posterToDelete?.title ? `“${posterToDelete.title}”` : "this poster"}
                </strong>
                ? It will be removed from your list.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-4 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deletingPoster}
                onClick={() => setPosterToDelete(null)}
                className="h-8 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#F3F4F6]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={deletingPoster}
                onClick={confirmDeletePoster}
                className="h-8 rounded-[6px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-none disabled:opacity-50"
              >
                {deletingPoster ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{deletingPoster ? "Deleting..." : "Delete"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
</div>
  );
}
