import React, { useEffect } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Lock,
  LockOpen,
  Shapes,
  Square,
  Type,
  X,
} from 'lucide-react';
import BrandImageField from '../brand/BrandImageField';
import { ELEMENT_LIMITS } from '../../../../shared/templateElements.js';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  SHAPE_VARIANTS,
  TEXT_VARIANTS,
  isHeadlineItem,
  itemLabel,
  layersOf,
} from '../../utils/templateEditorItems';

/* ------------------------------------------------------------------ *
 * The narrow strip down the left, and the panel it slides open.
 *
 * Five doors: the poster's own parts, words of your own, photos, plain shapes and
 * the order things sit in. Each one opens over the canvas and shuts again as soon
 * as you click the poster, so the canvas is never squeezed by a permanent panel.
 * ------------------------------------------------------------------ */

export const RAIL_TABS = [
  { key: 'fields', label: 'Fields', Icon: ListChecks },
  { key: 'text', label: 'Text', Icon: Type },
  { key: 'images', label: 'Images', Icon: ImageIcon },
  { key: 'shapes', label: 'Shapes', Icon: Shapes },
  { key: 'layers', label: 'Layers', Icon: Layers },
];

export default function EditorRail({ tab, onTab }) {
  return (
    <nav aria-label="What to add" className="flex w-16 shrink-0 flex-col items-stretch gap-1 border-r border-line bg-canvas py-2">
      {RAIL_TABS.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            onClick={() => onTab(active ? '' : key)}
            className={`mx-2 flex flex-col items-center gap-1 rounded-btn py-2 text-[10px] font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              active ? 'bg-primary/10 text-primary' : 'text-body hover:bg-section'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function Row({ item, selected, onSelect, children }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-btn border px-2 py-1.5 ${
        selected ? 'border-primary bg-primary/5' : 'border-line bg-canvas'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-heading hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {itemLabel(item)}
      </button>
      {children}
    </div>
  );
}

function TinyButton({ label, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded p-1 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        label === 'Remove' ? 'text-[rgb(220,38,38)] hover:bg-red-50' : 'text-muted hover:bg-section hover:text-heading'
      }`}
    >
      {icon}
    </button>
  );
}

const lockIcon = (locked) => (locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />);

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-btn border border-dashed border-line bg-section px-3 py-2 text-left text-xs font-semibold text-heading hover:border-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}

