import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { extractEventFacts } from "../../../shared/fallbackParser.js";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Edit3,
  Lock,
  AlertTriangle,
  Save,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import api from "../services/api";
import PosterPreview from "../components/PosterPreview";
import PosterExportButtons from "../components/PosterExportButtons";
import PosterImageInput from "../components/PosterImageInput";
import EditTextPanel from "../components/EditTextPanel";
import { renderAndUploadThumbnail } from "../utils/posterThumbnail";
import { clearDraft, readDraft } from "../config/draft";
import { SAMPLE_PROMPTS } from "../data/demoPosters";
import { useAuth } from "../context/AuthContext";
import { useAutosave } from "../hooks/useAutosave";
import DraftRestoreDialog from "../components/DraftRestoreDialog";

const isRealId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const DEFAULT_FRAME_TEMPLATE = {
  name: "Standard poster",
  size: { width: 1080, height: 1350 },
};

const STAGE_WIDTH = "w-full max-w-[560px] xl:max-w-[660px]";

function buildContentPayload(content) {
  if (!content) return null;
  return {
    title: String(content.title || "").trim(),
    tagline: String(content.tagline || "").trim(),
    date: String(content.date || "").trim(),
    time: String(content.time || "").trim(),
    venue: String(content.venue || "").trim(),
    details: Array.isArray(content.details)
      ? content.details
          .map((d) => String(d).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    imageUrl: String(content.imageUrl || content.image || "").trim(),
  };
}

function friendlySaveError(err) {
  const status = err.response?.status;
  if (status === 409) {
    return {
      message: "This poster was changed somewhere else. Reload to continue.",
      conflict: true,
    };
  }
  if (status === 404) {
    return {
      message: "We couldn't find this poster. It may have been deleted.",
      conflict: false,
    };
  }
  return {
    message: "We couldn't save this poster. Try again.",
    conflict: false,
  };
}

function SkeletonPoster() {
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
      <Skeleton className="w-full aspect-[4/5] rounded-[8px] border border-[#E5E7EB] bg-[#E5E7EB]/60" />
      <div className="mt-4 flex items-center gap-2 text-xs text-[#6B7280]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
        <span>Generating your poster with Hugging Face...</span>
      </div>
    </div>
  );
}

