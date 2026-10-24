import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Palette,
  LayoutTemplate,
  Sparkles,
  Trash2,
  Loader2,
  Images,
  Building2,
  Users,
  ArrowRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import PosterCard, { PosterCardSkeleton } from "../components/PosterCard";
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

function idOf(item) {
  return String(item?._id || item?.id || "");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, activeClientId, selectActiveClient, can } = useAuth();

  // Tenant / Client workspace state
  const [posters, setPosters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [posterToDelete, setPosterToDelete] = useState(null);
  const [deletingPoster, setDeletingPoster] = useState(false);

  // Superadmin platform overview state
  const [clients, setClients] = useState([]);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [clientSearch, setClientSearch] = useState("");

  const isSuperadminWithoutClient = user?.role === "superadmin" && !activeClientId;

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        if (isSuperadminWithoutClient) {
          // Platform-level overview: load organizations and users
          const [clientsRes, usersRes] = await Promise.all([
            api.get("/clients").catch(() => null),
            api.get("/users").catch(() => null),
          ]);

          if (!active) return;

          if (clientsRes?.data?.success) {
            setClients(clientsRes.data.data?.clients || []);
          }
          if (usersRes?.data?.success) {
            setPlatformUsers(usersRes.data.data?.users || []);
          }
        } else {
          // Organization workspace: load posters and templates
          const [postersRes, templatesRes, clientsRes] = await Promise.all([
            api.get("/posters", { params: { page: 1, limit: 4 } }).catch(() => null),
            api.get("/templates").catch(() => null),
            user?.role === "superadmin" ? api.get("/clients").catch(() => null) : null,
          ]);

          if (!active) return;

          if (postersRes?.data?.success) {
            setPosters(postersRes.data.data?.items || []);
          }
          if (templatesRes?.data?.success) {
            setTemplates(templatesRes.data.data?.templates || []);
          }
          if (clientsRes?.data?.success) {
            setClients(clientsRes.data.data?.clients || []);
          }
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
  }, [activeClientId, isSuperadminWithoutClient, user?.role]);

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

  const handleDelete = (poster) => {
    setPosterToDelete(poster);
  };

  const confirmDeletePoster = async () => {
    if (!posterToDelete) return;
    const id = idOf(posterToDelete);
    setDeletingPoster(true);
    setBusy(id, true);
    try {
      const response = await api.delete(`/posters/${id}`);
      if (!response.data?.success) throw new Error("bad response");
      setPosters((prev) => prev.filter((p) => idOf(p) !== id));
      toast.success("Poster deleted");
      setPosterToDelete(null);
    } catch {
      toast.error("We could not delete this poster. Please try again.");
    } finally {
      setBusy(id, false);
      setDeletingPoster(false);
    }
  };

  const categoryOf = (templateId) => {
    const template = templates.find((t) => String(t._id || t.id) === String(templateId || ""));
    if (!template) return "";
    return (template.category || "").trim() || template.name || "";
  };

  const userName = user?.name ? user.name.split(" ")[0] : "";
  const activeClient = clients.find((c) => idOf(c) === String(activeClientId || ""));

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.slug || "").toLowerCase().includes(q) ||
      (c.contactEmail || "").toLowerCase().includes(q)
    );
  });

  // ==========================================
  // SUPERADMIN PLATFORM OVERVIEW (no active client)
  // ==========================================
  if (isSuperadminWithoutClient) {
    return (
      <div className="bg-white min-h-[calc(100vh-56px)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
          {/* Header */}
          <div className="pb-5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
                  Dashboard
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                  Platform overview
                </span>
              </div>
              <p className="text-sm text-[#6B7280] mt-1">
                Welcome back{userName ? `, ${userName}` : ""}. Select an organization to manage its workspace, or manage platform settings below.
              </p>
            </div>
            <Button
              asChild
              className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-none"
            >
              <Link to="/clients">
                <Plus className="w-4 h-4" />
                <span>Add organization</span>
              </Link>
            </Button>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Organizations */}
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B7280]">Organizations</span>
                <div className="w-8 h-8 rounded-[6px] bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111827]">
                {loading ? "…" : clients.length}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-xs">
                <span className="text-[#6B7280]">Active tenant accounts</span>
                <Link
                  to="/clients"
                  className="font-medium text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Card 2: Platform Users */}
            <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#6B7280]">Platform Users</span>
                <div className="w-8 h-8 rounded-[6px] bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#111827]">
                {loading ? "…" : platformUsers.length}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-xs">
                <span className="text-[#6B7280]">Total accounts</span>
                <Link
                  to="/users"
                  className="font-medium text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Organizations Chooser Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">
                  Client Organizations
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Select an organization to open its workspace and manage its posters, templates, and brand assets.
                </p>
              </div>
              <div className="w-full sm:w-64 relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search organizations…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-[6px] border-[#E5E7EB]"
                />
              </div>
            </div>

            {loading ? (
              <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 space-y-3">
                <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/3" />
                <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/2" />
                <div className="h-4 bg-[#F3F4F6] rounded animate-pulse w-1/4" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#D1D5DB] bg-white text-center py-12 px-6 space-y-3">
                <div className="w-10 h-10 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center mx-auto">
                  <Building2 className="w-5 h-5 text-[#9CA3AF]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#111827]">
                    {clientSearch ? "No matching organizations" : "No organizations yet"}
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-1 max-w-xs mx-auto">
                    {clientSearch
                      ? "Try searching with a different name or email."
                      : "Create your first client organization to begin generating on-brand posters."}
                  </p>
                </div>
                <Button
                  asChild
                  className="h-8 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-none"
                >
                  <Link to="/clients">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add organization</span>
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-[8px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
                <div className="divide-y divide-[#E5E7EB]">
                  {filteredClients.map((client) => {
                    const cid = idOf(client);
                    return (
                      <div
                        key={cid}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[6px] border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-[#4B5563]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#111827]">
                                {client.name}
                              </span>
                              <span className="capitalize text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#F3F4F6] text-[#374151]">
                                {client.plan || "starter"}
                              </span>
                              {client.isActive !== false ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#DCFCE7] text-[#15803D]">
                                  Active
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#FEF2F2] text-[#DC2626]">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              {client.contactEmail || client.slug || "No contact email"}
                              {client.createdAt && (
                                <> · Created {new Date(client.createdAt).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => selectActiveClient(cid)}
                            className="h-8 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-none"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Open workspace</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Platform Actions */}
          <div className="space-y-3 pt-2">
            <h2 className="text-base font-semibold text-[#111827]">Quick actions</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
              >
                <Link to="/clients" className="inline-flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Manage organizations</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
              >
                <Link to="/users" className="inline-flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Manage users</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-9 px-3.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
              >
                <Link to="/security" className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Security settings</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CLIENT WORKSPACE VIEW (Active Organization)
  // ==========================================
  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Superadmin Active Client Banner */}
        {user?.role === "superadmin" && (
          <div className="rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1E40AF]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
              <span>
                You are currently managing workspace:{" "}
                <strong className="font-semibold text-[#1E3A8A]">
                  {activeClient?.name || "Selected organization"}
                </strong>
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectActiveClient("")}
              className="h-7 px-2.5 rounded-[6px] border-[#BFDBFE] bg-white text-[11px] font-medium text-[#1E40AF] hover:bg-[#DBEAFE] shadow-none"
            >
              Back to platform overview
            </Button>
          </div>
        )}

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
            className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-none"
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
                className="h-8 px-3 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-none"
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
              <Link to="/posters" className="inline-flex items-center gap-2">
                <Images className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>View all posters</span>
              </Link>
            </Button>
            {can?.("brandkit:write") && (
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
            )}
            {can?.("templates:write") && (
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
            )}
          </div>
        </div>
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
