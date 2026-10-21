import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Eye,
  Grid,
  History as HistoryIcon,
  Keyboard,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Sliders,
} from "lucide-react";
import api from "../services/api";
import { friendlyError } from "../utils/brandImage";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import TemplatePreview from "../components/TemplatePreview";
import EditorStage from "../components/editor/EditorStage";
import EditorRail, { EditorPanel } from "../components/editor/EditorRail";
import ContextualToolbar from "../components/editor/ContextualToolbar";
import VersionDrawer from "../components/builder/VersionDrawer";
import SectionSettingsPanel from "../components/editor/SectionSettingsPanel";
const CardEditorModal = React.lazy(
  () => import("../components/editor/CardEditorModal"),
);
import { useAuth } from "../context/AuthContext";
import { TEMPLATE_SAMPLE_CONTENT } from "../data/demoPosters";
import {
  EDITOR_VERSION,
  ELEMENT_LIMITS,
  VARIABLE_LIMITS,
  BRAND_BAND_KINDS as BRAND_BANDS,
  brandBandProblems,
  defaultPage,
  legacyToSections,
  migrateTemplateLabels,
  validateTemplateSections,
} from "../../../shared/templateElements.js";
import {
  bandToCustomize,
  borrowedBandPieces,
  brandLayerTemplate,
  changedBrandBands,
  editingTemplateFromKit,
  kitBandIsLaidOut,
  pickSampleTemplate,
} from "../utils/brandBands";
import {
  TEMPLATE_CATEGORIES,
  resolveTemplateSize,
} from "../utils/templateRender";
import {
  HISTORY_LIMIT,
  LIMIT_MESSAGES,
  NAME_LIMIT,
  NOTE_LIMIT,
  aiTextCount,
  commitItemText,
  duplicateItem,
  fixedTextProblems,
  isHeadlineItem,
  keepWithinLimits,
  moveItem,
  newFieldItem,
  newImageItem,
  newShapeItem,
  newIconItem,
  newTextItem,
  patchItem,
  pictureCountOf,
  readClipboard,
  setLayerOrder,
  setItemMeta,
  setItemMode,
  shiftLayer,
  userImageCount,
  writeClipboard,
} from "../utils/templateEditorItems";
/* ------------------------------------------------------------------ *
 * The template editor.
 *
 * Everything an admin places lives in one list of items, and one list only: the undo
 * stack remembers the last 50 states of that list, the canvas draws it, and the save
 * sends it. Nothing here knows about areas, grids or stacking units - the shared rules
 * file is the only place those numbers exist, and it is the file the API checks with.
 * ------------------------------------------------------------------ */

const LONG_SAMPLE = {
  title: "Annual Community Fair and Harvest Celebration",
  tagline:
    "One whole day of food, music, games and craft stalls for every member of the family",
  date: "Saturday 18 October 2026",
  time: "10 in the morning until half past six in the evening",
  venue:
    "Riverside Grounds, next to the old bridge, with parking on Meadow Road",
  details: [
    "Food stalls, crafts and a cake competition on the main lawn",
    "Live music all afternoon on the bandstand stage",
    "Free entry for children under twelve and for school groups",
    "Prize draw at the close of the day for everyone who signs the book",
  ],
};

/** A look at the poster with no photo anywhere: neither side of the brand supplies one. */
function kitWithoutPhoto(brandKit) {
  if (!brandKit) return null;
  return {
    ...brandKit,
    content: { ...(brandKit.content || {}), defaultImageUrl: "" },
  };
}

