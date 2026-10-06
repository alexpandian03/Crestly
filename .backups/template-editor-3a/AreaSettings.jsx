import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Field, Segmented, Toggle } from '../brand/controls';
import {
  AREA_HINTS,
  areaName,
  isEditableType,
  ITEM_KEYS,
  ITEM_NAMES,
  LAYOUT_LABELS,
  MIN_AREA_SIZE,
  TEXT_SIZE_RANGE,
} from '../../utils/templateBuilderRules';

/**
 * The right-hand panel of the builder: the settings of the area that is selected on
 * the canvas, plus the layout choices that belong to the text area.
 */

/**
 * Whole-number box that reports while typing and closes the undo step on blur,
 * so one edit is one "go back" press.
 */
function NumberField({ label, value, min, max, disabled = false, unit = 'px', onFocus, onLive, onDone }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const [draft, setDraft] = useState(null);

  useEffect(() => setDraft(null), [value]);

  const shown = draft === null ? (Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : '') : draft;

  const type = (raw) => {
    setDraft(raw);
    const n = Math.round(Number(raw));
    if (Number.isFinite(n)) onLive(Math.min(max, Math.max(min, n)));
  };

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={shown}
          min={min}
          max={max}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(event) => type(event.target.value)}
          onBlur={(event) => {
            type(event.target.value);
            setDraft(null);
            onDone();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="input-field tabular-nums disabled:cursor-not-allowed disabled:bg-section disabled:text-muted"
        />
        <span className="shrink-0 text-xs text-muted">{unit}</span>
      </div>
    </Field>
  );
}

/** The five layout choices, in the words the Create page uses. */
export function LayoutFields({ layout, onChange }) {
  const keys = ['alignment', 'spacing', 'imagePlacement', 'infoStyle', 'decoration'];
  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <Segmented
          key={key}
          label={LAYOUT_LABELS[key].label}
          value={layout[key]}
          onChange={(next) => onChange(key, next)}
          options={Object.entries(LAYOUT_LABELS[key].values).map(([value, label]) => ({ value, label }))}
        />
      ))}
    </div>
  );
}

/** "20 px right, 10 px up", or nothing when the item sits where the layout put it. */
function movedWords(offset) {
  if (!offset || (!offset.dx && !offset.dy)) return '';
  const parts = [];
  if (offset.dx > 0) parts.push(`${offset.dx} px right`);
  if (offset.dx < 0) parts.push(`${-offset.dx} px left`);
  if (offset.dy > 0) parts.push(`${offset.dy} px down`);
  if (offset.dy < 0) parts.push(`${-offset.dy} px up`);
  return parts.join(', ');
}

/**
 * One item at a time: the layout choices above place every item, and this nudges a single
 * one from that place. Each stay-inside-the-text-area limit comes from the canvas, which
 * has measured where the words actually are.
 */
export function ItemFields({ layout, selectedItem, onSelectItem, itemRooms, api }) {
  const offsets = layout.itemOffsets || {};
  const moved = ITEM_KEYS.filter((key) => movedWords(offsets[key]));
  const room = itemRooms[selectedItem] || null;
  const picked = offsets[selectedItem] || { dx: 0, dy: 0 };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-heading">Move one item</h3>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            The settings above place every item. This nudges a single one of them, and it cannot leave the text area.
          </p>
        </div>
        <button
          type="button"
          onClick={api.resetItems}
          disabled={moved.length === 0}
          className="btn-ghost border border-line inline-flex shrink-0 items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset item positions
        </button>
      </div>

      <div className="space-y-1.5" role="group" aria-label="Items of words">
        {ITEM_KEYS.map((key) => {
          const active = key === selectedItem;
          const movedBy = movedWords(offsets[key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectItem(active ? '' : key)}
              aria-pressed={active}
              className={`w-full flex items-center justify-between gap-2 rounded-btn border px-3 py-2 text-left text-sm transition-colors ${
                active ? 'border-primary bg-primary/5 text-heading' : 'border-line bg-canvas text-body hover:border-primary/60'
              }`}
            >
              <span className="truncate">{ITEM_NAMES[key]}</span>
              {movedBy ? <span className="shrink-0 text-[11px] tabular-nums text-primary">{movedBy}</span> : null}
            </button>
          );
        })}
      </div>

      {selectedItem ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Sideways"
            value={picked.dx}
            min={room ? Math.ceil(room.minDx) : -4000}
            max={room ? Math.floor(room.maxDx) : 4000}
            onFocus={api.begin}
            onLive={(next) => api.setItemOffset(selectedItem, { dx: next, dy: picked.dy }, { live: true })}
            onDone={api.end}
          />
          <NumberField
            label="Up or down"
            value={picked.dy}
            min={room ? Math.round(room.minDy) : -4000}
            max={room ? Math.round(room.maxDy) : 4000}
            onFocus={api.begin}
            onLive={(next) => api.setItemOffset(selectedItem, { dx: picked.dx, dy: next }, { live: true })}
            onDone={api.end}
          />
        </div>
      ) : (
        <p className="text-xs text-muted rounded-card bg-section border border-line px-3 py-2">
          Pick an item above, or click it on the poster, to move it on its own.
        </p>
      )}

      <p className="text-xs text-muted">
        Positive numbers move an item right and down. The two boxes stop at the edge of the text area.
      </p>
    </div>
  );
}

