import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Palette, LayoutTemplate, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { PosterCardSkeleton } from "../components/PosterCard";
import { Button } from "../components/ui/button";

function idOf(poster) {
  return String(poster?._id || poster?.id || "");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, activeClientId } = useAuth();
  const [posters, setPosters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [healthStatus, setHealthStatus] = useState("API OK · Database connected");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [postersRes, templatesRes, healthRes] = await Promise.all([
          api.get("/posters", { params: { page: 1, limit: 4 } }).catch(() => null),
          api.get("/templates").catch(() => null),
          api.get("/health").catch(() => null),
        ]);

        if (!active) return;

        if (postersRes?.data?.success) {
          setPosters(postersRes.data.data?.items || []);
        }
        if (templatesRes?.data?.success) {
          setTemplates(templatesRes.data.data?.templates || []);
        }
        if (healthRes?.data?.status === "ok" || healthRes?.data?.db === "connected") {
          setHealthStatus("API OK · Database connected");
        }
      } catch {
        // graceful fallback
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [activeClientId]);

  const setBusy = (id, nextBusy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (nextBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDuplicate = async (poster) => {
    const id = idOf(poster);
    setBusy(id, true);
    try {
      const response = await api.post(`/posters/${id}/duplicate`);
      const copy = response.data?.data?.poster;
      if (!response.data?.success || !copy) throw new Error("bad response");
      setPosters((prev) => [copy, ...prev.filter((p) => idOf(p) !== idOf(copy))].slice(0, 4));
      toast.success("Duplicated. The copy is at the top of your list.");
    } catch {
      toast.error("We could not duplicate this poster. Please try again.");
    } finally {
      setBusy(id, false);
    }
  };

  const handleDelete = async (poster) => {
    const id = idOf(poster);
    const label = poster.title || "this poster";
    const ok = window.confirm(`Delete “${label}”?\n\nIt will be removed from your list.`);
    if (!ok) return;

    setBusy(id, true);
    try {
      const response = await api.delete(`/posters/${id}`);
      if (!response.data?.success) throw new Error("bad response");
      setPosters((prev) => prev.filter((p) => idOf(p) !== id));
      toast.success("Poster deleted");
    } catch {
      toast.error("We could not delete this poster. Please try again.");
    } finally {
      setBusy(id, false);
    }
  };

  const categoryOf = (templateId) => {
    const template = templates.find((t) => String(t._id || t.id) === String(templateId || ""));
    if (!template) return "";
    return (template.category || "").trim() || template.name || "";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "";

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Header */}
        <div className="pb-5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              Dashboard
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Welcome back{userName ? `, ${userName}` : ""}
            </p>
          </div>
          <Button
            asChild
            className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Link to="/create">
              <Plus className="w-4 h-4" />
              <span>Create poster</span>
            </Link>
          </Button>
        </div>

        {/* Recent posters section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#111827]">
              Recent posters
            </h2>
            <Link
              to="/posters"
              className="text-xs font-medium text-[#2563EB] hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <PosterCardSkeleton key={index} />
              ))}
            </div>
          ) : posters.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {posters.map((poster) => (
                <PosterCard
                  key={idOf(poster)}
                  poster={poster}
                  category={categoryOf(poster.templateId)}
                  aspectRatio={0.8}
                  busy={busyIds.has(idOf(poster))}
                  onOpenDetail={(item) => navigate(`/create?poster=${idOf(item)}`)}
                  onOpenInEditor={(item) => navigate(`/create?poster=${idOf(item)}`)}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#D1D5DB] bg-white text-center py-12 px-6 space-y-3">
              <div className="w-10 h-10 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  No posters yet
                </h3>
                <p className="text-xs text-[#6B7280] mt-1 max-w-xs mx-auto">
                  Describe your event and create your first on-brand poster.
                </p>
              </div>
              <Button
                asChild
                className="h-8 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Link to="/create">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create poster</span>
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Quick actions section */}
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-semibold text-[#111827]">
            Quick actions
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Link to="/create" className="inline-flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Create poster</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Link to="/brand-kit" className="inline-flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Edit brand kit</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Link to="/templates" className="inline-flex items-center gap-2">
                <LayoutTemplate className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Manage templates</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Bottom system status text */}
        <div className="pt-8 border-t border-[#E5E7EB] text-center">
          <p className="text-xs text-[#9CA3AF]">
            {healthStatus}
          </p>
        </div>
      </div>
    </div>
  );
}