function historyReducer(state, action) {
  if (action.type === "live") return { ...state, present: action.present };
  if (action.type === "commit") {
    const from = action.from ?? state.present;
    const present = action.present ?? state.present;
    if (from === present) return state;
    return {
      past: [...state.past, from].slice(-HISTORY_LIMIT),
      present,
      future: [],
    };
  }
  if (action.type === "undo") {
    if (state.past.length === 0) return state;
    const past = [...state.past];
    const previous = past.pop();
    return {
      past,
      present: previous,
      future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
    };
  }
  if (action.type === "redo") {
    if (state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return {
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: next,
      future: rest,
    };
  }
  if (action.type === "reset")
    return { past: [], present: action.present, future: [] };
  return state;
}

/** True only on a screen wide enough to place items by hand. */
function useWideScreen() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

export default function TemplateEdit({ brandLayer = false }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, activeClientId, can } = useAuth();
  const wide = useWideScreen();

  /* The brand layer opens on the band the Brand Kit page pointed at. */
  const wantedBand = searchParams.get("section") === "footer" ? "footer" : "header";
  const startingSection = brandLayer ? wantedBand : "content";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [namesById, setNamesById] = useState({});
  const [baseline, setBaseline] = useState("[]");
  /* The brand layer only: the layout borrowed as a sample, and the kit exactly as it was read,
     so a save can tell which band moved and refuse to overwrite somebody else's work. */
  const [sample, setSample] = useState(null);
  const [kitAsLoaded, setKitAsLoaded] = useState(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Event");
  const [note, setNote] = useState("");

  const [activeSection, setActiveSection] = useState(startingSection);
  const [showFullPoster, setShowFullPoster] = useState(true);
  const [editorScale, setEditorScale] = useState(0.5);
  const [percentInput, setPercentInput] = useState("50%");

  useEffect(() => {
    setPercentInput(`${Math.round(editorScale * 100)}%`);
  }, [editorScale]);

  const handleScaleChange = useCallback((scale) => {
    setEditorScale(scale);
  }, []);

  const [hist, dispatch] = useReducer(historyReducer, {
    past: [],
    present: { sections: null },
    future: [],
  });
  const stateRef = useRef({ sections: null });
  useEffect(() => {
    stateRef.current = hist.present || { sections: null };
  }, [hist.present]);
  const txRef = useRef(null);
  const readState = useCallback(
    () => stateRef.current || { sections: null },
    [],
  );
  const readSections = useCallback(() => readState().sections, [readState]);
  const readActiveItems = useCallback(
    () => readSections()?.[activeSection]?.elements || [],
    [readSections, activeSection],
  );

  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [editingCardId, setEditingCardId] = useState("");
  const [tab, setTab] = useState("");

  /* Picking a piece of the poster is handled below, where a band that still follows the
     organization can be handed over as part of the same click. */
  const [zoom, setZoom] = useState("fit");
  const [guidesOn, setGuidesOn] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  const [rulersOn, setRulersOn] = useState(false);
  /* Which items are kept out of the way while placing. This is only ever about the editor:
     nothing is hidden on a real poster, and the saved template has no such idea at all. */
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [previewOn, setPreviewOn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [banner, setBanner] = useState(null);
  const [itemsOverflow, setItemsOverflow] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [backModalOpen, setBackModalOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const size = useMemo(() => resolveTemplateSize(saved), [saved]);
  const sections = useMemo(
    () => hist.present?.sections || legacyToSections(saved, brandKit),
    [hist.present?.sections, saved, brandKit],
  );

  const cardListItem = useMemo(() => {
    if (!editingCardId) return null;
    const contentElements = sections.content?.elements || [];
    return contentElements.find((it) => it.id === editingCardId) || null;
  }, [editingCardId, sections.content?.elements]);

  const activeArea = useMemo(() => {
    const headerHeight = sections.header?.height ?? 80;
    const footerHeight = sections.footer?.height ?? 70;
    if (activeSection === "header") {
      return { x: 0, y: 0, w: size.width, h: headerHeight };
    }
    if (activeSection === "footer") {
      return {
        x: 0,
        y: Math.max(0, size.height - footerHeight),
        w: size.width,
        h: footerHeight,
      };
    }
    return {
      x: 0,
      y: headerHeight,
      w: size.width,
      h: Math.max(0, size.height - headerHeight - footerHeight),
    };
  }, [activeSection, sections.header?.height, sections.footer?.height, size]);

  const activeItems = useMemo(
    () => sections[activeSection]?.elements || [],
    [sections, activeSection],
  );

  const contentAreaBox = useMemo(() => {
    const headerHeight = sections.header?.height ?? 80;
    const footerHeight = sections.footer?.height ?? 70;
    return {
      x: 0,
      y: headerHeight,
      w: size.width,
      h: Math.max(0, size.height - headerHeight - footerHeight),
    };
  }, [sections.header?.height, sections.footer?.height, size]);

  const contentItemsOutside = useMemo(() => {
    /* In the brand layer the middle of the poster is borrowed from somebody's real layout, so
       nothing there is ever "out of place" - only the band being placed is the user's work. */
    if (brandLayer) return [];
    const contentElements = sections.content?.elements || [];
    return contentElements.filter((item) => {
      return (
        item.y < contentAreaBox.y ||
        item.y + item.h > contentAreaBox.y + contentAreaBox.h ||
        item.x < contentAreaBox.x ||
        item.x + item.w > contentAreaBox.x + contentAreaBox.w
      );
    });
  }, [brandLayer, sections.content?.elements, contentAreaBox]);

  const page = useMemo(
    () => sections.content?.page || defaultPage(),
    [sections.content?.page],
  );

  const isContentCustom = useMemo(() => {
    return ["background", "decoration", "watermark", "infoCard"].some(
      (k) => page[k]?.mode === "custom",
    );
  }, [page]);

  const draftTemplate = useMemo(
    () =>
      brandLayer
        ? brandLayerTemplate(sections, sample, size)
        : {
            id,
            name,
            category,
            size,
            zones: saved?.zones || [],
            layout: saved?.layout || {},
            sections,
            editorVersion: EDITOR_VERSION,
            elements: sections.content?.elements || [],
            page: sections.content?.page || defaultPage(),
          },
    [brandLayer, sample, id, name, category, size, saved, sections],
  );

  const dirty =
    Boolean(saved) &&
    (brandLayer
      ? JSON.stringify(sections) !== baseline
      : name.trim() !== (saved.name || "") ||
        category !== (saved.category || "Event") ||
        JSON.stringify(sections) !== baseline);

  const selected = useMemo(
    () => activeItems.find((item) => item.id === selectedId) || null,
    [activeItems, selectedId],
  );
  /* Everything the save would refuse, in one list: the shared rules first, then the one
     thing only the editor can tell - a box of your own words nobody has written yet. */
  const problems = useMemo(() => {
    if (brandLayer) {
      const kit = kitAsLoaded || brandKit;
      return BRAND_BANDS.flatMap((kind) => {
        const elements = sections[kind]?.elements || [];
        return brandBandProblems(
          {
            mode: elements.length > 0 ? "elements" : "legacy",
            height: sections[kind]?.height,
            background: sections[kind]?.background,
            elements,
          },
          kind,
          { brandKit: kit, size },
        );
      });
    }
    return [
      ...validateTemplateSections(sections, { brandKit, template: saved, size }),
      ...fixedTextProblems(sections.content?.elements || []),
    ];
  }, [brandLayer, sections, brandKit, kitAsLoaded, saved, size]);

  /* ------------------------------------------------------------ load */
  /** Puts a template from the server into the editor and calls the work saved. */
  const applyLoaded = useCallback((template, kit) => {
    const sec = legacyToSections(template, kit);
    // Existing templates keep their items; items that were forced locked become unlocked on next save
    if (sec.header?.elements) {
      sec.header.elements = sec.header.elements.map((el) => ({ ...el, locked: false }));
    }
    if (sec.footer?.elements) {
      sec.footer.elements = sec.footer.elements.map((el) => ({ ...el, locked: false }));
    }
    /* A design that carries pieces on a band but still says the band follows the organization was
       placed before this screen handed bands over: the poster painted the organization's header and
       ignored these pieces, so nobody could click them. The band belongs to this design now.
       A kit that laid its own band out is left alone, because that band is what paints. */
    for (const kind of ["header", "footer"]) {
      const band = sec[kind];
      if (kitBandIsLaidOut(kit, kind)) continue;
      if (band?.elements?.length > 0 && band.mode !== "custom") band.mode = "custom";
    }
    // Migrate existing templates on load: rename those labels to "Text N" and "Photo N" with a quiet note
    const migration = migrateTemplateLabels(sec);
    if (migration.migrated) {
      setNote((prev) => prev || "Renamed generic field labels to clear numbers.");
    }
    setSaved(template);
    setName(template.name || "");
    setCategory(template.category || "Event");
    if (kit) setBrandKit(kit);
    setBaseline(JSON.stringify(sec));
    dispatch({ type: "reset", present: { sections: sec } });
    txRef.current = null;
    setHiddenIds(new Set());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (brandLayer) {
        const [kitRes, templatesRes] = await Promise.all([
          api.get("/brand-kit"),
          api.get("/templates").catch(() => null),
        ]);
        const kit = kitRes?.data?.data?.brandKit;
        if (!kit) {
          setLoadError("We could not open your organization header and footer.");
          return false;
        }
        const kitSize = resolveTemplateSize({ size: kit.defaultPosterSize });
        const list = templatesRes?.data?.data?.templates || [];
        setSample(pickSampleTemplate(list, kitSize));
        setKitAsLoaded(kit);
        applyLoaded(editingTemplateFromKit(kit, kitSize), kit);
        return true;
      }
      const [templateRes, kitRes, usersRes] = await Promise.all([
        api.get(`/templates/${id}`),
        api.get("/brand-kit").catch(() => null),
        api.get("/users").catch(() => null),
      ]);
      const template = templateRes?.data?.data?.template;
      if (!template) {
        setLoadError("We could not find this template.");
        return false;
      }
      applyLoaded(
        template,
        kitRes?.data?.success ? kitRes.data.data?.brandKit || null : null,
      );
      if (usersRes?.data?.success) {
        setNamesById(
          (usersRes.data.data?.users || []).reduce((acc, person) => {
            acc[String(person.id || person._id)] = person.name;
            return acc;
          }, {}),
        );
      }
      return true;
    } catch (err) {
      setLoadError(
        friendlyError(
          err,
          brandLayer
            ? "We could not open your organization header and footer."
            : "We could not open this template.",
        ),
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [applyLoaded, brandLayer, id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ----------------------------------------------------------- edits */
  /**
   * A header or footer that still follows the organization is painted from the brand kit, so a piece
   * placed on one would never show on this design's poster. Placing anything therefore starts by
   * taking the organization's band over as this design's own, copied piece by piece so nothing the
   * team can see disappears from it. The brand layer places its own band and needs no takeover.
   */
  const bandTakeover = useCallback(
    (kind, currentSections) =>
      brandLayer
        ? null
        : bandToCustomize(brandKit, kind, { size, current: currentSections?.[kind] }),
    [brandLayer, brandKit, size],
  );

  const announceBandTakeover = useCallback(
    (kind) =>
      setBanner({
        tone: "ok",
        text: `This ${kind} is now this design's own, copied from your organization's. What you place here stays on this design alone. Change it back in the ${kind} settings.`,
      }),
    [],
  );

  /**
   * One change to the active section's item list. Live changes (a slider being dragged, a colour being
   * picked) are kept out of the undo stack until the gesture ends, so one action is one
   * step back.
   */
  const edit = useCallback(
    (mutate, { live = false, band = null } = {}) => {
      const current = readState();
      const currentSections = current.sections || legacyToSections(saved, brandKit);
      const activeElements =
        (band ? band.elements : currentSections[activeSection]?.elements) || [];
      const nextElements = mutate(activeElements);
      if (!Array.isArray(nextElements) || nextElements === activeElements) return;
      const nextSections = {
        ...currentSections,
        [activeSection]: {
          ...currentSections[activeSection],
          ...(band || {}),
          elements: nextElements,
        },
      };
      const next = { ...current, sections: nextSections };
      if (live) {
        if (txRef.current === null) txRef.current = current;
        dispatch({ type: "live", present: next });
        return;
      }
      const from = txRef.current ?? current;
      txRef.current = null;
      dispatch({ type: "commit", from, present: next });
      if (band) announceBandTakeover(activeSection);
    },
    [readState, saved, brandKit, activeSection, announceBandTakeover],
  );

  const editSection = useCallback(
    (sectionKey, patch) => {
      const current = readState();
      const currentSections = current.sections || legacyToSections(saved, brandKit);
      const targetSection = currentSections[sectionKey] || {};
      /* Changing the height or the colour of a band that follows the organization is a change to
         this design's band, so it is taken over first; the settings panel's own choice of mode
         already says what it wants and is never second-guessed. */
      const takeover = patch?.mode === undefined ? bandTakeover(sectionKey, currentSections) : null;
      const nextSections = {
        ...currentSections,
        [sectionKey]: {
          ...targetSection,
          ...(takeover || {}),
          ...patch,
        },
      };
      const next = { ...current, sections: nextSections };
      dispatch({ type: "commit", from: current, present: next });
      if (takeover) announceBandTakeover(sectionKey);
    },
    [readState, saved, brandKit, bandTakeover, announceBandTakeover],
  );

  /* While a band still follows the organization, its logo and name are painted from the brand kit
     and this design carries no pieces of its own, so there was nothing on the canvas to click.
     These borrowed pieces stand exactly where those words are painted. They live only on the
     canvas and cannot be moved: picking one hands the band over as this design's own, and the very
     same click then works on the real piece. */
  const borrowedBands = useMemo(
    () => (brandLayer ? {} : borrowedBandPieces(brandKit, sections, size)),
    [brandLayer, brandKit, sections, size],
  );

  const stageSections = useMemo(() => {
    const kinds = Object.keys(borrowedBands);
    if (kinds.length === 0) return sections;
    const next = { ...sections };
    for (const kind of kinds) {
      next[kind] = {
        ...next[kind],
        elements: borrowedBands[kind].map((item) => ({ ...item, locked: true })),
      };
    }
    return next;
  }, [borrowedBands, sections]);

  /** Hand a band over when a piece picked on the canvas belongs to the organization, not to it. */
  const takeOverBandFor = useCallback(
    (ids) => {
      for (const kind of ["header", "footer"]) {
        const borrowed = borrowedBands[kind];
        if (!borrowed) continue;
        if (ids.some((id) => borrowed.some((item) => item.id === id))) editSection(kind, {});
      }
    },
    [borrowedBands, editSection],
  );

  const handleItemSelect = useCallback(
    (id, isShift = false) => {
      if (!id) {
        setSelectedId("");
        setSelectedIds([]);
        return;
      }
      takeOverBandFor([id]);
      if (isShift) {
        setSelectedIds((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
          setSelectedId(next[next.length - 1] || "");
          return next;
        });
      } else {
        setSelectedId(id);
        setSelectedIds([id]);
      }
    },
    [takeOverBandFor],
  );

  const handleSelectMultiple = useCallback(
    (ids, isShift = false) => {
      if (!ids || ids.length === 0) {
        if (!isShift) {
          setSelectedId("");
          setSelectedIds([]);
        }
        return;
      }
      takeOverBandFor(ids);
      if (isShift) {
        setSelectedIds((prev) => {
          const set = new Set([...prev, ...ids]);
          const next = Array.from(set);
          setSelectedId(next[next.length - 1] || "");
          return next;
        });
      } else {
        setSelectedIds(ids);
        setSelectedId(ids[ids.length - 1] || "");
      }
    },
    [takeOverBandFor],
  );

  const editPage = useCallback(
    (sectionKey, patch) => {
      const current = readState();
      const currentSections = current.sections || legacyToSections(saved, brandKit);
      const currentPage = currentSections.content?.page || defaultPage();
      const currentSub = currentPage[sectionKey] || {};
      const nextPage = {
        ...currentPage,
        [sectionKey]: { ...currentSub, ...patch },
      };
      const nextSections = {
        ...currentSections,
        content: {
          ...currentSections.content,
          page: nextPage,
        },
      };
      const next = { ...current, sections: nextSections };
      dispatch({ type: "commit", from: current, present: next });
    },
    [readState, saved, brandKit],
  );

  const resetPageSection = useCallback(
    (sectionKey) => {
      const current = readState();
      const currentSections = current.sections || legacyToSections(saved, brandKit);
      const currentPage = currentSections.content?.page || defaultPage();
      const nextPage = {
        ...currentPage,
        [sectionKey]: { mode: "brand" },
      };
      const nextSections = {
        ...currentSections,
        content: {
          ...currentSections.content,
          page: nextPage,
        },
      };
      const next = { ...current, sections: nextSections };
      dispatch({ type: "commit", from: current, present: next });
    },
    [readState, saved, brandKit],
  );

  const moveContentItemsInside = useCallback(() => {
    const current = readState();
    const currentSections = current.sections || legacyToSections(saved, brandKit);
    const contentElements = currentSections.content?.elements || [];
    const moved = contentElements.map((item) =>
      moveItem(item, { x: item.x, y: item.y }, contentAreaBox),
    );
    const nextSections = {
      ...currentSections,
      content: {
        ...currentSections.content,
        elements: moved,
      },
    };
    const next = { ...current, sections: nextSections };
    dispatch({ type: "commit", from: current, present: next });
  }, [readState, saved, brandKit, contentAreaBox]);

  /* Each area keeps the zoom you left it at, so going back to the footer does not put you
     back at whatever the header happened to be shown at. */
  const viewMemory = useRef({});

  const switchSection = useCallback(
    (nextSec, nextSelectedId = "") => {
      /* The brand layer has no middle of its own: what shows there is a sample of somebody
         else's layout, so it cannot be stepped into. */
      if (brandLayer && nextSec === "content") return;
      if (nextSelectedId) takeOverBandFor([nextSelectedId]);
      if (nextSec === activeSection) {
        if (nextSelectedId) {
          setSelectedId(nextSelectedId);
          setSelectedIds([nextSelectedId]);
        }
        /* Already there but looking at the whole poster: step into the area. */
        if (showFullPoster) setShowFullPoster(false);
        return;
      }
      const remembered = viewMemory.current[nextSec];
      viewMemory.current[activeSection] = { zoom, full: showFullPoster };
      setSelectedId(nextSelectedId || "");
      setSelectedIds(nextSelectedId ? [nextSelectedId] : []);
      setEditingId("");
      setActiveSection(nextSec);
      /* A first visit shows the area as wide as the screen; a return keeps your own zoom. */
      setZoom(remembered ? remembered.zoom : "fit");
      setShowFullPoster(remembered ? remembered.full : false);
    },
    [activeSection, brandLayer, showFullPoster, takeOverBandFor, zoom],
  );

  const applyColorToken = useCallback(
    (token) => {
      if (!selectedId) return;
      edit((itemsList) => {
        return itemsList.map((item) => {
          if (item.id !== selectedId) return item;
          if (item.kind === "text") {
            return {
              ...item,
              style: {
                ...item.style,
                color: token,
              },
            };
          }
          if (item.kind === "shape") {
            const isLine = item.shape?.type === "line";
            return {
              ...item,
              shape: {
                ...item.shape,
                fill: isLine ? "" : token,
                stroke: isLine ? token : item.shape?.stroke,
              },
            };
          }
          return item;
        });
      });
    },
    [edit, selectedId],
  );

  const applyFontToken = useCallback(
    (token) => {
      if (!selectedId) return;
      edit((itemsList) => {
        return itemsList.map((item) => {
          if (item.id !== selectedId || item.kind !== "text") return item;
          return {
            ...item,
            style: {
              ...item.style,
              fontFamily: token,
            },
          };
        });
      });
    },
    [edit, selectedId],
  );

  /* One thing, or everything picked at once - the tools write to whichever is in front of you. */
  const mapOne = useCallback(
    (itemId, mutate) => (list) => {
      const wanted = new Set(Array.isArray(itemId) ? itemId : [itemId]);
      let touched = false;
      const next = list.map((item) => {
        if (!wanted.has(item.id)) return item;
        const changed = mutate(item);
        if (!changed || changed === item) return item;
        touched = true;
        return changed;
      });
      return touched ? next : list;
    },
    [],
  );

  const commitRect = useCallback(
    (itemId, rect) =>
      edit(mapOne(itemId, (item) => moveItem(item, rect, activeArea))),
    [activeArea, edit, mapOne],
  );

  const commitMultiMove = useCallback(
    (moves) => {
      edit((list) => {
        const moveMap = new Map(moves.map((m) => [m.id, m.rect]));
        return list.map((item) => {
          const rect = moveMap.get(item.id);
          return rect ? moveItem(item, rect, activeArea) : item;
        });
      });
    },
    [activeArea, edit],
  );

  const commitRotation = useCallback(
    (itemId, rotation) => {
      edit(mapOne(itemId, (item) => patchItem(item, { rotation }, activeArea)));
    },
    [activeArea, edit, mapOne],
  );

  const fitHeight = useCallback(
    (itemId, newH) => {
      edit(
        (list) => {
          const idx = list.findIndex((it) => it.id === itemId);
          if (idx < 0) return list;
          const curH = list[idx].h;
          const targetH = Math.max(ELEMENT_LIMITS.minHeight, Math.round(newH));
          if (curH === targetH) return list;
          const next = list.slice();
          next[idx] = { ...list[idx], h: targetH };
          return next;
        },
        { live: true },
      );
    },
    [edit],
  );

  const patchStyle = useCallback(
    (itemId, patch) => {
      const { shape, card, imageUrl, mask, previewCount, align, ...restStyle } = patch || {};
      const itemPatch = {};
      if (shape !== undefined) itemPatch.shape = shape;
      if (card !== undefined) itemPatch.card = card;
      if (imageUrl !== undefined) itemPatch.imageUrl = imageUrl;
      if (mask !== undefined) itemPatch.mask = mask;
      if (previewCount !== undefined) itemPatch.previewCount = previewCount;
      if (align !== undefined) itemPatch.align = align;
      if (Object.keys(restStyle).length > 0) itemPatch.style = restStyle;
      return edit(
        mapOne(itemId, (item) => patchItem(item, itemPatch, activeArea)),
      );
    },
    [activeArea, edit, mapOne],
  );

  const liveStyle = useCallback(
    (itemId, patch) => {
      const { shape, card, imageUrl, mask, previewCount, align, ...restStyle } = patch || {};
      const itemPatch = {};
      if (shape !== undefined) itemPatch.shape = shape;
      if (card !== undefined) itemPatch.card = card;
      if (imageUrl !== undefined) itemPatch.imageUrl = imageUrl;
      if (mask !== undefined) itemPatch.mask = mask;
      if (previewCount !== undefined) itemPatch.previewCount = previewCount;
      if (align !== undefined) itemPatch.align = align;
      if (Object.keys(restStyle).length > 0) itemPatch.style = restStyle;
      return edit(
        mapOne(itemId, (item) => patchItem(item, itemPatch, activeArea)),
        { live: true },
      );
    },
    [activeArea, edit, mapOne],
  );

  const setShape = useCallback(
    (itemId, shapePatch) =>
      edit(
        mapOne(itemId, (item) => patchItem(item, { shape: shapePatch }, activeArea)),
      ),
    [activeArea, edit, mapOne],
  );

  const setImageUrl = useCallback(
    (itemId, url) =>
      edit(mapOne(itemId, (item) => patchItem(item, { imageUrl: url }, activeArea))),
    [activeArea, edit, mapOne],
  );

  const commitText = useCallback(
    (itemId, text) => {
      const words = String(text || "").slice(0, ELEMENT_LIMITS.textChars);
      edit((itemsList) => {
        return itemsList.map((item) => {
          if (item.id !== itemId) return item;
          const updated =
            item.text === words
              ? item
              : commitItemText(item, readActiveItems(), words, activeArea);

          if (updated.kind === "text") {
            const fontSize = Number(updated.style?.size) || 24;
            const lineHeight = Number(updated.style?.lineHeight) || 1.18;
            const lines = (updated.text || "").split("\n");
            const charsPerLine = Math.max(10, Math.floor(updated.w / (fontSize * 0.55)));
            let totalLines = 0;
            for (const line of lines) {
              totalLines += Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
            }
            const neededH = Math.max(
              ELEMENT_LIMITS.minHeight,
              Math.min(activeArea.h, Math.round(totalLines * fontSize * lineHeight + 4)),
            );
            return {
              ...updated,
              h: neededH,
            };
          }
          return updated;
        });
      });
    },
    [activeArea, edit, readActiveItems],
  );

  /** Locked | the assistant fills the words in | the person replacing a photo fills it in. */
  const changeMode = useCallback(
    (itemId, mode) =>
      edit(
        mapOne(itemId, (item) => setItemMode(item, readActiveItems(), mode, activeArea)),
      ),
    [activeArea, edit, mapOne, readActiveItems],
  );

  const changeMeta = useCallback(
    (itemId, patch) =>
      edit(
        mapOne(itemId, (item) => setItemMeta(item, readActiveItems(), patch, activeArea)),
      ),
    [activeArea, edit, mapOne, readActiveItems],
  );

  const toggleLock = useCallback(
    (target) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      const idSet = new Set(ids);
      const current = readActiveItems();
      const targeted = current.filter((it) => idSet.has(it.id));
      const allLocked = targeted.length > 0 && targeted.every((it) => it.locked);
      edit((list) =>
        list.map((item) =>
          idSet.has(item.id) ? { ...item, locked: !allLocked } : item,
        ),
      );
    },
    [edit, readActiveItems, selectedId, selectedIds],
  );

  const add = useCallback(
    (make, warn = "") => {
      const band = bandTakeover(activeSection, readSections());
      const current = band ? band.elements : readActiveItems();
      const maxCount = activeSection === "content" ? ELEMENT_LIMITS.maxItems : 15;
      if (current.length >= maxCount) {
        setBanner({
          tone: "error",
          text:
            activeSection === "content"
              ? `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`
              : `You can place up to 15 things here. Remove one first.`,
        });
        return;
      }
      let item = make(current);
      if (!item) return;
      if (activeSection !== "content") {
        /* Nobody fills a band piece in per poster, and a piece placed on a header is there to be
           moved, so it is not frozen to the page. */
        item = { ...item, variable: false };
      }
      /* A second headline box still needs its own name, even though the first one keeps the plain one. */
      const taken = new Set(current.map((each) => each.id));
      const fresh = taken.has(item.id)
        ? {
            ...item,
            id: `${item.id}-${current.length + 1}`.slice(
              0,
              ELEMENT_LIMITS.idChars,
            ),
          }
        : item;
      edit((list) => [...list, fresh], { band });
      setSelectedId(fresh.id);
      setPreviewOn(false);
      if (warn) setBanner({ tone: "warn", text: warn });
      else if (!band) setBanner(null);
    },
    [activeSection, bandTakeover, edit, readActiveItems, readSections],
  );

  const addField = useCallback(
    (field) => {
      if (activeSection !== "content") {
        setBanner({
          tone: "error",
          text: "Spaces to fill in, fields and lists can only be placed in the main content area.",
        });
        return;
      }
      add((list) => newFieldItem(field, list, activeArea));
    },
    [activeSection, add, activeArea],
  );

  const handleEditCard = useCallback(
    (id) => {
      if (activeSection !== "content") {
        switchSection("content");
      }
      setSelectedId(id);
      setSelectedIds([id]);
      setEditingCardId(id);
    },
    [activeSection, switchSection],
  );

  const addCardList = useCallback(
    (presetData) => {
      if (activeSection !== "content") {
        setBanner({
          tone: "error",
          text: "Card lists can only be placed in the main content area.",
        });
        return;
      }
      const current = readActiveItems();
      const existingLists = current.filter((it) => it.kind === "cardlist");
      if (existingLists.length >= 12) {
        setBanner({
          tone: "error",
          text: "A template can have at most 12 card lists.",
        });
        return;
      }
      if (current.length >= ELEMENT_LIMITS.maxItems) {
        setBanner({
          tone: "error",
          text: `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`,
        });
        return;
      }

      const existingKeys = new Set(existingLists.map((cl) => cl.key));
      const baseKey = (presetData?.key || "list").replace(/[^a-z0-9_-]/gi, "");
      let candidateKey = baseKey || "list";
      let count = 1;
      while (existingKeys.has(candidateKey)) {
        count += 1;
        candidateKey = `${baseKey}_${count}`;
      }

      const existingIds = new Set(current.map((it) => it.id));
      let candidateId = `cardlist-${Date.now().toString(36)}`;
      while (existingIds.has(candidateId)) {
        candidateId = `cardlist-${Date.now().toString(36)}-${Math.floor(Math.random() * 100)}`;
      }

      const defaultW = Math.min(activeArea.w - 40, presetData?.w || 960);
      const defaultH = Math.min(activeArea.h - 40, presetData?.h || 380);
      const defaultX = Math.max(activeArea.x, Math.round(activeArea.x + (activeArea.w - defaultW) / 2));
      const defaultY = Math.max(activeArea.y, Math.round(activeArea.y + (activeArea.h - defaultH) / 2));

      const newItem = {
        id: candidateId,
        kind: "cardlist",
        key: candidateKey,
        label: presetData?.label || (candidateKey.charAt(0).toUpperCase() + candidateKey.slice(1)),
        hint: presetData?.hint || "",
        x: defaultX,
        y: defaultY,
        w: defaultW,
        h: defaultH,
        columns: presetData?.columns || 2,
        gapX: presetData?.gapX ?? 24,
        gapY: presetData?.gapY ?? 24,
        align: presetData?.align || "left",
        minCount: presetData?.minCount || 1,
        maxCount: presetData?.maxCount || 12,
        previewCount: presetData?.previewCount || 3,
        card: presetData?.card || {
          w: 440,
          h: 160,
          fields: [
            { key: "name", label: "Name", type: "text", maxChars: 60, required: true },
            { key: "role", label: "Role", type: "text", maxChars: 80, required: false },
          ],
          items: [
            {
              id: "name",
              kind: "text",
              x: 16,
              y: 20,
              w: 400,
              h: 36,
              text: "{{name}}",
              style: { size: 22, weight: 700, color: "brand:heading", align: "left" },
            },
            {
              id: "role",
              kind: "text",
              x: 16,
              y: 60,
              w: 400,
              h: 28,
              text: "{{role}}",
              style: { size: 16, weight: 500, color: "brand:body", align: "left" },
            },
          ],
        },
        locked: false,
      };

      edit((list) => [...list, newItem]);
      setSelectedId(newItem.id);
      setSelectedIds([newItem.id]);
      setPreviewOn(false);
    },
    [activeArea, activeSection, edit, readActiveItems],
  );

  const handleCommitCard = useCallback(
    (updatedItem) => {
      edit((list) =>
        list.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
      );
    },
    [edit],
  );

  /**
   * A new box of words is one the assistant writes for each poster, until the template is
   * full of them - then it is placed as fixed words and the reason is said out loud.
   */
  const addText = useCallback(
    (variant) => {
      const secBgContext = {
        brandKit,
        section: activeSection,
        sections,
        page: sections?.content?.page,
      };
      if (activeSection !== "content") {
        return add(
          (list) => newTextItem(variant, list, activeArea, { variable: false, ...secBgContext }),
          "",
        );
      }
      const room = aiTextCount(readActiveItems()) < VARIABLE_LIMITS.maxText;
      return add(
        (list) => newTextItem(variant, list, activeArea, { variable: room, ...secBgContext }),
        room ? "" : LIMIT_MESSAGES.text,
      );
    },
    [activeSection, add, activeArea, readActiveItems, brandKit, sections],
  );

  const addShape = useCallback(
    (variant) => add((list) => newShapeItem(variant, list, activeArea, { brandKit })),
    [add, activeArea, brandKit],
  );

  const addIcon = useCallback(
    (name) => add((list) => newIconItem(name, list, activeArea)),
    [add, activeArea],
  );

  /** Both doors into a photo box: an empty one, or one carrying a picture just uploaded. */
  const addPhoto = useCallback(
    (url) => {
      if (activeSection !== "content") {
        return add(
          (list) => newImageItem(list, activeArea, url, { variable: false }),
          "",
        );
      }
      if (pictureCountOf(readActiveItems()) >= ELEMENT_LIMITS.maxImage) {
        setBanner({
          tone: "error",
          text: `A template holds at most ${ELEMENT_LIMITS.maxImage} photos of its own. Remove one first.`,
        });
        return;
      }
      const room = userImageCount(readActiveItems()) < VARIABLE_LIMITS.maxImage;
      add(
        (list) => newImageItem(list, activeArea, url, { variable: room }),
        room ? "" : LIMIT_MESSAGES.image,
      );
    },
    [activeSection, add, activeArea, readActiveItems],
  );

  const addImage = useCallback(() => addPhoto(""), [addPhoto]);
  const insertImage = useCallback(
    (url) => (url ? addPhoto(url) : undefined),
    [addPhoto],
  );

  const addBrandText = useCallback(
    (token) => {
      if (activeSection === "content") return;
      const band = bandTakeover(activeSection, readSections());
      const current = band ? band.elements : readActiveItems();
      if (current.length >= 15) {
        setBanner({
          tone: "error",
          text: "You can place up to 15 things here. Remove one first.",
        });
        return;
      }
      const item = {
        id: `text-brand-${Date.now()}`,
        kind: "text",
        text: token,
        x: activeArea.x + 20,
        y: activeArea.y + Math.max(5, Math.floor((activeArea.h - 30) / 2)),
        w: Math.min(300, Math.max(100, activeArea.w - 40)),
        h: 30,
        z: current.length,
        variable: false,
        style: {
          fontFamily: "brand:body",
          fontSize: 16,
          color: "brand:text",
          textAlign: "left",
        },
      };
      edit((list) => [...list, item], { band });
      setSelectedId(item.id);
      setPreviewOn(false);
    },
    [activeArea, activeSection, bandTakeover, edit, readActiveItems, readSections],
  );

  const addBrandLogo = useCallback(() => {
    if (activeSection === "content") return;
    const band = bandTakeover(activeSection, readSections());
    const current = band ? band.elements : readActiveItems();
    if (current.length >= 15) {
      setBanner({
        tone: "error",
        text: "You can place up to 15 things here. Remove one first.",
      });
      return;
    }
    const logoH = Math.min(60, Math.max(30, activeArea.h - 20));
    const logoW = logoH * 2;
    const item = {
      id: `logo-brand-${Date.now()}`,
      kind: "image",
      imageUrl: "brand:logo",
      src: "brand:logo",
      x: activeArea.x + 20,
      y: activeArea.y + Math.max(5, Math.floor((activeArea.h - logoH) / 2)),
      w: logoW,
      h: logoH,
      z: current.length,
      variable: false,
      style: {
        fit: "contain",
      },
    };
    edit((list) => [...list, item], { band });
    setSelectedId(item.id);
    setPreviewOn(false);
  }, [activeArea, activeSection, bandTakeover, edit, readActiveItems, readSections]);

  const remove = useCallback(
    (target) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      const toRemove = new Set(ids);
      edit((list) =>
        list.filter((item) => {
          if (toRemove.has(item.id)) {
            if (activeSection === "content" && isHeadlineItem(item)) return true;
            return false;
          }
          return true;
        }),
      );
      setHiddenIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedId("");
      setSelectedIds([]);
      if (ids.includes(editingId)) setEditingId("");
    },
    [activeSection, edit, editingId, selectedId, selectedIds],
  );

  const duplicate = useCallback(
    (target) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      const current = readActiveItems();
      const maxCount = activeSection === "content" ? ELEMENT_LIMITS.maxItems : 15;
      if (current.length + ids.length > maxCount) {
        setBanner({
          tone: "error",
          text:
            activeSection === "content"
              ? `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`
              : `You can place up to 15 things here. Remove one first.`,
        });
        return;
      }
      const toDuplicate = current.filter((each) => ids.includes(each.id));
      if (!toDuplicate.length) return;
      if (activeSection !== "content") {
        if (toDuplicate.some((item) => item.kind === "field" || item.kind === "cardlist" || item.variable)) {
          setBanner({
            tone: "error",
            text: "Spaces to fill in, fields and lists can only be placed in the main content area.",
          });
          return;
        }
      }
      const created = [];
      let workingList = [...current];
      for (const item of toDuplicate) {
        const copy = duplicateItem(item, workingList, activeArea);
        if (activeSection !== "content") {
          copy.locked = false;
          copy.variable = false;
        }
        workingList.push(copy);
        created.push(copy);
      }
      const { items: placed, reason } = keepWithinLimits(created, current, activeArea);
      edit((list) => [...list, ...placed]);
      if (placed.length === 1) {
        setSelectedId(placed[0].id);
        setSelectedIds([placed[0].id]);
      } else {
        setSelectedIds(placed.map((it) => it.id));
        setSelectedId(placed[0].id);
      }
      setBanner(reason ? { tone: "warn", text: reason } : null);
    },
    [activeArea, activeSection, edit, readActiveItems, selectedId, selectedIds],
  );

  const copyItem = useCallback(
    (target) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      const items = readActiveItems().filter((each) => ids.includes(each.id));
      if (!items.length) return;
      writeClipboard(items);
      setBanner({
        tone: "ok",
        text: items.length === 1
          ? "Copied. You can put it back on this poster or on another one."
          : `Copied ${items.length} items. You can put them back on this poster or on another one.`,
      });
    },
    [readActiveItems, selectedId, selectedIds],
  );

  const cutItem = useCallback(
    (target) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      const current = readActiveItems();
      const items = current.filter((each) => ids.includes(each.id));
      if (!items.length) return;
      writeClipboard(items);
      const toRemove = new Set(ids);
      edit((list) =>
        list.filter((item) => {
          if (toRemove.has(item.id)) {
            if (activeSection === "content" && isHeadlineItem(item)) return true;
            return false;
          }
          return true;
        }),
      );
      setSelectedId("");
      setSelectedIds([]);
      setBanner({
        tone: "ok",
        text: items.length === 1
          ? "Cut item. You can put it back on this poster or on another one."
          : `Cut ${items.length} items. You can put them back on this poster or on another one.`,
      });
    },
    [activeSection, edit, readActiveItems, selectedId, selectedIds],
  );

  const pasteItem = useCallback(() => {
    const band = bandTakeover(activeSection, readSections());
    const current = band ? band.elements : readActiveItems();
    const maxCount = activeSection === "content" ? ELEMENT_LIMITS.maxItems : 15;
    const room = maxCount - current.length;
    if (room <= 0) {
      setBanner({
        tone: "error",
        text:
          activeSection === "content"
            ? `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`
            : `You can place up to 15 things here. Remove one first.`,
      });
      return;
    }
    const { items: offered, problem } = readClipboard(current, activeArea, {
      clientId: activeClientId,
    });
    if (problem) {
      setBanner({ tone: "error", text: problem });
      return;
    }
    if (activeSection !== "content") {
      const hasRestricted = offered.some(
        (it) => it.kind === "field" || it.kind === "cardlist" || it.variable,
      );
      if (hasRestricted) {
        setBanner({
          tone: "error",
          text: "Spaces to fill in, fields and lists can only be placed in the main content area.",
        });
        return;
      }
    }
    const fitting = offered.slice(0, room);
    const { items: placed, reason } = keepWithinLimits(fitting, current, activeArea);
    const lockedPlaced =
      activeSection !== "content"
        ? placed.map((it) => ({ ...it, locked: false, variable: false }))
        : placed;
    edit((list) => [...list, ...lockedPlaced], { band });
    setSelectedId(lockedPlaced[lockedPlaced.length - 1].id);
    setPreviewOn(false);
    setBanner(
      reason
        ? { tone: "warn", text: reason }
        : {
            tone: "ok",
            text: `Put ${lockedPlaced.length} ${lockedPlaced.length === 1 ? "thing back" : "things back"} on this poster.`,
          },
    );
  }, [activeClientId, activeArea, activeSection, bandTakeover, edit, readActiveItems, readSections]);

  /**
   * One step forward or back through the stack, or all the way to the front or the
   * bottom. The stacking numbers are handed out again in the new order, so no two items
   * ever share one and none has to be typed by hand.
   */
  const moveTo = useCallback(
    (itemId, where) =>
      edit((list) => {
        const order = list.slice().sort((a, b) => a.z - b.z);
        const index = order.findIndex((item) => item.id === itemId);
        if (index < 0) return list;
        const target =
          where === "front"
            ? order.length - 1
            : where === "back"
              ? 0
              : index + where;
        if (target < 0 || target >= order.length) return list;
        const next = order.slice();
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        const renumbered = new Map(
          next.map((item, position) => [item.id, position]),
        );
        return list.map((item) => {
          const z = renumbered.get(item.id);
          return z === undefined || z === item.z ? item : { ...item, z };
        });
      }),
    [edit],
  );

  const moveLayer = useCallback(
    (itemId, delta) => edit((list) => shiftLayer(list, itemId, delta)),
    [edit],
  );
  /** A row dropped on another one: the stack is handed out again in the new order. */
  const dropLayer = useCallback(
    (itemId, targetId) => edit((list) => setLayerOrder(list, itemId, targetId)),
    [edit],
  );
  const reorderTo = useCallback(
    (target, direction) => {
      const ids = Array.isArray(target)
        ? target
        : (target ? [target] : (selectedIds.length > 0 ? selectedIds : [selectedId]));
      if (ids.length === 1) {
        moveTo(ids[0], direction);
      } else {
        ids.forEach((id) => moveTo(id, direction));
      }
    },
    [moveTo, selectedId, selectedIds],
  );

  const alignSelected = useCallback(
    (pos) => {
      const current = readActiveItems();
      const ids = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
      if (!ids.length) return;

      if (ids.length > 1) {
        const targets = current.filter((it) => ids.includes(it.id));
        if (targets.length <= 1) return;
        const minX = Math.min(...targets.map((it) => it.x));
        const maxX = Math.max(...targets.map((it) => it.x + it.w));
        const minY = Math.min(...targets.map((it) => it.y));
        const maxY = Math.max(...targets.map((it) => it.y + it.h));
        const bboxW = maxX - minX;
        const bboxH = maxY - minY;

        edit((list) =>
          list.map((item) => {
            if (!ids.includes(item.id)) return item;
            let nx = item.x;
            let ny = item.y;
            if (pos === "left") nx = minX;
            else if (pos === "center") nx = minX + Math.round((bboxW - item.w) / 2);
            else if (pos === "right") nx = maxX - item.w;
            else if (pos === "top") ny = minY;
            else if (pos === "middle") ny = minY + Math.round((bboxH - item.h) / 2);
            else if (pos === "bottom") ny = maxY - item.h;
            return moveItem(item, { x: nx, y: ny }, activeArea);
          }),
        );
      } else {
        const targetId = ids[0];
        edit(
          mapOne(targetId, (item) => {
            let nx = item.x;
            let ny = item.y;
            if (pos === "left") nx = activeArea.x;
            else if (pos === "center") nx = activeArea.x + Math.round((activeArea.w - item.w) / 2);
            else if (pos === "right") nx = activeArea.x + activeArea.w - item.w;
            else if (pos === "top") ny = activeArea.y;
            else if (pos === "middle") ny = activeArea.y + Math.round((activeArea.h - item.h) / 2);
            else if (pos === "bottom") ny = activeArea.y + activeArea.h - item.h;
            return moveItem(item, { x: nx, y: ny }, activeArea);
          }),
        );
      }
    },
    [activeArea, edit, mapOne, readActiveItems, selectedId, selectedIds],
  );

  const distributeSelected = useCallback(
    (axis) => {
      const current = readActiveItems();
      const targets = current.filter((it) => selectedIds.includes(it.id));
      if (targets.length < 3) return;

      if (axis === "horizontal") {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const span = (last.x + last.w) - first.x;
        const sumW = sorted.reduce((sum, it) => sum + it.w, 0);
        const totalGap = span - sumW;
        const gap = totalGap / (sorted.length - 1);
        let curX = first.x;
        const posMap = new Map();
        sorted.forEach((it, idx) => {
          if (idx === 0) {
            posMap.set(it.id, it.x);
          } else {
            curX += sorted[idx - 1].w + gap;
            posMap.set(it.id, Math.round(curX));
          }
        });
        edit((list) =>
          list.map((item) => {
            if (!posMap.has(item.id)) return item;
            return moveItem(item, { x: posMap.get(item.id), y: item.y }, activeArea);
          }),
        );
      } else if (axis === "vertical") {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const span = (last.y + last.h) - first.y;
        const sumH = sorted.reduce((sum, it) => sum + it.h, 0);
        const totalGap = span - sumH;
        const gap = totalGap / (sorted.length - 1);
        let curY = first.y;
        const posMap = new Map();
        sorted.forEach((it, idx) => {
          if (idx === 0) {
            posMap.set(it.id, it.y);
          } else {
            curY += sorted[idx - 1].h + gap;
            posMap.set(it.id, Math.round(curY));
          }
        });
        edit((list) =>
          list.map((item) => {
            if (!posMap.has(item.id)) return item;
            return moveItem(item, { x: item.x, y: posMap.get(item.id) }, activeArea);
          }),
        );
      }
    },
    [activeArea, edit, readActiveItems, selectedIds],
  );

  const matchSizeSelected = useCallback(
    (dimension) => {
      const current = readActiveItems();
      const ids = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
      if (ids.length < 2) return;
      const primary = current.find((it) => it.id === (selectedId || ids[0]));
      if (!primary) return;

      edit((list) =>
        list.map((item) => {
          if (!ids.includes(item.id) || item.id === primary.id) return item;
          let nw = item.w;
          let nh = item.h;
          if (dimension === "width" || dimension === "both") {
            nw = Math.max(ELEMENT_LIMITS.minWidth, Math.min(activeArea.w, primary.w));
          }
          if (dimension === "height" || dimension === "both") {
            nh = Math.max(ELEMENT_LIMITS.minHeight, Math.min(activeArea.h, primary.h));
          }
          return moveItem(item, { x: item.x, y: item.y, w: nw, h: nh }, activeArea);
        }),
      );
    },
    [activeArea, edit, readActiveItems, selectedId, selectedIds],
  );

  const groupSelected = useCallback(() => {
    const ids = selectedIds.length > 1 ? selectedIds : [];
    if (ids.length < 2) return;
    const newGroupId = `group-${Date.now()}`;
    const idSet = new Set(ids);
    edit((list) =>
      list.map((item) =>
        idSet.has(item.id) ? { ...item, groupId: newGroupId } : item,
      ),
    );
  }, [edit, selectedIds]);

  const ungroupSelected = useCallback(() => {
    const ids = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
    if (!ids.length) return;
    const current = readActiveItems();
    const targetedGroups = new Set();
    current.forEach((it) => {
      if (ids.includes(it.id) && it.groupId) targetedGroups.add(it.groupId);
    });
    if (targetedGroups.size === 0) return;
    edit((list) =>
      list.map((item) => {
        if (targetedGroups.has(item.groupId)) {
          const next = { ...item };
          delete next.groupId;
          return next;
        }
        return item;
      }),
    );
  }, [edit, readActiveItems, selectedId, selectedIds]);

  /** Only ever about the editor: a hidden item still saves and still prints. */
  const toggleHidden = useCallback((itemId) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const resetToSaved = () => {
    if (!saved) return;
    if (!window.confirm("Undo everything back to the last save?")) return;
    const sec = legacyToSections(saved, brandKit);
    setName(saved.name || "");
    setCategory(saved.category || "Event");
    setBaseline(JSON.stringify(sec));
    dispatch({ type: "reset", present: { sections: sec } });
    txRef.current = null;
    setBanner(null);
  };

  const clearSelection = useCallback(() => {
    setSelectedId("");
    setSelectedIds([]);
    setEditingId("");
    setTab("");
  }, []);

  /* -------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (event) => {
      const node = event.target;
      const typing =
        node &&
        (node.tagName === "INPUT" ||
          node.tagName === "TEXTAREA" ||
          node.tagName === "SELECT" ||
          node.isContentEditable);
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.altKey && !typing) {
        if (key === "1") {
          event.preventDefault();
          switchSection("header");
          return;
        }
        if (key === "2") {
          event.preventDefault();
          switchSection("content");
          return;
        }
        if (key === "3") {
          event.preventDefault();
          switchSection("footer");
          return;
        }
      }

      if (meta && (key === "z" || key === "y") && !typing) {
        event.preventDefault();
        dispatch({
          type:
            key === "y" || (event.shiftKey && key === "z") ? "redo" : "undo",
        });
        return;
      }
      if (typing || previewOn || drawerOpen) return;

      if (key === "escape") {
        if (detailsOpen) setDetailsOpen(false);
        else if (tab) setTab("");
        else if (settingsDrawerOpen) setSettingsDrawerOpen(false);
        else if (!showFullPoster || zoom !== "fit") {
          setShowFullPoster(true);
          setZoom("fit");
        } else if (selectedId || selectedIds.length > 0) {
          setSelectedId("");
          setSelectedIds([]);
        }
        return;
      }
      /* Putting something back needs no selection - it simply lands on this poster. */
      if (meta && key === "v") {
        event.preventDefault();
        pasteItem();
        return;
      }
      if (!selectedId && selectedIds.length === 0) return;

      if (meta && key === "d") {
        event.preventDefault();
        duplicate(selectedIds.length > 0 ? selectedIds : [selectedId]);
        return;
      }
      if (meta && key === "c") {
        event.preventDefault();
        copyItem(selectedIds.length > 0 ? selectedIds : [selectedId]);
        return;
      }
      if (meta && key === "x") {
        event.preventDefault();
        cutItem(selectedIds.length > 0 ? selectedIds : [selectedId]);
        return;
      }
      if (meta && key === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          ungroupSelected();
        } else {
          groupSelected();
        }
        return;
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        remove(selectedIds.length > 0 ? selectedIds : [selectedId]);
        return;
      }
      const arrows = {
        arrowleft: [-1, 0],
        arrowright: [1, 0],
        arrowup: [0, -1],
        arrowdown: [0, 1],
      };
      if (arrows[key]) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const [dx, dy] = arrows[key];
        if (selectedIds.length > 1) {
          const selectedSet = new Set(selectedIds);
          edit((list) =>
            list.map((item) =>
              selectedSet.has(item.id)
                ? moveItem(
                    item,
                    { x: item.x + dx * step, y: item.y + dy * step },
                    activeArea,
                  )
                : item,
            ),
          );
        } else if (selectedId) {
          edit(
            mapOne(selectedId, (item) =>
              moveItem(
                item,
                { x: item.x + dx * step, y: item.y + dy * step },
                activeArea,
              ),
            ),
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeArea,
    copyItem,
    cutItem,
    drawerOpen,
    duplicate,
    edit,
    groupSelected,
    mapOne,
    pasteItem,
    previewOn,
    remove,
    selectedId,
    selectedIds,
    detailsOpen,
    settingsDrawerOpen,
    showFullPoster,
    switchSection,
    tab,
    ungroupSelected,
    zoom,
  ]);

  /* --------------------------------------------------- leaving guard */
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = true;
      return true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const goBack = () => {
    leaveTo(brandLayer ? "/brand-kit" : "/templates");
  };

  /* Where an unsaved-changes dialog takes you once the work is saved or thrown away: the list,
     or the one screen that owns this organization's header and footer. */
  const [nextRoute, setNextRoute] = useState("/templates");
  const leaveTo = (path) => {
    if (dirty) {
      setNextRoute(path);
      setBackModalOpen(true);
      return;
    }
    navigate(path);
  };

  /* A template that follows the organization's band is edited in one place only, so the link
     leaves this design behind and opens the brand layer. */
  const editBrandBand = (kind) => {
    leaveTo(`/brand-layer/edit?section=${kind}`);
  };

  const handleComment = (item) => {
    const currentNote = item?.note || "";
    const next = window.prompt("Note or comment for this item:", currentNote);
    if (next !== null) {
      setItemMeta(item.id, { note: next });
      toast.success("Comment saved");
    }
  };

  /* ------------------------------------------------------------ save */
  /**
   * The brand layer writes the Brand Kit, and only the band that actually moved. Somebody else
   * may have saved the kit while this screen was open, so the copy on file is read once more
   * before anything is written, and the save refuses if it is no longer the one being edited.
   */
  const saveBrandLayer = async () => {
    if (problems.length > 0) {
      setBanner({ tone: "error", text: problems[0], more: problems.slice(1) });
      return false;
    }
    let base = null;
    try {
      base = JSON.parse(baseline);
    } catch {
      base = null;
    }
    const payload = changedBrandBands(sections, base);
    if (Object.keys(payload).length === 0) {
      setBanner({ tone: "warn", text: "You have not changed the header or the footer yet." });
      return false;
    }
    setSaving(true);
    setBanner(null);
    try {
      const onFile = await api
        .get("/brand-kit")
        .then((res) => res?.data?.data?.brandKit)
        .catch(() => null);
      if (
        onFile?.updatedAt &&
        kitAsLoaded?.updatedAt &&
        onFile.updatedAt !== kitAsLoaded.updatedAt
      ) {
        setBanner({
          tone: "error",
          text: "Somebody else saved the organization header or footer while you were working. Reload to see their version first, then place your changes again.",
          action: { label: "Reload", run: () => load() },
        });
        return false;
      }
      const response = await api.put("/brand-kit", payload);
      const kit = response?.data?.data?.brandKit;
      if (!kit) throw new Error("missing brand kit");
      setKitAsLoaded(kit);
      applyLoaded(
        editingTemplateFromKit(kit, resolveTemplateSize({ size: kit.defaultPosterSize })),
        kit,
      );
      setBanner({
        tone: "ok",
        text: "Saved. Every new poster for your organization now uses this header and footer.",
        action: { label: "Back to Brand Kit", run: goBack },
      });
      toast.success("Brand header and footer saved");
      return true;
    } catch (err) {
      const status = err?.response?.status;
      setBanner({
        tone: "error",
        text:
          status === 403
            ? "Only an administrator of this organization can change its header and footer."
            : friendlyError(err, "That did not save. Try again."),
        action:
          status === 404
            ? { label: "Reload", run: () => load() }
            : undefined,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!saved) return false;
    if (brandLayer) return saveBrandLayer();
    if (!name.trim()) {
      setBanner({ tone: "error", text: "Give the template a name." });
      return false;
    }
    if (problems.length > 0) {
      setBanner({ tone: "error", text: problems[0], more: problems.slice(1) });
      return false;
    }
    setSaving(true);
    setBanner(null);
    try {
      const response = await api.patch(`/templates/${id}`, {
        name: name.trim(),
        category,
        sections,
        elements: sections.content?.elements,
        page: sections.content?.page,
        note: note.trim() || undefined,
        expectedVersion: saved?.version,
      });
      const updated = response?.data?.data?.template;
      if (!updated) throw new Error("missing template");
      applyLoaded(updated, brandKit);
      setNote("");
      setBanner({
        tone: "ok",
        text: `Saved as version ${updated.version}.`,
        /* Going back re-reads the list, so the cards show this save straight away. */
        action: { label: "Back to templates", run: goBack },
      });
      toast.success(`Saved as version ${updated.version}`);
      return true;
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.error?.message || "That did not save. Try again.";
      setBanner({
        tone: "error",
        text: message,
        action:
          status === 409 || status === 404
            ? { label: "Reload this template", run: () => load() }
            : undefined,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const restore = async (version) => {
    if (
      !window.confirm(
        `Load version ${version} into the editor?\n\nWhat you have now is kept as its own version, so nothing is lost.`,
      )
    ) {
      return;
    }
    setRestoring(true);
    setBanner(null);
    try {
      const response = await api.post(`/templates/${id}/restore`, { version });
      const updated = response?.data?.data?.template;
      if (!updated) throw new Error("missing template");
      applyLoaded(updated, brandKit);
      setSelectedId("");
      setDrawerOpen(false);
      setPreviewOn(false);
      setBanner({
        tone: "ok",
        text: `Version ${version} is back in the editor, saved as version ${updated.version}.`,
      });
      toast.success(`Restored version ${version}`);
    } catch (err) {
      const status = err?.response?.status;
      setBanner({
        tone: "error",
        text:
          err?.response?.data?.error?.message ||
          "That version could not be restored.",
        action:
          status === 409
            ? { label: "Reload this template", run: () => load() }
            : undefined,
      });
    } finally {
      setRestoring(false);
    }
  };

  /* ----------------------------------------------------------- render */
  if (loading) {
    return (
      <div className="container-page section-pad flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !saved) {
    return (
      <div className="container-page section-pad space-y-4">
        <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{" "}
          {loadError ||
            (brandLayer
              ? "Your organization header and footer could not be opened."
              : "This template could not be opened.")}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="btn-primary px-4 py-2 text-sm"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => navigate(brandLayer ? "/brand-kit" : "/templates")}
            className="btn-ghost border border-line px-4 py-2 text-sm"
          >
            {brandLayer ? "Back to Brand Kit" : "Back to templates"}
          </button>
        </div>
      </div>
    );
  }

  const previews = [
    {
      key: "sample",
      label: "Sample words",
      kit: brandKit,
      content: TEMPLATE_SAMPLE_CONTENT,
    },
    { key: "long", label: "Long words", kit: brandKit, content: LONG_SAMPLE },
    {
      key: "noPhoto",
      label: "No photo",
      kit: kitWithoutPhoto(brandKit),
      content: { ...TEMPLATE_SAMPLE_CONTENT, imageUrl: "" },
    },
    {
      key: "noVenue",
      label: "No place",
      kit: brandKit,
      content: { ...TEMPLATE_SAMPLE_CONTENT, venue: "" },
    },
  ];

  const panelActions = {
    select: setSelectedId,
    addField,
    addCardList,
    editCard: handleEditCard,
    addText,
    addImage,
    insertImage,
    addShape,
    addIcon,
    addBrandText,
    addBrandLogo,
    remove,
    duplicate,
    toggleLock,
    toggleHidden,
    moveLayer,
    dropLayer,
    setShape,
    setImageUrl,
    changeMode,
    changeMeta,
    setStyle: patchStyle,
    setStyleLive: liveStyle,
  };

  const contextualToolbarElement = wide && !previewOn ? (
    <ContextualToolbar
      selectedItem={selected}
      items={activeItems}
      selectedIds={selectedIds}
      isNormalUser={can ? !can('templates:write') : user?.role === "user"}
      activeSection={activeSection}
      sections={sections}
      brandKit={brandKit}
      page={page}
      size={size}
      area={activeArea}
      showFullPoster={showFullPoster}
      isContentCustom={isContentCustom}
      onStyle={patchStyle}
      onStyleLive={liveStyle}
      onRect={commitRect}
      onRotation={commitRotation}
      onAlign={alignSelected}
      onDistribute={distributeSelected}
      onMatchSize={matchSizeSelected}
      onGroup={groupSelected}
      onUngroup={ungroupSelected}
      onToggleLock={toggleLock}
      onDuplicate={duplicate}
      onDelete={remove}
      onReorder={reorderTo}
      onReplaceImage={setImageUrl}
      onChangeMode={changeMode}
      onChangeMeta={changeMeta}
      onSwitchSection={switchSection}
      onSectionChange={editSection}
      onEditBrandBand={brandLayer ? null : editBrandBand}
      onPageChange={editPage}
      onToggleSettings={() => setSettingsDrawerOpen((prev) => !prev)}
      isSettingsOpen={settingsDrawerOpen}
      onToggleShowFullPoster={setShowFullPoster}
      onEditCard={handleEditCard}
      onPatchItem={(itemId, patch) =>
        edit(mapOne(itemId, (item) => patchItem(item, patch, activeArea)))
      }
    />
  ) : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F3F4F6] select-none">
      {/* ------------------------------------------------------ top bar */}
      <header className="flex h-11 shrink-0 items-center justify-between bg-[#2563EB] px-4 text-white z-30 select-none relative shadow-sm">
        {/* Far left: Back, Editing menu, Undo & Redo, Saved status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-[6px] border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />{" "}
            {brandLayer ? "Back to Brand Kit" : "Back"}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <span>Editing</span>
                <ChevronDown className="h-3 w-3 text-white/80" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 text-xs">
              {!brandLayer && (
                <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                  <Sliders className="mr-2 h-3.5 w-3.5" /> Template details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setRulersOn((on) => !on)}>
                <Grid className="mr-2 h-3.5 w-3.5" /> {rulersOn ? "Hide rulers" : "Show rulers"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGridOn((on) => !on)}>
                <Grid className="mr-2 h-3.5 w-3.5" /> {gridOn ? "Hide grid" : "Show grid"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGuidesOn((on) => !on)}>
                <Eye className="mr-2 h-3.5 w-3.5" /> {guidesOn ? "Hide guides" : "Show guides"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!dirty}
                onClick={resetToSaved}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 disabled:opacity-40"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Undo everything
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setKeyboardOpen(true)}>
                <Keyboard className="mr-2 h-3.5 w-3.5" /> Keyboard shortcuts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1 text-xs text-white">
            <button
              type="button"
              onClick={() => dispatch({ type: "undo" })}
              disabled={hist.past.length === 0}
              title="Undo (Ctrl+Z)"
              className="rounded px-1.5 py-1 font-medium hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              Undo
            </button>
            <span className="text-white/40">·</span>
            <button
              type="button"
              onClick={() => dispatch({ type: "redo" })}
              disabled={hist.future.length === 0}
              title="Redo (Ctrl+Y)"
              className="rounded px-1.5 py-1 font-medium hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              Redo
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <span
              className={`h-2 w-2 rounded-full ${
                dirty ? "bg-amber-300" : "bg-emerald-300"
              }`}
            />
            <span>{saving ? "Saving..." : dirty ? "Unsaved changes" : "Saved"}</span>
          </div>
        </div>

        {/* Center: Template name centred */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
          {brandLayer ? (
            <p className="truncate text-center text-sm md:text-[15px] font-semibold text-white">
              Organization header and footer
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              title="Click to rename or view details"
              className="max-w-[180px] sm:max-w-[280px] md:max-w-[420px] truncate text-center text-sm md:text-[15px] font-semibold text-white hover:underline focus:outline-none"
            >
              {name || "Untitled Template"}
            </button>
          )}
        </div>

        {/* Far right: Edit/Preview, Versions and Save */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Edit or preview"
            className="hidden sm:flex items-center rounded-[6px] bg-white/15 p-0.5"
          >
            <button
              type="button"
              aria-pressed={!previewOn}
              onClick={() => setPreviewOn(false)}
              className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                !previewOn
                  ? "bg-white font-semibold text-[#2563EB]"
                  : "text-white/90 hover:text-white"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              aria-pressed={previewOn}
              onClick={() => setPreviewOn(true)}
              className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                previewOn
                  ? "bg-white font-semibold text-[#2563EB]"
                  : "text-white/90 hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>

          {!brandLayer && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-[6px] border border-white/30 bg-transparent px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
            >
              <HistoryIcon className="h-3.5 w-3.5" /> Versions
            </button>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-[6px] bg-white px-4 py-1.5 text-xs font-semibold text-[#2563EB] shadow-xs hover:bg-blue-50 disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Warning bar for items outside content area */}
      {contentItemsOutside.length > 0 ? (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#D97706]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {contentItemsOutside.length === 1
                ? "1 item in the content area is outside the new bounds."
                : `${contentItemsOutside.length} items in the content area are outside the new bounds.`}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={moveContentItemsInside}
            className="h-7 rounded-[4px] border-[#F59E0B] bg-white px-2.5 text-xs font-semibold text-[#B45309] hover:bg-[#FEF3C7]"
          >
            Move them inside
          </Button>
        </div>
      ) : null}

      {banner ? (
        <div
          role="status"
          className={`flex shrink-0 flex-wrap items-start gap-2 border-b px-3 py-2 text-xs ${
            banner.tone === "ok"
              ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]"
              : banner.tone === "warn"
                ? "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]"
                : "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]"
          }`}
        >
          {banner.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="flex-1">
            {banner.text}
            {banner.more?.length ? (
              <span className="mt-1 block list-disc pl-4 text-[11px]">
                {banner.more.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
          {banner.action ? (
            <button
              type="button"
              onClick={banner.action.run}
              className="underline shrink-0 font-medium"
            >
              {banner.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {!wide ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[560px] space-y-4">
            <div className="card-surface flex items-start gap-3 p-5">
              <Monitor className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-heading">
                  {brandLayer
                    ? "Use a larger screen to place your header and footer"
                    : "Use a larger screen to edit templates"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {brandLayer
                    ? "Moving things around needs room for the poster and its tools side by side. Below is a look at your brand as it stands, so you can still check it here."
                    : "Moving things around needs room for the poster and its tools side by side. Below is a look at this template as it stands, so you can still check it here."}
                </p>
              </div>
            </div>
            <div className="card-surface p-4">
              <div className="mx-auto w-full max-w-[360px]">
                <TemplatePreview eager brandKit={brandKit} template={draftTemplate} />
              </div>
            </div>
          </div>
        </div>
      ) : previewOn ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-preview p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            The real poster with your brand, in four sets of words: the usual
            sample, a long one, one with no photo at all, and one where the
            person filling it in left the place out.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {previews.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <div className="rounded-card border border-line bg-canvas p-2">
                  <TemplatePreview
                    eager
                    brandKit={item.kit}
                    template={draftTemplate}
                    sample={item.content}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <EditorRail tab={tab} onTab={setTab} activeSection={activeSection} />

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {contextualToolbarElement ? (
              <div
                data-editor-ui="true"
                className="shrink-0 z-30 border-b border-[#E5E7EB] bg-white px-4 py-1.5 flex items-center justify-center shadow-xs overflow-x-auto"
              >
                {contextualToolbarElement}
              </div>
            ) : null}
            <EditorStage
              size={size}
              area={activeArea}
              brandKit={brandKit}
              template={draftTemplate}
              content={TEMPLATE_SAMPLE_CONTENT}
              items={activeItems}
              selectedId={selectedId}
              selectedIds={selectedIds}
              editingId={editingId}
              hiddenIds={hiddenIds}
              activeSection={activeSection}
              sections={stageSections}
              sectionTabs={brandLayer ? ["header", "footer"] : null}
              showFullPoster={showFullPoster}
              onSwitchSection={switchSection}
              onToggleShowFullPoster={() => {
                setShowFullPoster(true);
                setZoom("fit");
              }}
              zoom={zoom}
              guidesOn={guidesOn}
              gridOn={gridOn}
              rulersOn={rulersOn}
              onSelect={handleItemSelect}
              onSelectMultiple={handleSelectMultiple}
              onStartEdit={setEditingId}
              onStopEdit={() => setEditingId("")}
              onCommitText={commitText}
              onCanvasClick={clearSelection}
              onCommitRect={commitRect}
              onCommitMultiMove={commitMultiMove}
              onCommitRotation={commitRotation}
              onFitHeight={fitHeight}
              onToggleLock={toggleLock}
              onDuplicate={duplicate}
              onDelete={remove}
              onReorder={reorderTo}
              onZoom={setZoom}
              onToggleGuides={() => setGuidesOn((on) => !on)}
              onToggleGrid={() => setGridOn((on) => !on)}
              onOverflow={setItemsOverflow}
              onComment={handleComment}
              isNormalUser={can ? !can('templates:write') : user?.role === "user"}
              onScaleChange={handleScaleChange}
              onDropImage={insertImage}
              onEditCard={handleEditCard}
              onOpenBrandKit={() => navigate("/brand-kit")}
            />

            <EditorPanel
              tab={tab}
              items={activeItems}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              brandKit={brandKit}
              page={page}
              activeSection={activeSection}
              onPageChange={editPage}
              onResetPageSection={resetPageSection}
              onApplyColorToken={applyColorToken}
              onApplyFontToken={applyFontToken}
              actions={panelActions}
              onClose={() => setTab("")}
            />
          </div>

          <SectionSettingsPanel
            isOpen={settingsDrawerOpen}
            onClose={() => setSettingsDrawerOpen(false)}
            section={activeSection}
            sections={sections}
            brandKit={brandKit}
            size={size}
            brandLayer={brandLayer}
            onEditBrandBand={brandLayer ? null : editBrandBand}
            onSectionChange={editSection}
            onPageChange={editPage}
            onResetPageSection={resetPageSection}
          />
        </div>
      )}

      {wide && !previewOn ? (
        <footer
          aria-label="Editor status and zoom"
          className="flex h-10 shrink-0 items-center justify-between border-t border-[#E5E7EB] bg-white px-3 text-xs text-[#6B7280] z-20"
        >
          {/* Left: autosave status, poster size, warning chip */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-[#4B5563]">
              <Cloud className={`h-3.5 w-3.5 ${dirty ? "text-[#9CA3AF]" : "text-[#16A34A]"}`} />
              <span>{dirty ? "Unsaved changes" : "Saved"}</span>
            </div>

            <span className="text-[#D1D5DB]">·</span>

            <span className="tabular-nums font-mono text-[11px] text-[#6B7280]">
              {size.width} × {size.height} px
            </span>

            {itemsOverflow ? (
              <span
                role="status"
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                title="Some text in the poster exceeds its container bounds"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                Words do not fit
              </span>
            ) : null}
          </div>

          {/* Right: jump to a part, zoom out, slider, zoom in, percentage field, Fit, 100%, full screen */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Jump to a part of the poster"
              className="mr-1 flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5"
            >
              {(brandLayer ? ["header", "footer"] : ["header", "content", "footer"]).map((key) => {
                const active = !showFullPoster && activeSection === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchSection(key)}
                    aria-pressed={active}
                    className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? "bg-[#2563EB] text-white"
                        : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => {
                const current = Math.round(editorScale * 100);
                setZoom(Math.max(25, current - 10));
              }}
              className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <input
              type="range"
              min={25}
              max={400}
              step={1}
              value={Math.round(editorScale * 100)}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20 accent-[#2563EB] cursor-pointer"
              aria-label="Zoom slider"
            />

            <button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => {
                const current = Math.round(editorScale * 100);
                setZoom(Math.min(400, current + 10));
              }}
              className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center">
              <input
                type="text"
                value={percentInput}
                onChange={(e) => setPercentInput(e.target.value)}
                onBlur={() => {
                  const val = parseInt(percentInput.replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(val)) {
                    const clamped = Math.max(25, Math.min(400, val));
                    setZoom(clamped);
                    setPercentInput(`${clamped}%`);
                  } else {
                    setPercentInput(`${Math.round(editorScale * 100)}%`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                className="w-14 text-center text-xs font-mono tabular-nums rounded-[4px] border border-[#E5E7EB] py-0.5 bg-white text-[#111827] focus:border-[#2563EB] focus:outline-none"
                aria-label="Zoom percentage"
              />
            </div>

            <button
              type="button"
              onClick={() => setZoom("fit")}
              className={`px-2 py-0.5 rounded-[4px] text-xs font-medium transition-colors ${
                zoom === "fit"
                  ? "bg-[#EFF6FF] text-[#2563EB] font-semibold border border-blue-200"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] border border-[#E5E7EB]"
              }`}
            >
              Fit
            </button>

            <button
              type="button"
              onClick={() => setZoom(100)}
              className={`px-2 py-0.5 rounded-[4px] text-xs font-medium transition-colors ${
                zoom === 100
                  ? "bg-[#EFF6FF] text-[#2563EB] font-semibold border border-blue-200"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] border border-[#E5E7EB]"
              }`}
            >
              100%
            </button>

            <button
              type="button"
              title={rulersOn || gridOn ? "Hide rulers and grid" : "Show rulers and grid"}
              aria-label={rulersOn || gridOn ? "Hide rulers and grid" : "Show rulers and grid"}
              onClick={() => {
                const next = !(rulersOn || gridOn);
                setRulersOn(next);
                setGridOn(next);
              }}
              className={`rounded p-1 transition-colors ${
                rulersOn || gridOn
                  ? "bg-blue-50 text-[#2563EB]"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              title={isFullscreen ? "Exit full screen" : "Full screen"}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
              className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </footer>
      ) : null}

      {drawerOpen ? (
        <VersionDrawer
          versions={saved?.versions || []}
          currentVersion={saved?.version || 1}
          brandKit={brandKit}
          namesById={namesById}
          currentUserId={user?.id || ""}
          restoring={restoring}
          onClose={() => setDrawerOpen(false)}
          onRestore={restore}
        />
      ) : null}

      {/* Unsaved Changes Confirmation Modal */}
      <Dialog open={backModalOpen} onOpenChange={setBackModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Unsaved changes
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              {brandLayer
                ? "You have unsaved changes to your organization header and footer. Save them before you leave?"
                : "You have unsaved changes in this template. Do you want to save before leaving?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="text-xs h-9 rounded-[6px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setBackModalOpen(false);
                navigate(nextRoute);
              }}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-xs h-9 rounded-[6px] border-[#E5E7EB] text-[#374151]"
              onClick={() => setBackModalOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs h-9 rounded-[6px]"
              onClick={async () => {
                const ok = await save();
                if (ok) {
                  setBackModalOpen(false);
                  navigate(nextRoute);
                }
              }}
            >
              Save and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Template details
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Update the template name, category, and version note.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#374151]">
                Template name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_LIMIT))}
                placeholder="Give this template a name"
                maxLength={NAME_LIMIT}
                className="h-9 rounded-[6px] text-xs border-[#E5E7EB]"
              />
              <p className="text-[11px] text-[#9CA3AF] text-right tabular-nums">
                {name.length}/{NAME_LIMIT}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#374151]">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 rounded-[6px] text-xs border-[#E5E7EB]">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#374151]">
                Version note <span className="text-[#9CA3AF] font-normal">(optional)</span>
              </Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))}
                placeholder="What changed in this version?"
                rows={3}
                maxLength={NOTE_LIMIT}
                className="w-full rounded-[6px] border border-[#E5E7EB] p-2 text-xs text-[#111827] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
              <p className="text-[11px] text-[#9CA3AF] text-right tabular-nums">
                {note.length}/{NOTE_LIMIT}
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-[#F3F4F6]">
            <Button
              type="button"
              className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs h-9 px-4 rounded-[6px]"
              onClick={() => setDetailsOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Modal */}
      <Dialog open={keyboardOpen} onOpenChange={setKeyboardOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Shortcuts to help you edit faster.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 text-xs py-3 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Undo</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + Z</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Redo</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + Y</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Copy</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + C</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Paste</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + V</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Cut</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + X</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Duplicate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + D</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Group</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + G</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Ungroup</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + Shift + G</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Delete</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Del / Backspace</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Nudge 1px</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Arrow keys</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Nudge 10px</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Shift + Arrows</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Multi-select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Shift + Click / Drag</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Switch section</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Alt + 1 / 2 / 3</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Clear / Fit</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Esc</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Zoom canvas</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Ctrl + Wheel / + -</kbd>
            </div>
            <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F9FAFB] border border-[#E5E7EB]">
              <span className="text-[#4B5563]">Pan canvas</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D1D5DB] font-mono text-[11px] font-semibold text-[#111827]">Space + Drag</kbd>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#F3F4F6]">
            <Button
              type="button"
              className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs h-9 px-4 rounded-[6px]"
              onClick={() => setKeyboardOpen(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingCardId && cardListItem ? (
        <React.Suspense fallback={null}>
          <CardEditorModal
            isOpen={Boolean(editingCardId)}
            item={cardListItem}
            brandKit={brandKit}
            onClose={() => setEditingCardId("")}
            onCommit={handleCommitCard}
          />
        </React.Suspense>
      ) : null}
    </div>
  );
}