export default function AreaSettings({
  zones,
  layout,
  size,
  selectedId,
  onSelect,
  selectedItem,
  itemRooms,
  onSelectItem,
  api,
}) {
  const selected = zones.find((zone) => zone.id === selectedId) || null;
  const editable = Boolean(selected) && isEditableType(selected.type) && !selected.locked;
  const hasImage = zones.some((zone) => zone.type === 'image');

  return (
    <div className="space-y-4">
      <section className="card-surface p-4 space-y-3">
        <h2 className="text-sm font-semibold text-heading">Areas</h2>
        <div className="space-y-1.5" role="group" aria-label="Poster areas">
          {zones.map((zone) => {
            const active = zone.id === selectedId;
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onSelect(zone.id)}
                aria-pressed={active}
                className={`w-full flex items-center justify-between gap-2 rounded-btn border px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'border-primary bg-primary/5 text-heading' : 'border-line bg-canvas text-body hover:border-primary/60'
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  {zone.type === 'image' ? (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                  ) : (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-muted/60'}`} />
                  )}
                  <span className="truncate">{areaName(zone.type)}</span>
                </span>
                {zone.locked || !isEditableType(zone.type) ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Fixed area" />
                ) : null}
              </button>
            );
          })}
        </div>

        {hasImage ? (
          <button
            type="button"
            onClick={api.removeImage}
            className="btn-ghost border border-line w-full justify-center gap-2 text-sm text-danger"
          >
            <Trash2 className="h-4 w-4" /> Remove photo area
          </button>
        ) : (
          <button
            type="button"
            onClick={api.addImage}
            className="btn-primary w-full justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Add photo area
          </button>
        )}
      </section>

      <section className="card-surface p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">{selected ? areaName(selected.type) : 'No area selected'}</h2>
          <p className="text-xs text-muted mt-1 leading-snug">
            {selected ? AREA_HINTS[selected.type] : 'Pick an area on the poster or in the list above to change it.'}
          </p>
        </div>

        {!selected ? (
          <p className="text-xs text-muted rounded-card bg-section border border-line px-3 py-2">
            Click an area on the poster to move it with the arrow keys, or use the buttons above.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="From the left"
                value={selected.x}
                min={0}
                max={size.width - (editable ? selected.w : 0)}
                disabled={!editable}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { x: next }, true)}
                onDone={api.end}
              />
              <NumberField
                label="From the top"
                value={selected.y}
                min={0}
                max={size.height - (editable ? selected.h : 0)}
                disabled={!editable}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { y: next }, true)}
                onDone={api.end}
              />
              <NumberField
                label="Width"
                value={selected.w}
                min={MIN_AREA_SIZE.width}
                max={size.width}
                disabled={!editable}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { w: next }, true)}
                onDone={api.end}
              />
              <NumberField
                label="Height"
                value={selected.h}
                min={MIN_AREA_SIZE.height}
                max={size.height}
                disabled={!editable}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { h: next }, true)}
                onDone={api.end}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Smallest text"
                unit="px"
                value={selected.minFont}
                min={TEXT_SIZE_RANGE.min}
                max={TEXT_SIZE_RANGE.max}
                disabled={!editable || selected.locked}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { minFont: next }, true)}
                onDone={api.end}
              />
              <NumberField
                label="Largest text"
                unit="px"
                value={selected.maxFont}
                min={TEXT_SIZE_RANGE.min}
                max={TEXT_SIZE_RANGE.max}
                disabled={!editable || selected.locked}
                onFocus={api.begin}
                onLive={(next) => api.patchArea(selected.id, { maxFont: next }, true)}
                onDone={api.end}
              />
            </div>
            <p className="text-xs text-muted -mt-2 leading-snug">
              The poster picks a text size between these two so all the words fit in this area.
            </p>

            <Toggle
              label="Keep this area fixed"
              checked={Boolean(selected.locked) || !isEditableType(selected.type)}
              onChange={(next) => api.setLocked(selected.id, next)}
              hint={
                isEditableType(selected.type)
                  ? 'A fixed area stays exactly where it is when a poster is made.'
                  : 'Brand areas always stay fixed because your brand kit fills them.'
              }
            />

            {selected.type === 'content' ? (
              <div className="pt-1 border-t border-line space-y-3">
                <h3 className="text-sm font-semibold text-heading">Layout settings</h3>
                <p className="text-xs text-muted -mt-1">
                  These choices set how the words sit inside the text area. They are the same ones in the left
                  panel.
                </p>
                <LayoutFields layout={layout} onChange={api.setLayout} />
              </div>
            ) : null}

            {selected.type === 'content' ? (
              <div className="pt-3 border-t border-line">
                <ItemFields
                  layout={layout}
                  selectedItem={selectedItem}
                  onSelectItem={onSelectItem}
                  itemRooms={itemRooms}
                  api={api}
                />
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