function FieldsPanel({ items, selectedId, actions }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        These are the parts of a poster that come from what the person filling it in types. Place each one where
        you want it to show.
      </p>
      <ul className="space-y-1.5">
        {FIELD_ORDER.map((field) => {
          const placed = items.filter((item) => item.kind === 'field' && item.field === field);
          if (placed.length === 0) {
            return (
              <li key={field}>
                <AddButton onClick={() => actions.addField(field)}>Add {FIELD_LABELS[field]}</AddButton>
              </li>
            );
          }
          return (
            <li key={field} className="space-y-1">
              {placed.map((item) => (
                <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={actions.select}>
                  <TinyButton
                    label={item.locked ? 'Allow moving' : 'Keep in place'}
                    icon={lockIcon(item.locked)}
                    onClick={() => actions.toggleLock(item.id)}
                  />
                  <TinyButton
                    label="Remove"
                    icon={<X className="h-3.5 w-3.5" />}
                    disabled={isHeadlineItem(item)}
                    onClick={() => actions.remove(item.id)}
                  />
                </Row>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted">The headline always stays on the poster.</p>
    </div>
  );
}

function TextPanel({ items, selectedId, actions }) {
  const textItems = items.filter((item) => item.kind === 'text');
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Words that are part of the design and never change. Double-click one of them on the poster to write it.
      </p>
      <div className="space-y-1.5">
        {Object.entries(TEXT_VARIANTS).map(([key, variant]) => (
          <AddButton key={key} onClick={() => actions.addText(key)}>
            Add {variant.label}
          </AddButton>
        ))}
      </div>
      {textItems.length > 0 ? (
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="text-xs font-semibold text-heading">On this poster</p>
          {textItems.map((item) => (
            <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={actions.select}>
              <TinyButton label="Make a copy" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => actions.duplicate(item.id)} />
              <TinyButton label="Remove" icon={<X className="h-3.5 w-3.5" />} onClick={() => actions.remove(item.id)} />
            </Row>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] text-muted">
        {items.length} of {ELEMENT_LIMITS.maxItems} items placed.
      </p>
    </div>
  );
}

function ImagesPanel({ items, selectedId, actions, brandKit }) {
  const pictures = items.filter((item) => item.kind === 'image' || item.field === 'photo');
  const chosen = pictures.find((item) => item.id === selectedId) || null;
  const defaultPhoto = brandKit?.content?.defaultImageUrl || '';

  return (
    <div className="space-y-3">
      <AddButton onClick={() => actions.addImage()}>Add a photo</AddButton>

      {pictures.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-heading">On this poster</p>
          {pictures.map((item) => (
            <Row key={item.id} item={item} selected={item.id === selectedId} onSelect={actions.select}>
              <TinyButton label="Make a copy" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => actions.duplicate(item.id)} />
              <TinyButton label="Remove" icon={<X className="h-3.5 w-3.5" />} onClick={() => actions.remove(item.id)} />
            </Row>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          A photo box with no picture in it shows nothing at all, so the poster stays clean either way.
        </p>
      )}

      {chosen ? (
        <div className="space-y-2 border-t border-line pt-3">
          <BrandImageField
            label="Choose a photo"
            kind="template"
            value={chosen.imageUrl || ''}
            onChange={(url) => actions.setImageUrl(chosen.id, url)}
          />
          {defaultPhoto && chosen.imageUrl !== defaultPhoto ? (
            <button
              type="button"
              onClick={() => actions.setImageUrl(chosen.id, defaultPhoto)}
              className="w-full rounded-btn border border-line px-3 py-2 text-xs font-semibold text-heading hover:bg-section"
            >
              Use your organization&rsquo;s own photo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ShapesPanel({ items, selectedId, actions }) {
  const chosen = items.find((item) => item.id === selectedId && item.kind === 'shape') || null;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {Object.entries(SHAPE_VARIANTS).map(([key, variant]) => (
          <AddButton key={key} onClick={() => actions.addShape(key)}>
            <span className="flex items-center gap-2">
              {key === 'circle' ? (
                <Circle className="h-3.5 w-3.5" />
              ) : key === 'line' ? (
                <ArrowDown className="h-3.5 w-3.5 rotate-90" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Add a {variant.label.toLowerCase()}
            </span>
          </AddButton>
        ))}
      </div>

      {chosen ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs font-semibold text-heading">This shape</p>
          <div className="flex gap-1.5">
            {['rect', 'circle', 'line'].map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={chosen.shape?.type === type}
                onClick={() => actions.setShape(chosen.id, { type })}
                className={`flex-1 rounded-btn border px-2 py-1 text-[11px] font-semibold ${
                  chosen.shape?.type === type ? 'border-primary bg-primary/10 text-primary' : 'border-line text-body hover:bg-section'
                }`}
              >
                {SHAPE_VARIANTS[type].label}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-body">
            Colour
            <input
              type="color"
              aria-label="Shape colour"
              value={/^#[0-9a-f]{6}$/i.test(chosen.shape?.fill || '') ? chosen.shape.fill : '#059669'}
              onChange={(event) => actions.setShape(chosen.id, { fill: event.target.value })}
              className="h-7 w-9 cursor-pointer rounded border border-line bg-canvas p-0.5"
            />
          </label>
          {chosen.shape?.type === 'line' ? (
            <label className="flex items-center justify-between gap-2 text-xs text-body">
              Line thickness
              <input
                type="number"
                aria-label="Line thickness"
                min={0}
                max={ELEMENT_LIMITS.strokeWidth.max}
                value={chosen.shape?.strokeWidth || 4}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  if (Number.isFinite(n)) {
                    actions.setShape(chosen.id, { strokeWidth: Math.min(ELEMENT_LIMITS.strokeWidth.max, Math.max(0, n)) });
                  }
                }}
                className="w-16 rounded border border-line px-1.5 py-1 text-xs tabular-nums"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LayersPanel({ items, selectedId, actions }) {
  const layers = layersOf(items);
  if (layers.length === 0) return <p className="text-xs text-muted">Nothing has been placed on this poster yet.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">What sits on top of what. The first row is the closest to you.</p>
      <ul className="space-y-1">
        {layers.map((item, index) => (
          <li key={item.id}>
            <Row item={item} selected={item.id === selectedId} onSelect={actions.select}>
              <TinyButton
                label="Bring forward"
                icon={<ArrowUp className="h-3.5 w-3.5" />}
                disabled={index === 0}
                onClick={() => actions.moveLayer(item.id, 1)}
              />
              <TinyButton
                label="Send backward"
                icon={<ArrowDown className="h-3.5 w-3.5" />}
                disabled={index === layers.length - 1}
                onClick={() => actions.moveLayer(item.id, -1)}
              />
              <TinyButton
                label={item.locked ? 'Allow moving' : 'Keep in place'}
                icon={lockIcon(item.locked)}
                onClick={() => actions.toggleLock(item.id)}
              />
            </Row>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditorPanel({ tab, items, selectedId, brandKit, actions, onClose }) {
  useEffect(() => {
    if (!tab) return undefined;
    const escape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [tab, onClose]);

  if (!tab) return null;

  const title = RAIL_TABS.find((entry) => entry.key === tab)?.label || '';

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute bottom-0 left-0 top-0 z-[55] w-[300px] max-w-[86vw] overflow-y-auto border-r border-line bg-canvas p-4 shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-heading">{title}</h2>
        <button
          type="button"
          aria-label="Close this panel"
          onClick={onClose}
          className="rounded p-1 text-muted hover:bg-section hover:text-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === 'fields' ? <FieldsPanel items={items} selectedId={selectedId} actions={actions} /> : null}
      {tab === 'text' ? <TextPanel items={items} selectedId={selectedId} actions={actions} /> : null}
      {tab === 'images' ? (
        <ImagesPanel items={items} selectedId={selectedId} actions={actions} brandKit={brandKit} />
      ) : null}
      {tab === 'shapes' ? <ShapesPanel items={items} selectedId={selectedId} actions={actions} /> : null}
      {tab === 'layers' ? <LayersPanel items={items} selectedId={selectedId} actions={actions} /> : null}
    </div>
  );
}
