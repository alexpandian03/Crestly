import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import TemplateCard from "../components/TemplateCard";
import DeleteTemplateDialog from "../components/DeleteTemplateDialog";
import { templateIdOf } from "../utils/templateRender";

const CONFLICT_MESSAGE =
  "This template was changed somewhere else. Reload to continue.";

function friendlyError(err, fallback) {
  const status = err?.response?.status;
  if (status === 409) return CONFLICT_MESSAGE;
  return err?.response?.data?.error?.message || fallback;
}

function CardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="bg-preview p-3">
        <div
          className="w-[132px] mx-auto animate-pulse rounded bg-section"
          style={{ aspectRatio: "0.8" }}
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-section animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-section animate-pulse" />
        <div className="h-5 w-full rounded-chip bg-section animate-pulse" />
      </div>
    </div>
  );
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
    // A different organization means a different template set and brand.
    [activeClientId],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* Coming back to the tab has to show the newest look, so the list is re-read quietly
     whenever the page becomes visible or regains focus — including after the editor saved. */
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

  /* The card the dialog shows, always read from the live list, so turning a template
     off inside the dialog immediately changes what the dialog offers. */
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
    <div className="container-page section-pad space-y-6">
      <div className="pb-6 border-b border-line flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" /> Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The layouts your team can choose from. Your brand kit fills in the
            header and footer.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </button>
          <button
            type="button"
            onClick={newTemplate}
            disabled={creating || loading || !templates.length}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New template
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => load({ quiet: true })}
            className="underline shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && brandKit === null && templates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Previews use standard colours because this organization has no brand
          kit yet.
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-heading">
            No templates yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose New template to start from a layout that already works.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