export default function Generate() {
  const { activeClientId } = useAuth();
  const [description, setDescription] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [posterDesign, setPosterDesign] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [rawGeneratedContent, setRawGeneratedContent] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: "" });
  const [userImageUrl, setUserImageUrl] = useState("");
  const [imageLoadError, setImageLoadError] = useState(false);

  const [searchParams] = useSearchParams();
  const [posterId, setPosterId] = useState("");
  const [currentVersion, setCurrentVersion] = useState(1);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState(null);
  const [showSavedChip, setShowSavedChip] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [drawerSaveError, setDrawerSaveError] = useState("");
  const [drawerConflict, setDrawerConflict] = useState(false);
  const [initialDraft, setInitialDraft] = useState(null);

  const posterIdRef = useRef("");
  const versionRef = useRef(1);
  const savedSnapshotRef = useRef("");
  const retryOpRef = useRef(null);
  const thumbSeqRef = useRef(0);
  const savedChipTimerRef = useRef(null);
  const loadedPosterRef = useRef("");

  useEffect(() => () => clearTimeout(savedChipTimerRef.current), []);

  const markSaved = (content) => {
    savedSnapshotRef.current = JSON.stringify(buildContentPayload(content));
  };

  useEffect(() => {
    const draft = readDraft();
    if (draft) setDescription(draft);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        setLoadingInitial(true);
        const [templatesRes, brandKitRes] = await Promise.all([
          api.get("/templates").catch(() => null),
          api.get("/brand-kit").catch(() => null),
        ]);
        if (cancelled) return;

        const loadedTemplates = templatesRes?.data?.data?.templates || [];
        if (templatesRes?.data?.success && loadedTemplates.length > 0) {
          setTemplates(loadedTemplates);
          if (!searchParams.get("poster")) {
            const defaultT =
              loadedTemplates.find((t) => t.isDefault && t.isActive !== false) ||
              loadedTemplates.find((t) => t.isActive !== false);
            if (defaultT) setSelectedTemplateId(defaultT.id || defaultT._id);
          }
        } else {
          setTemplates([]);
          setSelectedTemplateId("");
        }

        const loadedBrandKit = brandKitRes?.data?.data?.brandKit;
        setBrandKit(
          brandKitRes?.data?.success && loadedBrandKit ? loadedBrandKit : null,
        );
      } catch (err) {
        console.warn("Initial data load warning:", err.message);
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, searchParams]);

  const selectedTemplate = useMemo(() => {
    const active = templates.filter((t) => t.isActive !== false);
    return (
      active.find((t) => (t.id || t._id) === selectedTemplateId) ||
      active[0] ||
      DEFAULT_FRAME_TEMPLATE
    );
  }, [templates, selectedTemplateId]);

  const drawBrandKit = posterDesign?.brandKit || brandKit;
  const drawTemplate = posterDesign?.template || selectedTemplate;

  const chosenImageUrl =
    userImageUrl || generatedContent?.imageUrl || generatedContent?.image || "";

  const posterContent = useMemo(() => {
    if (!generatedContent && !userImageUrl) {
      return {
        title: "",
        tagline: "",
        date: "",
        time: "",
        venue: "",
        details: [],
        imageUrl: "",
        image: "",
        isAiGenerated: true,
      };
    }
    if (!generatedContent) {
      return {
        title: "",
        tagline: "",
        date: "",
        time: "",
        venue: "",
        details: [],
        imageUrl: userImageUrl,
        image: userImageUrl,
        isAiGenerated: true,
      };
    }
    return {
      ...generatedContent,
      imageUrl: chosenImageUrl,
      image: chosenImageUrl,
      isAiGenerated: true,
    };
  }, [generatedContent, userImageUrl, chosenImageUrl]);

  useEffect(() => {
    setImageLoadError(false);
  }, [chosenImageUrl]);

  const ready = Boolean(drawBrandKit && drawTemplate);
  const hasPoster = Boolean(posterContent?.imageUrl || posterContent?.title);

  const contentSnapshot = useMemo(
    () => (hasPoster ? JSON.stringify(buildContentPayload(posterContent)) : ""),
    [hasPoster, posterContent],
  );
  const hasUnsavedChanges =
    hasPoster && contentSnapshot !== savedSnapshotRef.current;

  const getPosterDraftData = useCallback(() => {
    if (!posterContent) return null;
    return {
      basedOnVersion: currentVersion,
      data: { content: posterContent },
    };
  }, [currentVersion, posterContent]);

  const applyPosterDraft = useCallback((draftData) => {
    if (!draftData?.content) return;
    const content = {
      ...draftData.content,
      image: draftData.content.imageUrl || "",
    };
    setGeneratedContent(content);
    setRawGeneratedContent(content);
    toast.success("Draft restored");
  }, []);

  const posterAutosave = useAutosave({
    id: posterId,
    type: "poster",
    baseVersion: currentVersion,
    isDirty: hasUnsavedChanges && Boolean(posterId),
    getData: getPosterDraftData,
    initialDraft,
    onRestore: applyPosterDraft,
    onDiscard: () => setInitialDraft(null),
    enabled: Boolean(posterId),
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const resetForNewPoster = useCallback(() => {
    posterIdRef.current = "";
    versionRef.current = 1;
    savedSnapshotRef.current = "";
    retryOpRef.current = null;
    setPosterId("");
    setCurrentVersion(1);
    setGeneratedContent(null);
    setRawGeneratedContent(null);
    setHistoryStack([]);
    setUserImageUrl("");
    setPosterDesign(null);
    setDescription("");
    setInitialDraft(null);
    setSaveStatus("idle");
    setSaveError(null);
    setDrawerSaveError("");
    setDrawerConflict(false);
    setShowSavedChip(false);
    setIsEditOpen(false);
    setFeedback({ type: null, message: "" });
  }, []);

  useEffect(() => {
    const paramId = searchParams.get("poster");
    const wanted = isRealId(paramId) ? String(paramId) : "";
    if (wanted === loadedPosterRef.current) return undefined;
    loadedPosterRef.current = wanted;
    clearDraft();
    resetForNewPoster();
    if (!wanted) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/posters/${paramId}`);
        const loaded = res.data?.data?.poster;
        if (cancelled || !loaded || String(loaded._id) !== String(paramId))
          return;
        if (loaded.draft) setInitialDraft(loaded.draft);
        const content = {
          ...loaded.content,
          image: loaded.content?.imageUrl || "",
        };
        posterIdRef.current = String(loaded._id);
        setPosterId(posterIdRef.current);
        versionRef.current = loaded.currentVersion || 1;
        setCurrentVersion(versionRef.current);
        setGeneratedContent(content);
        setRawGeneratedContent(content);
        // Only prefill the custom photo input when the saved image wasn't AI-generated,
        // so Regenerate / Generate poster still produces fresh Hugging Face artwork.
        setUserImageUrl(loaded.content?.isAiGenerated ? "" : loaded.content?.imageUrl || "");
        setPosterDesign(loaded.design || null);
        if (loaded.templateId) setSelectedTemplateId(String(loaded.templateId));
        if (loaded.prompt) setDescription(loaded.prompt);
        markSaved(content);
        setSaveError(null);
        retryOpRef.current = null;
        setFeedback({
          type: "success",
          message: "Poster loaded. Edit, regenerate or download below.",
        });
      } catch (err) {
        if (cancelled) return;
        setFeedback({
          type: "error",
          message:
            err.response?.status === 404
              ? "We couldn't find this poster. It may have been deleted."
              : "We could not open this poster. Please try again.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, resetForNewPoster]);

  const queueThumbnail = (id, content, design) => {
    if (!id || !content) return;
    const seq = ++thumbSeqRef.current;
    renderAndUploadThumbnail(
      id,
      {
        brandKit: design?.brandKit || brandKit,
        template: design?.template || selectedTemplate,
        content: { ...content, image: content.imageUrl || "" },
      },
      { shouldAbort: () => thumbSeqRef.current !== seq },
    );
  };

  const runSaveOp = async (op) => {
    try {
      setSaveStatus("saving");
      setSaveError(null);

      let poster;
      if (op.mode === "create") {
        const res = await api.post("/posters", {
          ...(op.templateId ? { templateId: op.templateId } : {}),
          prompt: op.prompt,
          content: op.content,
        });
        poster = res.data?.data?.poster;
      } else if (op.mode === "version") {
        let expected = versionRef.current;
        if (op.refreshVersion && posterIdRef.current) {
          const fresh = await api
            .get(`/posters/${posterIdRef.current}`)
            .catch(() => null);
          const freshVersion = fresh?.data?.data?.poster?.currentVersion;
          if (typeof freshVersion === "number") {
            versionRef.current = freshVersion;
            setCurrentVersion(freshVersion);
            expected = freshVersion;
          }
        }
        const res = await api.post(`/posters/${posterIdRef.current}/versions`, {
          content: op.content,
          expectedVersion: expected,
        });
        poster = res.data?.data?.poster;
      } else {
        const res = await api.patch(`/posters/${posterIdRef.current}`, {
          content: op.content,
          expectedVersion: versionRef.current,
        });
        poster = res.data?.data?.poster;
      }

      if (!poster?._id) throw new Error("Save returned no poster");

      posterIdRef.current = String(poster._id);
      setPosterId(posterIdRef.current);
      const nextVersion =
        typeof poster.currentVersion === "number"
          ? poster.currentVersion
          : versionRef.current + 1;
      versionRef.current = nextVersion;
      setCurrentVersion(nextVersion);
      const savedDesign = poster.design || posterDesign;
      setPosterDesign(savedDesign || null);

      markSaved(op.content);
      posterAutosave.setStatus("idle");
      retryOpRef.current = null;
      setSaveStatus("saved");
      setShowSavedChip(true);
      clearTimeout(savedChipTimerRef.current);
      savedChipTimerRef.current = setTimeout(
        () => setShowSavedChip(false),
        2500,
      );
      queueThumbnail(posterIdRef.current, op.content, savedDesign);
      return { ok: true };
    } catch (err) {
      const friendly = friendlySaveError(err);
      retryOpRef.current = op;
      setSaveStatus("idle");
      setSaveError(friendly);
      return { ok: false, ...friendly };
    }
  };

  const handleRetrySave = () => {
    const op = retryOpRef.current;
    if (!op) return;
    runSaveOp(
      op.mode === "version" && posterIdRef.current
        ? { ...op, refreshVersion: true }
        : op,
    );
  };

  const refreshPoster = async () => {
    const id = posterIdRef.current;
    if (!id) return;
    try {
      const res = await api.get(`/posters/${id}`);
      const loaded = res.data?.data?.poster;
      if (!loaded) throw new Error("missing poster");
      const content = {
        ...loaded.content,
        image: loaded.content?.imageUrl || "",
      };
      versionRef.current = loaded.currentVersion || 1;
      setCurrentVersion(versionRef.current);
      setGeneratedContent(content);
      setRawGeneratedContent(content);
      setUserImageUrl(
        loaded.content?.isAiGenerated ? "" : loaded.content?.imageUrl || "",
      );
      setPosterDesign(loaded.design || null);
      markSaved(content);
      setSaveError(null);
      setDrawerSaveError("");
      setDrawerConflict(false);
      setShowSavedChip(true);
      clearTimeout(savedChipTimerRef.current);
      savedChipTimerRef.current = setTimeout(
        () => setShowSavedChip(false),
        2500,
      );
    } catch {
      setSaveError({
        message: "We could not reload this poster. Please refresh the page.",
        conflict: false,
      });
    }
  };

  const getRealTemplateId = () => {
    const id = selectedTemplate?.id || selectedTemplate?._id;
    return isRealId(id) ? String(id) : "";
  };

  const runGenerate = async ({ forceGenerate = false } = {}) => {
    const promptText = description.trim();
    if (!promptText || promptText.length < 5) {
      setFeedback({
        type: "error",
        message: "Please write a sentence describing the event.",
      });
      return;
    }

    try {
      setIsGenerating(true);
      setFeedback({ type: null, message: "" });

      if (forceGenerate) {
        setUserImageUrl("");
      }
      let finalImageUrl = forceGenerate ? "" : userImageUrl?.trim() || "";

      if (!finalImageUrl) {
        let res;
        try {
          res = await api.post(
            "/posters/generate",
            {
              prompt: promptText,
              variation: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            },
            {
              responseType: "blob",
              timeout: 90000,
              headers: {
                Accept: "image/png, image/webp",
              },
            },
          );
        } catch (apiErr) {
          let msg = "";
          if (apiErr.response?.data instanceof Blob) {
            try {
              const text = await apiErr.response.data.text();
              if (text) {
                try {
                  const parsed = JSON.parse(text);
                  msg = parsed?.error?.message || parsed?.message || "";
                } catch {
                  if (!/^\s*</.test(text)) msg = text.slice(0, 220);
                }
              }
            } catch {}
          } else if (apiErr.response?.data?.error?.message) {
            msg = apiErr.response.data.error.message;
          }
          if (!msg) {
            if (apiErr.response?.status === 502) {
              msg =
                "The poster server is not responding. Make sure the backend server is running and try again.";
            } else {
              msg =
                apiErr.message || "Failed to generate poster with Hugging Face.";
            }
          }
          setFeedback({ type: "error", message: msg });
          toast.error(msg, { id: "poster-generate-error", duration: 12000 });
          setIsGenerating(false);
          return;
        }

        const blob = res?.data;
        if (!blob || blob.size === 0) {
          throw new Error("No image data received from Hugging Face.");
        }
        const blobUrl = URL.createObjectURL(blob);
        const cloudUrl = res?.headers?.["x-poster-image-url"] || "";
        finalImageUrl = cloudUrl || blobUrl;
      }

      const facts = extractEventFacts(promptText);
      const firstSentence = promptText.split(/[.\n]/)[0].trim();
      const cleanTitle =
        facts.title ||
        (firstSentence.length > 60
          ? firstSentence.slice(0, 60) + "..."
          : firstSentence);

      const contentToSave = {
        title: cleanTitle,
        tagline: facts.subtitle || "",
        subtitle: facts.subtitle || "",
        date: facts.date || "",
        time: facts.time || "",
        venue: facts.venue || "",
        details: Array.isArray(facts.details)
          ? facts.details
          : facts.details
            ? [facts.details]
            : [],
        imageUrl: finalImageUrl,
        image: finalImageUrl,
        isAiGenerated: true,
      };

      setRawGeneratedContent(contentToSave);
      setGeneratedContent(contentToSave);
      setHistoryStack([]);
      setFeedback({
        type: "success",
        message: "Poster ready. Download or refine below.",
      });
      toast.success("Poster generated with Hugging Face!");

      const savedPayload = buildContentPayload(contentToSave);
      const resolvedTemplateId = getRealTemplateId();
      if (savedPayload?.title) {
        if (!posterIdRef.current) {
          runSaveOp({
            mode: "create",
            content: savedPayload,
            templateId: resolvedTemplateId,
            prompt: promptText.slice(0, 1000),
          });
        } else {
          runSaveOp({
            mode: "version",
            content: savedPayload,
          });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err?.message || "We could not create the poster. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async (e) => {
    e?.preventDefault();
    await runGenerate();
  };

  const handleApplyEdit = (next) => {
    setHistoryStack((prev) => {
      const snapshot = generatedContent || posterContent;
      return snapshot ? [...prev.slice(-20), snapshot] : prev;
    });
    setGeneratedContent(next);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setGeneratedContent(previous);
  };

  const handleResetToGenerated = () => {
    if (!rawGeneratedContent) return;
    setHistoryStack((prev) => {
      const snapshot = generatedContent || posterContent;
      return snapshot ? [...prev.slice(-20), snapshot] : prev;
    });
    setGeneratedContent(rawGeneratedContent);
  };

  const handleSaveChanges = async () => {
    const payload = buildContentPayload(posterContent);
    if (!payload || !payload.title) {
      setDrawerSaveError("Please add a headline before saving.");
      setDrawerConflict(false);
      if (!isEditOpen) {
        setFeedback({
          type: "error",
          message: "Please add a headline before saving.",
        });
      }
      return;
    }

    setIsSavingEdits(true);
    setDrawerSaveError("");
    setDrawerConflict(false);

    const result = posterIdRef.current
      ? await runSaveOp({ mode: "patch", content: payload })
      : await runSaveOp({
          mode: "create",
          content: payload,
          templateId: getRealTemplateId(),
          prompt: (description.trim() || payload.title).slice(0, 1000),
        });

    if (result.ok) {
      setRawGeneratedContent({ ...payload, image: payload.imageUrl });
      setHistoryStack([]);
    } else {
      setDrawerSaveError(result.message);
      setDrawerConflict(Boolean(result.conflict));
    }
    setIsSavingEdits(false);
  };

  const requestCloseEditor = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "You have unsaved changes. Close the editor without saving?",
      )
    ) {
      return;
    }
    setIsEditOpen(false);
    setDrawerSaveError("");
    setDrawerConflict(false);
  };

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
            Create a poster
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Describe your poster in plain words. Your organization&apos;s locked header and footer banners stay fixed.
          </p>
        </div>

        {feedback.type === "error" && feedback.message && (
          <div
            className="p-3 rounded-[6px] text-xs flex items-center gap-2 border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        {saveError && (
          <div
            className="p-3 rounded-[6px] text-xs flex items-center justify-between gap-3 border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]"
            role="alert"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError.message}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {saveError.conflict && posterId && (
                <button
                  type="button"
                  onClick={refreshPoster}
                  className="underline font-semibold hover:opacity-80"
                >
                  Reload latest
                </button>
              )}
              <button
                type="button"
                onClick={handleRetrySave}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#DC2626]/30 bg-white px-2.5 py-1 text-xs font-medium hover:bg-[#FEF2F2]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Try again</span>
              </button>
            </span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column: Form Controls */}
          <div className="w-full lg:w-[420px] shrink-0">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="event-copy"
                  className="block text-sm font-semibold text-[#111827]"
                >
                  What do you want to create?
                </label>
                <Textarea
                  id="event-copy"
                  rows={5}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your event in English. Mention the event name, date, time, and where it takes place..."
                  className="min-h-[120px] resize-y rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] placeholder:text-[#9CA3AF] focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[#6B7280] mr-1">
                    Suggestions:
                  </span>
                  {SAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setDescription(prompt)}
                      className="rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs text-[#6B7280] hover:text-[#111827] hover:border-[#9CA3AF] transition-colors"
                    >
                      {prompt.split(" on ")[0] || prompt.slice(0, 22)}
                    </button>
                  ))}
                </div>
              </div>

              <PosterImageInput
                value={userImageUrl}
                onChange={(url) => {
                  const next = url || "";
                  setUserImageUrl(next);
                  setImageLoadError(false);
                  if (!generatedContent && !next) return;
                  setGeneratedContent((prev) => ({
                    title: "",
                    tagline: "",
                    date: "",
                    time: "",
                    venue: "",
                    details: [],
                    ...(prev || {}),
                    imageUrl: next,
                    image: next,
                  }));
                }}
              />

              <Button
                type="submit"
                disabled={isGenerating || loadingInitial || !description.trim()}
                className="w-full h-10 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Generating poster...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    <span>Generate poster</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Right Column: Preview & Actions */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Brand locked</span>
                </div>
                {feedback.type === "success" && (
                  <div
                    className="flex items-center gap-1.5 text-xs text-[#16A34A] font-medium"
                    role="status"
                  >
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasUnsavedChanges &&
                  saveStatus !== "saving" &&
                  posterAutosave.status !== "saving" &&
                  posterAutosave.status !== "saved" &&
                  !showSavedChip && (
                    <span className="text-xs text-[#D97706] font-medium">
                      Unsaved changes
                    </span>
                  )}
                {saveStatus === "saving" ||
                posterAutosave.status === "saving" ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]"
                    role="status"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </span>
                ) : posterAutosave.status === "error" ? (
                  <span className="text-xs text-red-600 font-medium">
                    {posterAutosave.errorMessage || "Draft save failed"}
                  </span>
                ) : posterAutosave.status === "saved" ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs text-[#16A34A] font-medium"
                    role="status"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Draft saved</span>
                  </span>
                ) : (
                  showSavedChip && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-[#16A34A] font-medium"
                      role="status"
                      title={`Saved (version ${currentVersion})`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </span>
                  )
                )}

                {hasPoster && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    className="h-8 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5 text-[#6B7280]" />
                    <span>Edit details</span>
                  </Button>
                )}

                {hasPoster && hasUnsavedChanges && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={isSavingEdits}
                    className="h-8 rounded-[6px] border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] text-xs font-medium"
                  >
                    {isSavingEdits ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    <span>{isSavingEdits ? "Saving…" : "Save changes"}</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] p-4 sm:p-6 min-h-[460px] flex flex-col items-center justify-center">
              {loadingInitial || isGenerating ? (
                <SkeletonPoster />
              ) : ready ? (
                <div
                  className={`${STAGE_WIDTH} rounded-[8px] overflow-hidden bg-white border border-[#E5E7EB]`}
                >
                  <PosterPreview
                    eager
                    brandKit={drawBrandKit}
                    template={drawTemplate}
                    content={posterContent}
                    onImageFail={() => setImageLoadError(true)}
                  />
                </div>
              ) : (
                <div className="w-full max-w-[360px] aspect-[4/5] rounded-[8px] border border-dashed border-[#D1D5DB] bg-white flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-[#9CA3AF]" />
                  </div>
                  <p className="text-sm font-medium text-[#111827]">
                    No poster yet
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Describe an event on the left to generate a poster inside your locked frame.
                  </p>
                </div>
              )}

              {imageLoadError && (
                <div
                  className={`${STAGE_WIDTH} mt-3 p-3 rounded-[6px] bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] text-xs flex items-center gap-2`}
                >
                  <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
                  <span>
                    This photo could not be loaded. Choose another one or upload
                    from your device.
                  </span>
                </div>
              )}
            </div>

            {hasPoster && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isGenerating || !description.trim()}
                    onClick={() => runGenerate({ forceGenerate: true })}
                    className="h-8 px-3 rounded-[6px] text-xs text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    <span>Regenerate poster</span>
                  </Button>
                </div>

                <PosterExportButtons
                  brandKit={drawBrandKit}
                  template={drawTemplate}
                  content={posterContent}
                />
              </div>
            )}
          </div>
        </div>

        <EditTextPanel
          isOpen={isEditOpen}
          onClose={requestCloseEditor}
          content={posterContent}
          onApplyChange={handleApplyEdit}
          onResetToGenerated={handleResetToGenerated}
          canReset={Boolean(
            rawGeneratedContent &&
              posterContent &&
              (posterContent.title !== rawGeneratedContent.title ||
                posterContent.tagline !== rawGeneratedContent.tagline ||
                posterContent.date !== rawGeneratedContent.date ||
                posterContent.time !== rawGeneratedContent.time ||
                posterContent.venue !== rawGeneratedContent.venue ||
                posterContent.imageUrl !== rawGeneratedContent.imageUrl ||
                JSON.stringify(posterContent.details || []) !==
                  JSON.stringify(rawGeneratedContent.details || [])),
          )}
          onUndo={handleUndo}
          canUndo={historyStack.length > 0}
          onSaveChanges={handleSaveChanges}
          isSaving={isSavingEdits}
          canSave={hasUnsavedChanges}
          saveError={drawerSaveError}
          conflict={drawerConflict}
          onReloadLatest={refreshPoster}
        />

        <DraftRestoreDialog
          isOpen={Boolean(posterAutosave.draftPrompt)}
          savedAt={posterAutosave.draftPrompt?.savedAt}
          onContinue={posterAutosave.continueDraft}
          onDiscard={posterAutosave.discardDraft}
        />
      </div>
    </div>
  );
}
