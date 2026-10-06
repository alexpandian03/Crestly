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
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { PosterCardSkeleton } from "../components/PosterCard";
import PosterDetailDrawer from "../components/PosterDetailDrawer";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Waiting for review" },
  { value: "approved", label: "Approved" },
];

function idOf(poster) {
  return String(poster?._id || poster?.id || "");
}

function friendlyListError(err) {
  const status = err.response?.status;
  if (status === 404) return "We could not find these posters. Please refresh.";
  return "We could not load your posters. Please try again.";
}

function dateParam(value, endOfDay) {
  if (!value) return "";
  const time = endOfDay ? "T23:59:59.999" : "T00:00:00";
  const parsed = new Date(`${value}${time}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export default function History() {
  const navigate = useNavigate();
  const { user, role, activeClientId } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [templates, setTemplates] = useState([]);
  const [brandKit, setBrandKit] = useState(null);
  const [namesById, setNamesById] = useState({});

  const [busyIds, setBusyIds] = useState(() => new Set());
  const [openId, setOpenId] = useState("");

  const requestSeqRef = useRef(0);

  const canSeeAuthors = role === "clientadmin" || role === "superadmin";

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
      if (category) params.category = category;
      if (status) params.status = status;
      const fromParam = dateParam(from, false);
      const toParam = dateParam(to, true);
      if (fromParam) params.from = fromParam;
      if (toParam) params.to = toParam;
      return params;
    },
    [query, category, status, from, to],
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

  const filtersActive = Boolean(query || category || status || from || to);
  const activeFilterCount = [query, category, status, from || to].filter(
    Boolean,
  ).length;

  const categories = useMemo(() => {
    const set = new Set();
    templates.forEach((template) => {
      const value = (template.category || "").trim();
      if (value) set.add(value);
    });
    return [...set].sort();
  }, [templates]);

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

  async function handleDelete(poster) {
    const id = idOf(poster);
    const label = poster.title || "this poster";
    const ok = window.confirm(
      `Delete “${label}”?\n\nIt will be removed from your list.`,
    );
    if (!ok) return;

    setBusy(id, true);
    try {
      const response = await api.delete(`/posters/${id}`);
      if (!response.data?.success) throw new Error("bad response");
      setItems((prev) => prev.filter((item) => idOf(item) !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      if (openId === id) setOpenId("");
      toast.success("Poster deleted");
    } catch (err) {
      toast.error(
        err.response?.status === 404
          ? "This poster is already gone. Refresh the list."
          : "We could not delete this poster. Please try again.",
      );
    } finally {
      setBusy(id, false);
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

  const clearFilters = () => {
    setSearchText("");
    setQuery("");
    setCategory("");
    setStatus("");
    setFrom("");
    setTo("");
  };

  const openPoster = useMemo(
    () => items.find((item) => idOf(item) === openId) || null,
    [items, openId],
  );
  const openTemplateId = openPoster?.templateId;
  const openTemplate = templatesById.get(String(openTemplateId || "")) || null;

  return (
    <div className="container-page section-pad space-y-6">
      <div className="pb-6 border-b border-line flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">My posters</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every poster you have saved, with its earlier versions.
          </p>
        </div>
        <Link to="/create" className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> New poster
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by headline or description"
              className="input-field pl-9 pr-9"
              aria-label="Search posters"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-heading"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            className={`btn-ghost border border-line text-xs ${showFilters || category || status || from || to ? "text-primary" : ""}`}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {filtersActive && (
              <span className="rounded-chip bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-semibold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showFilters && (
          <div className="card-surface p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-xs">
              <span className="text-muted-foreground">Type</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="input-field mt-1"
              >
                <option value="">Any type</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="text-muted-foreground">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="input-field mt-1"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="text-muted-foreground">Changed from</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="input-field mt-1"
              />
            </label>

            <label className="block text-xs">
              <span className="text-muted-foreground">Changed until</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className="input-field mt-1"
              />
            </label>

            {filtersActive && (
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-ghost text-xs"
                >
                  <X className="w-4 h-4" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !listError && items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {items.length} of {total} poster{total === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {listError && (
        <div className="card-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-danger/30 bg-danger/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-heading">
                Posters not loaded
              </h2>
              <p className="text-sm text-body mt-1">{listError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="btn-primary text-xs shrink-0"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      )}

      {loading && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          aria-busy="true"
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <PosterCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!loading && !listError && items.length === 0 && (
        <div className="card-surface text-center py-16 px-6 space-y-4">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <h2 className="text-base">
              {filtersActive
                ? "No posters match these filters"
                : "No posters yet"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtersActive
                ? "Try a different word, or clear the filters to see everything."
                : "Describe what you need and we will write the words for your poster."}
            </p>
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-ghost border border-line"
            >
              <X className="w-4 h-4" /> Clear filters
            </button>
          ) : (
            <Link to="/create" className="btn-primary inline-flex">
              <Sparkles className="w-4 h-4" /> Create your first poster
            </Link>
          )}
        </div>
      )}

      {!loading && !listError && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((poster) => {
              const template = templatesById.get(
                String(poster.templateId || ""),
              );
              /* The shape the poster was saved with, so a resized template cannot change old cards. */
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
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-ghost border border-line"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{loadingMore ? "Loading…" : "Load more"}</span>
              </button>
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
  );
}
