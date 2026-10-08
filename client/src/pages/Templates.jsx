import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  LayoutGrid,
  Loader2,
  Plus,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import TemplateCard, { TemplateCardSkeleton } from "../components/TemplateCard";
import DeleteTemplateDialog from "../components/DeleteTemplateDialog";
import { templateIdOf } from "../utils/templateRender";
import { Button } from "../components/ui/button";

const CONFLICT_MESSAGE =
  "This template was changed somewhere else. Reload to continue.";

function friendlyError(err, fallback) {
  const status = err?.response?.status;
  if (status === 409) return CONFLICT_MESSAGE;
  return err?.response?.data?.error?.message || fallback;
}

export default function Templates() {
  const { activeClientId } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [brandKit, setBrandKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const [templatesRes, kitRes] = await Promise.all([
          api.get("/templates"),
          api.get("/brand-kit").catch(() => null),
        ]);
        const list = templatesRes?.data?.data?.templates || [];
        setTemplates(list);
        setBrandKit(
          kitRes?.data?.success ? kitRes.data.data?.brandKit || null : null,
        );
        return true;
      } catch (err) {
        setError(
          friendlyError(err, "We could not load your templates. Try again."),
        );
        return false;
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [activeClientId],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* Re-read quietly whenever the page regains focus. */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") load({ quiet: true });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const defaultTemplate = useMemo(
    () =>
      templates.find((t) => t.isDefault) ||
      templates.find((t) => t.isActive !== false) ||
      templates[0],
    [templates],
  );

  const patchItem = (id, next) => {
    setTemplates((list) =>
      list.map((t) => (templateIdOf(t) === id ? { ...t, ...next } : t)),
    );
  };

  const runOn = async (template, action, successMessage, onError) => {
    const id = templateIdOf(template);
    setBusyId(id);
    setError("");
    try {
      const response = await api.post(`/templates/${id}/${action}`);
      const updated = response?.data?.data?.template;
      if (action === "duplicate" && updated) {
        setTemplates((list) => [updated, ...list]);
      } else if (updated) {
        patchItem(id, {
          isActive: updated.isActive,
          version: updated.version,
          updatedAt: updated.updatedAt,
        });
      }
      toast.success(successMessage);
      return updated || null;
    } catch (err) {
      const message = friendlyError(err, "That did not work. Try again.");
      if (err?.response?.status === 409) {
        setError(message);
        load({ quiet: true });
      } else if (onError) {
        onError(message);
      } else {
        setError(message);
      }
      return null;
    } finally {
      setBusyId("");
    }
  };

  const openEditor = (template) => {
    navigate(`/templates/${templateIdOf(template)}/edit`);
  };

  const deleteTarget = useMemo(
    () => templates.find((t) => templateIdOf(t) === deleting?.id) || null,
    [templates, deleting],
  );

  const openDelete = (template) => {
    setDeleteError("");
    setDeleting({ id: templateIdOf(template) });
  };

  const closeDelete = () => {
    setDeleting(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = templateIdOf(deleteTarget);
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api.delete(`/templates/${id}`);
      setTemplates((list) => list.filter((t) => templateIdOf(t) !== id));
      closeDelete();
      toast.success("Template deleted.");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 409) {
        closeDelete();
        setError(
          friendlyError(
            err,
            "This template is no longer here. We've reloaded the list.",
          ),
        );
        load({ quiet: true });
      } else {
        setDeleteError(
          friendlyError(err, "We could not delete this template. Try again."),
        );
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const newTemplate = async () => {
    if (!defaultTemplate) {
      setError("Create a template first, then you can copy it.");
      return;
    }
    setCreating(true);
    const created = await runOn(
      defaultTemplate,
      "duplicate",
      "Template created. Open it to set it up.",
    );
    setCreating(false);
    if (created) openEditor(created);
  };

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
              Templates
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              The layouts your team can choose from. Your brand kit fills in the
              header and footer.
            </p>
          </div>
          <Button
            onClick={newTemplate}
            disabled={creating || loading || !templates.length}
            className="h-9 px-3.5 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors shadow-none disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>New template</span>
          </Button>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-sm text-[#DC2626]">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#DC2626]" />
              <span className="flex-1">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => load({ quiet: true })}
              className="text-xs font-medium text-[#2563EB] hover:underline shrink-0"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && brandKit === null && templates.length > 0 && (
          <p className="text-xs text-[#6B7280]">
            Previews use standard colours because this organization has no brand
            kit yet.
          </p>
        )}

        {/* Responsive Grid (4 / 3 / 2 columns) */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <TemplateCardSkeleton key={index} />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-12 text-center">
            <LayoutGrid className="mx-auto h-10 w-10 text-[#9CA3AF]" />
            <h3 className="mt-3 text-sm font-medium text-[#111827]">
              No templates yet
            </h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Choose New template to start from a layout that already works.
            </p>
            <Button
              onClick={newTemplate}
              disabled={creating}
              className="mt-4 h-9 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium shadow-none inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create template</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={templateIdOf(template)}
                template={template}
                brandKit={brandKit}
                busy={busyId === templateIdOf(template)}
                onEdit={() => openEditor(template)}
                onDuplicate={() =>
                  runOn(
                    template,
                    "duplicate",
                    "Copy created. Turn it on when you are happy with it.",
                  )
                }
                onToggleActive={() =>
                  runOn(
                    template,
                    template.isActive === false ? "activate" : "deactivate",
                    template.isActive === false
                      ? "Template is now available to your team."
                      : "Template is now hidden from the Create page.",
                  )
                }
                onDelete={() => openDelete(template)}
              />
            ))}
          </div>
        )}

        {deleteTarget && (
          <DeleteTemplateDialog
            template={deleteTarget}
            error={deleteError}
            busy={deleteBusy || busyId === templateIdOf(deleteTarget)}
            onCancel={closeDelete}
            onConfirm={confirmDelete}
            onDeactivate={() =>
              runOn(
                deleteTarget,
                "deactivate",
                "Template is now hidden from the Create page.",
                setDeleteError,
              )
            }
          />
        )}
      </div>
    </div>
  );
}
