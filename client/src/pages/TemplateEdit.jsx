import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  History as HistoryIcon,
  Keyboard,
  Loader2,
  Monitor,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import TemplatePreview from "../components/TemplatePreview";
import EditorStage from "../components/editor/EditorStage";
import EditorRail, { EditorPanel } from "../components/editor/EditorRail";
import ItemToolbar from "../components/editor/ItemToolbar";
import VersionDrawer from "../components/builder/VersionDrawer";
import { useAuth } from "../context/AuthContext";
import { TEMPLATE_SAMPLE_CONTENT } from "../data/demoPosters";
import {
  EDITOR_VERSION,
  ELEMENT_LIMITS,
  VARIABLE_LIMITS,
  defaultPage,
} from "../../../shared/templateElements.js";
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
  cleanItems,
  commitItemText,
  duplicateItem,
  fixedTextProblems,
  isHeadlineItem,
  itemsArea,
  itemsSignature,
  keepWithinLimits,
  moveItem,
  newFieldItem,
  newImageItem,
  newShapeItem,
  newTextItem,
  patchItem,
  pictureCountOf,
  problemsFor,
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

function itemsOf(template) {
  return Array.isArray(template?.elements) ? template.elements : [];
}

export default function TemplateEdit() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, activeClientId } = useAuth();
  const wide = useWideScreen();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [namesById, setNamesById] = useState({});
  const [baseline, setBaseline] = useState("[]");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Event");
  const [note, setNote] = useState("");

  const [hist, dispatch] = useReducer(historyReducer, {
    past: [],
    present: { items: [], page: defaultPage() },
    future: [],
  });
  const stateRef = useRef({ items: [], page: defaultPage() });
  useEffect(() => {
    stateRef.current = hist.present || { items: [], page: defaultPage() };
  }, [hist.present]);
  const txRef = useRef(null);
  const readState = useCallback(
    () => stateRef.current || { items: [], page: defaultPage() },
    [],
  );
  const readItems = useCallback(() => readState().items || [], [readState]);

  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [tab, setTab] = useState("");
  const [zoom, setZoom] = useState("fit");
  const [guidesOn, setGuidesOn] = useState(true);
  const [gridOn, setGridOn] = useState(false);
  /* Which items are kept out of the way while placing. This is only ever about the editor:
     nothing is hidden on a real poster, and the saved template has no such idea at all. */
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [previewOn, setPreviewOn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [banner, setBanner] = useState(null);

  const size = useMemo(() => resolveTemplateSize(saved), [saved]);
  const area = useMemo(() => itemsArea(brandKit, { size }), [brandKit, size]);
  const items = useMemo(
    () => cleanItems(hist.present?.items || [], area),
    [hist.present?.items, area],
  );
  const page = hist.present?.page || defaultPage();

  const draftTemplate = useMemo(
    () => ({
      id,
      name,
      category,
      size,
      zones: saved?.zones || [],
      layout: saved?.layout || {},
      page,
      editorVersion: EDITOR_VERSION,
      elements: items,
    }),
    [id, name, category, size, saved, page, items],
  );

  const dirty =
    Boolean(saved) &&
    (name.trim() !== (saved.name || "") ||
      category !== (saved.category || "Event") ||
      itemsSignature(items) + "::" + JSON.stringify(page) !== baseline);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );
  /* Everything the save would refuse, in one list: the shared rules first, then the one
     thing only the editor can tell - a box of your own words nobody has written yet. */
  const problems = useMemo(
    () => [
      ...problemsFor(items, { brandKit, size }),
      ...fixedTextProblems(items),
    ],
    [items, brandKit, size],
  );

  /* ------------------------------------------------------------ load */
  /** Puts a template from the server into the editor and calls the work saved. */
  const applyLoaded = useCallback((template, kit) => {
    const clean = cleanItems(
      itemsOf(template),
      itemsArea(kit, { size: resolveTemplateSize(template) }),
    );
    const loadedPage = template.page ? { ...defaultPage(), ...template.page } : defaultPage();
    setSaved(template);
    setName(template.name || "");
    setCategory(template.category || "Event");
    if (kit) setBrandKit(kit);
    setBaseline(itemsSignature(clean) + "::" + JSON.stringify(loadedPage));
    dispatch({ type: "reset", present: { items: clean, page: loadedPage } });
    txRef.current = null;
    setHiddenIds(new Set());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
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
        err?.response?.data?.error?.message ||
          "We could not open this template.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [applyLoaded, id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ----------------------------------------------------------- edits */
  /**
   * One change to the item list. Live changes (a slider being dragged, a colour being
   * picked) are kept out of the undo stack until the gesture ends, so one action is one
   * step back.
   */
  const edit = useCallback(
    (mutate, { live = false } = {}) => {
      const current = readState();
      const nextItems = mutate(current.items || []);
      if (!Array.isArray(nextItems) || nextItems === current.items) return;
      const next = { ...current, items: nextItems };
      if (live) {
        if (txRef.current === null) txRef.current = current;
        dispatch({ type: "live", present: next });
        return;
      }
      const from = txRef.current ?? current;
      txRef.current = null;
      dispatch({ type: "commit", from, present: next });
    },
    [readState],
  );

  const editPage = useCallback(
    (section, patch) => {
      const current = readState();
      const currentSection = current.page?.[section] || {};
      const nextPage = {
        ...(current.page || defaultPage()),
        [section]: { ...currentSection, ...patch },
      };
      const next = { ...current, page: nextPage };
      dispatch({ type: "commit", from: current, present: next });
    },
    [readState],
  );

  const resetPageSection = useCallback(
    (section) => {
      const current = readState();
      const nextPage = {
        ...(current.page || defaultPage()),
        [section]: { mode: "brand" },
      };
      const next = { ...current, page: nextPage };
      dispatch({ type: "commit", from: current, present: next });
    },
    [readState],
  );

  const resetItemToBrand = useCallback(
    (itemId) => {
      edit((itemsList) => {
        return itemsList.map((item) => {
          if (item.id !== itemId) return item;
          const isHead =
            isHeadlineItem(item) || item.field === "title" || item.field === "tagline";
          if (item.kind === "text") {
            return {
              ...item,
              style: {
                ...item.style,
                fontFamily: isHead ? "brand:heading" : "brand:body",
                color: isHead ? "brand:heading" : "brand:text",
              },
            };
          }
          if (item.kind === "shape") {
            const isLine = item.shape?.type === "line";
            return {
              ...item,
              shape: {
                ...item.shape,
                fill: isLine ? "" : "brand:primary",
                stroke: isLine ? "brand:primary" : (item.shape?.stroke ? "brand:primary" : ""),
              },
            };
          }
          return item;
        });
      });
    },
    [edit],
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

  const mapOne = useCallback(
    (itemId, mutate) => (list) => {
      const index = list.findIndex((item) => item.id === itemId);
      if (index < 0) return list;
      const changed = mutate(list[index]);
      if (!changed) return list;
      const next = list.slice();
      next[index] = changed;
      return next;
    },
    [],
  );

  const commitRect = useCallback(
    (itemId, rect) =>
      edit(mapOne(itemId, (item) => moveItem(item, rect, area))),
    [area, edit, mapOne],
  );

  const patchStyle = useCallback(
    (itemId, stylePatch) =>
      edit(
        mapOne(itemId, (item) => patchItem(item, { style: stylePatch }, area)),
      ),
    [area, edit, mapOne],
  );

  const liveStyle = useCallback(
    (itemId, stylePatch) =>
      edit(
        mapOne(itemId, (item) => patchItem(item, { style: stylePatch }, area)),
        { live: true },
      ),
    [area, edit, mapOne],
  );

  const setShape = useCallback(
    (itemId, shapePatch) =>
      edit(
        mapOne(itemId, (item) => patchItem(item, { shape: shapePatch }, area)),
      ),
    [area, edit, mapOne],
  );

  const setImageUrl = useCallback(
    (itemId, url) =>
      edit(mapOne(itemId, (item) => patchItem(item, { imageUrl: url }, area))),
    [area, edit, mapOne],
  );

  const commitText = useCallback(
    (itemId, text) => {
      const words = String(text || "").slice(0, ELEMENT_LIMITS.textChars);
      edit(
        mapOne(itemId, (item) =>
          item.text === words
            ? item
            : commitItemText(item, readItems(), words, area),
        ),
      );
    },
    [area, edit, mapOne, readItems],
  );

  /** Locked | the assistant fills the words in | the person replacing a photo fills it in. */
  const changeMode = useCallback(
    (itemId, mode) =>
      edit(
        mapOne(itemId, (item) => setItemMode(item, readItems(), mode, area)),
      ),
    [area, edit, mapOne, readItems],
  );

  const changeMeta = useCallback(
    (itemId, patch) =>
      edit(
        mapOne(itemId, (item) => setItemMeta(item, readItems(), patch, area)),
      ),
    [area, edit, mapOne, readItems],
  );

  const toggleLock = useCallback(
    (itemId) =>
      edit(mapOne(itemId, (item) => ({ ...item, locked: !item.locked }))),
    [edit, mapOne],
  );

  const add = useCallback(
    (make, warn = "") => {
      const current = readItems();
      if (current.length >= ELEMENT_LIMITS.maxItems) {
        setBanner({
          tone: "error",
          text: `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`,
        });
        return;
      }
      const item = make(current);
      if (!item) return;
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
      edit((list) => [...list, fresh]);
      setSelectedId(fresh.id);
      setPreviewOn(false);
      setBanner(warn ? { tone: "warn", text: warn } : null);
    },
    [edit, readItems],
  );

  const addField = useCallback(
    (field) => add((list) => newFieldItem(field, list, area)),
    [add, area],
  );

  /**
   * A new box of words is one the assistant writes for each poster, until the template is
   * full of them - then it is placed as fixed words and the reason is said out loud.
   */
  const addText = useCallback(
    (variant) => {
      const room = aiTextCount(readItems()) < VARIABLE_LIMITS.maxText;
      return add(
        (list) => newTextItem(variant, list, area, { variable: room }),
        room ? "" : LIMIT_MESSAGES.text,
      );
    },
    [add, readItems],
  );

  const addShape = useCallback(
    (variant) => add((list) => newShapeItem(variant, list, area)),
    [add, area],
  );

  /** Both doors into a photo box: an empty one, or one carrying a picture just uploaded. */
  const addPhoto = useCallback(
    (url) => {
      if (pictureCountOf(readItems()) >= ELEMENT_LIMITS.maxImage) {
        setBanner({
          tone: "error",
          text: `A template holds at most ${ELEMENT_LIMITS.maxImage} photos of its own. Remove one first.`,
        });
        return;
      }
      const room = userImageCount(readItems()) < VARIABLE_LIMITS.maxImage;
      add(
        (list) => newImageItem(list, area, url, { variable: room }),
        room ? "" : LIMIT_MESSAGES.image,
      );
    },
    [add, area, readItems],
  );

  const addImage = useCallback(() => addPhoto(""), [addPhoto]);
  const insertImage = useCallback(
    (url) => (url ? addPhoto(url) : undefined),
    [addPhoto],
  );

  const remove = useCallback(
    (itemId) => {
      const item = readItems().find((each) => each.id === itemId);
      if (!item) return;
      if (isHeadlineItem(item)) {
        setBanner({
          tone: "error",
          text: "The headline always stays on the poster.",
        });
        return;
      }
      edit((list) => list.filter((each) => each.id !== itemId));
      setHiddenIds((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      if (itemId === selectedId) setSelectedId("");
      if (itemId === editingId) setEditingId("");
    },
    [edit, editingId, readItems, selectedId],
  );

  const duplicate = useCallback(
    (itemId) => {
      const current = readItems();
      if (current.length >= ELEMENT_LIMITS.maxItems) {
        setBanner({
          tone: "error",
          text: `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`,
        });
        return;
      }
      const item = current.find((each) => each.id === itemId);
      if (!item) return;
      const copy = duplicateItem(item, current, area);
      const { items: placed, reason } = keepWithinLimits([copy], current, area);
      edit((list) => [...list, ...placed]);
      setSelectedId(placed[0].id);
      setBanner(reason ? { tone: "warn", text: reason } : null);
    },
    [area, edit, readItems],
  );

  /** The selected item, kept for this browser tab so it can be put back on another template. */
  const copyItem = useCallback(
    (itemId) => {
      const item = readItems().find((each) => each.id === itemId);
      if (!item) return;
      writeClipboard(item);
      setBanner({
        tone: "ok",
        text: "Copied. You can put it back on this poster or on another one.",
      });
    },
    [readItems],
  );

  const pasteItem = useCallback(() => {
    const current = readItems();
    const room = ELEMENT_LIMITS.maxItems - current.length;
    if (room <= 0) {
      setBanner({
        tone: "error",
        text: `A template holds at most ${ELEMENT_LIMITS.maxItems} items. Remove one first.`,
      });
      return;
    }
    const { items: offered, problem } = readClipboard(current, area, {
      clientId: activeClientId,
    });
    if (problem) {
      setBanner({ tone: "error", text: problem });
      return;
    }
    const fitting = offered.slice(0, room);
    const { items: placed, reason } = keepWithinLimits(fitting, current, area);
    edit((list) => [...list, ...placed]);
    setSelectedId(placed[placed.length - 1].id);
    setPreviewOn(false);
    setBanner(
      reason
        ? { tone: "warn", text: reason }
        : {
            tone: "ok",
            text: `Put ${placed.length} ${placed.length === 1 ? "item back" : "items back"} on this poster.`,
          },
    );
  }, [activeClientId, area, edit, readItems]);

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
    (itemId, direction) => moveTo(itemId, direction),
    [moveTo],
  );

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
    const clean = cleanItems(itemsOf(saved), area);
    const savedPage = saved.page ? { ...defaultPage(), ...saved.page } : defaultPage();
    setName(saved.name || "");
    setCategory(saved.category || "Event");
    setBaseline(itemsSignature(clean) + "::" + JSON.stringify(savedPage));
    dispatch({ type: "reset", present: { items: clean, page: savedPage } });
    txRef.current = null;
    setBanner(null);
  };

  const clearSelection = useCallback(() => {
    setSelectedId("");
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
        if (tab) setTab("");
        else if (selectedId) setSelectedId("");
        return;
      }
      /* Putting something back needs no selection - it simply lands on this poster. */
      if (meta && key === "v") {
        event.preventDefault();
        pasteItem();
        return;
      }
      if (!selectedId) return;

      if (meta && key === "d") {
        event.preventDefault();
        duplicate(selectedId);
        return;
      }
      if (meta && key === "c") {
        event.preventDefault();
        copyItem(selectedId);
        return;
      }
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        remove(selectedId);
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
        edit(
          mapOne(selectedId, (item) =>
            moveItem(
              item,
              { x: item.x + dx * step, y: item.y + dy * step },
              area,
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    area,
    copyItem,
    drawerOpen,
    duplicate,
    edit,
    mapOne,
    pasteItem,
    previewOn,
    remove,
    selectedId,
    tab,
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
    if (
      dirty &&
      !window.confirm(
        "Leave with these changes unsaved? What you placed will be lost.",
      )
    )
      return;
    navigate("/templates");
  };

  /* ------------------------------------------------------------ save */
  const save = async () => {
    if (!saved) return;
    if (!name.trim()) {
      setBanner({ tone: "error", text: "Give the template a name." });
      return;
    }
    if (problems.length > 0) {
      setBanner({ tone: "error", text: problems[0], more: problems.slice(1) });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const response = await api.patch(`/templates/${id}`, {
        name: name.trim(),
        category,
        elements: items,
        page,
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
          {loadError || "This template could not be opened."}
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
            onClick={() => navigate("/templates")}
            className="btn-ghost border border-line px-4 py-2 text-sm"
          >
            Back to templates
          </button>
        </div>
      </div>
    );
  }

  /* The editor fills the screen below the sticky app header: 64 px, plus the 44 px
   * organization bar only a superadmin sees. */
  const headerH = 64 + (user?.role === "superadmin" ? 44 : 0);

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
    addText,
    addImage,
    insertImage,
    addShape,
    remove,
    duplicate,
    toggleLock,
    toggleHidden,
    moveLayer,
    dropLayer,
    setShape,
    setImageUrl,
    setStyle: patchStyle,
    setStyleLive: liveStyle,
  };

  return (
    <div
      className="flex min-h-0 flex-col"
      style={{ height: `calc(100vh - ${headerH}px)` }}
    >
      {/* ------------------------------------------------------ top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="h-8 gap-1.5 px-2 text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          <label className="min-w-0 flex-1 max-w-sm">
            <span className="sr-only">Template name</span>
            <input
              type="text"
              value={name}
              maxLength={NAME_LIMIT}
              onChange={(event) => setName(event.target.value)}
              aria-label="Template name"
              className="h-8 w-full truncate rounded-[6px] border border-transparent bg-transparent px-2 text-[14px] font-semibold text-[#111827] hover:border-[#E5E7EB] focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                dirty ? "bg-[#9CA3AF]" : "bg-[#16A34A]"
              }`}
            />
            <span>
              {dirty ? "Unsaved changes" : `Saved as version ${saved.version || 1}`}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "undo" })}
              disabled={hist.past.length === 0}
              aria-label="Undo"
              title="Undo"
              className="h-8 w-8 p-0 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "redo" })}
              disabled={hist.future.length === 0}
              aria-label="Redo"
              title="Redo"
              className="h-8 w-8 p-0 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-30"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <div
            role="group"
            aria-label="Edit or preview"
            className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-0.5"
          >
            <button
              type="button"
              aria-pressed={!previewOn}
              onClick={() => setPreviewOn(false)}
              className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                !previewOn
                  ? "bg-white font-semibold text-[#111827]"
                  : "text-[#6B7280] hover:text-[#111827]"
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
                  ? "bg-white font-semibold text-[#111827]"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              Preview
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            className="h-8 gap-1.5 rounded-[6px] border-[#E5E7EB] px-3 text-xs font-medium text-[#111827] shadow-none hover:bg-[#F3F4F6]"
          >
            <HistoryIcon className="h-3.5 w-3.5 text-[#6B7280]" /> Versions
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={saving}
            className="h-8 gap-1.5 rounded-[6px] bg-[#2563EB] px-3.5 text-xs font-medium text-white shadow-none hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* --------------------------------------------- type and note row */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-3">
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7280] shrink-0">Type</span>
            <Select value={category} onValueChange={(val) => setCategory(val)}>
              <SelectTrigger className="h-7 w-32 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] shadow-none focus:ring-1 focus:ring-[#2563EB]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="rounded-[6px] border-[#E5E7EB]">
                {TEMPLATE_CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 items-center gap-2 min-w-[200px] max-w-md">
            <span className="text-xs text-[#6B7280] shrink-0">Note</span>
            <Input
              type="text"
              value={note}
              maxLength={NOTE_LIMIT}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did you change? (optional)"
              className="h-7 rounded-[6px] border-[#E5E7EB] bg-white text-xs text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {dirty ? (
            <button
              type="button"
              onClick={resetToSaved}
              className="text-xs text-[#6B7280] hover:text-[#111827] underline"
            >
              Undo everything
            </button>
          ) : null}
          <p className="text-xs text-[#6B7280]">
            {size.width} × {size.height} pixels
          </p>
        </div>
      </div>

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
                  Use a larger screen to edit templates
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Placing items needs room for the poster and its tools side by
                  side. Below is a look at this template as it stands, so you
                  can still check it here.
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
          <EditorRail tab={tab} onTab={setTab} />

          <div className="relative min-h-0 min-w-0 flex-1">
            <EditorStage
              size={size}
              area={area}
              brandKit={brandKit}
              template={draftTemplate}
              content={TEMPLATE_SAMPLE_CONTENT}
              items={items}
              selectedId={selectedId}
              editingId={editingId}
              zoom={zoom}
              guidesOn={guidesOn}
              gridOn={gridOn}
              hiddenIds={hiddenIds}
              onSelect={setSelectedId}
              onStartEdit={setEditingId}
              onStopEdit={() => setEditingId("")}
              onCommitText={commitText}
              onCanvasClick={clearSelection}
              onCommitRect={commitRect}
              onToggleLock={toggleLock}
              onDuplicate={duplicate}
              onDelete={remove}
              onReorder={reorderTo}
              onZoom={setZoom}
              onToggleGuides={() => setGuidesOn((on) => !on)}
              onToggleGrid={() => setGridOn((on) => !on)}
            />

            {selected ? (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-[52] flex justify-center px-2">
                <div className="pointer-events-auto max-w-full">
                  <ItemToolbar
                    item={selected}
                    items={items}
                    brandKit={brandKit}
                    page={page}
                    onStyle={patchStyle}
                    onStyleLive={liveStyle}
                    onMode={changeMode}
                    onMeta={changeMeta}
                    onResetToBrand={resetItemToBrand}
                  />
                </div>
              </div>
            ) : null}

            <EditorPanel
              tab={tab}
              items={items}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              brandKit={brandKit}
              page={page}
              onPageChange={editPage}
              onResetPageSection={resetPageSection}
              onApplyColorToken={applyColorToken}
              onApplyFontToken={applyFontToken}
              actions={panelActions}
              onClose={() => setTab("")}
            />
          </div>
        </div>
      )}

      {wide && !previewOn ? (
        <p className="flex shrink-0 items-center gap-1.5 border-t border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] text-[#6B7280]">
          <Keyboard className="h-3.5 w-3.5 text-[#9CA3AF]" />
          Arrow keys move the picked item 1 pixel, Shift for 10 · Delete removes
          it · Ctrl or Command with D makes a copy, with C copies it for another
          template and with V puts it back, with Z goes back, with Y comes
          forward · Esc lets go
        </p>
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
    </div>
  );
}
