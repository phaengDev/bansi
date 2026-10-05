import React, { useRef } from 'react';
import { Toggle } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import {
  wallpaperColorIds,
  wallpaperNameKeys,
  wallpaperPhotoIds,
  wallpaperPhotos,
  wallpaperSwatches,
  type WallpaperId,
} from './DesktopShared';

type DesktopSettingsProps = {
  taskbarPinned: boolean;
  onToggleTaskbarPinned: (pinned: boolean) => void;
  /** "Arrange icons" — snaps every desktop icon back to the default tidy grid. */
  onArrangeIcons: () => void;
  wallpaper: WallpaperId;
  onSelectWallpaper: (id: WallpaperId) => void;
};

type WallpaperSwatchProps = {
  id: WallpaperId;
  label: string;
  selected: boolean;
  preview: React.CSSProperties;
  onSelect: (id: WallpaperId) => void;
};

type StripDragState = {
  pointerId: number;
  startX: number;
  startScroll: number;
  dragging: boolean;
} | null;

/** How far the pointer has to travel before it counts as a drag rather than a click on a swatch. */
const DRAG_THRESHOLD = 5;

/**
 * A swatch row that scrolls sideways. It shows four at a time with no visible scrollbar, so the row
 * is dragged with the mouse instead — grab anywhere and pull. A press that never travels past
 * DRAG_THRESHOLD stays a plain click, so picking a wallpaper still works exactly as before; one that
 * does is swallowed on the way back up so the drag can't accidentally select whatever it ended on.
 */
const ScrollStrip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<StripDragState>(null);
  const draggedRef = useRef(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    if (!strip || event.button !== 0) return;
    draggedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: strip.scrollLeft,
      dragging: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const strip = stripRef.current;
    if (!state || state.pointerId !== event.pointerId || !strip) return;

    const deltaX = event.clientX - state.startX;
    if (!state.dragging) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD) return;
      state.dragging = true;
      draggedRef.current = true;
      // Captured only once it really is a drag, so a plain click still reaches the swatch button.
      strip.setPointerCapture(event.pointerId);
    }
    strip.scrollLeft = state.startScroll - deltaX;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const strip = stripRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (state.dragging && strip?.hasPointerCapture(event.pointerId)) {
      strip.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div
      ref={stripRef}
      className="settings-menu-swatches"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        if (!draggedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        draggedRef.current = false;
      }}
    >
      {children}
    </div>
  );
};

const WallpaperSwatch: React.FC<WallpaperSwatchProps> = ({ id, label, selected, preview, onSelect }) => (
  <button
    type="button"
    className="settings-menu-swatch"
    onClick={() => onSelect(id)}
    aria-pressed={selected}
    title={label}
  >
    <span className={`settings-menu-swatch-preview ${selected ? 'is-selected' : ''}`} style={preview}>
      {selected && <i className="fa-solid fa-check" aria-hidden="true" />}
    </span>
    <span className="settings-menu-swatch-label">{label}</span>
  </button>
);

/**
 * The rows inside the Desktop Settings flyout (see the corner icon in the taskbar) — a plain list,
 * grouped into small sections. Add more rows here as settings come; each row is self-contained.
 */
const DesktopSettings: React.FC<DesktopSettingsProps> = ({
  taskbarPinned,
  onToggleTaskbarPinned,
  onArrangeIcons,
  wallpaper,
  onSelectWallpaper,
}) => {
  const t = useT();

  return (
    <div className="settings-menu-body">
      <div className="settings-menu-section">{t('lifeSettingsTaskbarSection')}</div>
      <div className="settings-menu-row">
        <span className="settings-menu-row-label">
          <i className="fa-solid fa-thumbtack" aria-hidden="true" />
          {t('lifeSettingsTaskbarRowLabel')}
        </span>
        <span className="settings-menu-row-control">
          <span className="settings-menu-row-state">
            {taskbarPinned ? t('lifeOn') : t('lifeOff')}
          </span>
          <Toggle
            checked={taskbarPinned}
            onChange={onToggleTaskbarPinned}
            label={<span className="visually-hidden">{t('lifeSettingsTaskbarRowLabel')}</span>}
          />
        </span>
      </div>

      <div className="settings-menu-section">{t('lifeSettingsIconsSection')}</div>
      <div className="settings-menu-row">
        <span className="settings-menu-row-label">
          <i className="fa-solid fa-table-cells" aria-hidden="true" />
          {t('lifeSettingsArrangeRowLabel')}
        </span>
        <button type="button" className="settings-menu-btn" onClick={onArrangeIcons}>
          {t('lifeSettingsArrangeButton')}
        </button>
      </div>

      <div className="settings-menu-section">{t('lifeSettingsWallpaperSection')}</div>

      {/* Row 1 — solid color themes */}
      <div className="settings-menu-row is-label-only">
        <span className="settings-menu-row-label">
          <i className="fa-solid fa-palette" aria-hidden="true" />
          {t('lifeSettingsWallpaperColorLabel')}
        </span>
      </div>
      <ScrollStrip>
        {wallpaperColorIds.map((id) => {
          const [from, to] = wallpaperSwatches[id];
          return (
            <WallpaperSwatch
              key={id}
              id={id}
              label={t(wallpaperNameKeys[id])}
              selected={wallpaper === id}
              preview={{ '--swatch-from': from, '--swatch-to': to } as React.CSSProperties}
              onSelect={onSelectWallpaper}
            />
          );
        })}
      </ScrollStrip>

      {/* Row 2 — photo wallpapers */}
      <div className="settings-menu-row is-label-only">
        <span className="settings-menu-row-label">
          <i className="fa-regular fa-image" aria-hidden="true" />
          {t('lifeSettingsWallpaperPhotoLabel')}
        </span>
      </div>
      <ScrollStrip>
        {wallpaperPhotoIds.map((id) => (
          <WallpaperSwatch
            key={id}
            id={id}
            label={t(wallpaperNameKeys[id])}
            selected={wallpaper === id}
            preview={{ backgroundImage: `url(${wallpaperPhotos[id]})` }}
            onSelect={onSelectWallpaper}
          />
        ))}
      </ScrollStrip>

      <div className="settings-menu-section">{t('lifeSettingsMoreSection')}</div>
      <p className="settings-menu-hint">{t('lifeSettingsMoreHint')}</p>
    </div>
  );
};

export default DesktopSettings;
