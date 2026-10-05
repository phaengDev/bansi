import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useT } from '../../context/LanguageContext';
import { type LifeOutletContext, type ShortcutId } from './DesktopShared';
import DesktopGlance, { useGlanceHidden } from './DesktopGlance';

type DragState = {
  id: ShortcutId;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

/**
 * The desktop "app launcher" view — wallpaper and the shortcut icons, freely draggable to anywhere
 * on the desktop (position remembered per-browser). Rendered by <LifeShell> via <Outlet> as the
 * index route of `life/*`; the taskbar, popups, brand/user menu, and Start menu all live in
 * <LifeShell> so they persist no matter which `life/*` page is active.
 *
 * Dragging uses pointer events (not the HTML5 drag-and-drop API — it's flaky across browsers and
 * doesn't work on touch), same technique as dragging an <AppWindow> popup by its titlebar.
 */
const AccountDesktopMenu: React.FC = () => {
  const { openShortcut, iconPositions, menus, openWindows } = useOutletContext<LifeOutletContext>();
  const [glanceHidden, setGlanceHidden] = useGlanceHidden();
  const { getPosition, setPosition, dropPosition, setArea, grid } = iconPositions;
  const t = useT();
  const containerRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const wasDraggingRef = useRef(false);
  const [draggedId, setDraggedId] = useState<ShortcutId | null>(null);

  /**
   * ບອກຂະໜາດຂອງພື້ນທີ່ວາງໄອຄອນໃຫ້ຮູ້ຢູ່ສະເໝີ — ຕາໜ່າງຕັ້ງຕົ້ນຄິດຈຳນວນແຖວຕໍ່ຖັນຈາກຄວາມສູງອັນນີ້
   * ຈຶ່ງລຽງລົງທາງລຸ່ມແລ້ວຂຶ້ນຖັນໃໝ່ພໍດີກັບຈໍ ບໍ່ວ່າຈະມີປຸ່ມລັດຈັກອັນ ຫຼື ປ່ຽນຂະໜາດໜ້າຕ່າງແນວໃດ
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // ຄ່າເກົ່າຄືນອັນເກົ່າ — ບໍ່ໃຫ້ render ຊ້ຳໂດຍບໍ່ຈຳເປັນ
      setArea((current) =>
        current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [setArea]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: ShortcutId) => {
    const iconRect = event.currentTarget.getBoundingClientRect();
    wasDraggingRef.current = false;
    dragStateRef.current = {
      id,
      offsetX: event.clientX - iconRect.left,
      offsetY: event.clientY - iconRect.top,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    const container = containerRef.current;
    if (!state || !container) return;

    if (!state.dragging) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 6) return;
      state.dragging = true;
      wasDraggingRef.current = true;
      setDraggedId(state.id);
    }

    const containerRect = container.getBoundingClientRect();
    const maxX = Math.max(0, containerRect.width - grid.width);
    const maxY = Math.max(0, containerRect.height - grid.height);
    const nextX = Math.min(maxX, Math.max(0, event.clientX - containerRect.left - state.offsetX));
    const nextY = Math.min(maxY, Math.max(0, event.clientY - containerRect.top - state.offsetY));
    setPosition(state.id, { x: nextX, y: nextY });
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Let go of a dragged icon and it settles onto the grid — nudged to the nearest free cell if it
    // was dropped over another icon, so icons stay evenly spaced instead of piling up.
    if (dragStateRef.current?.dragging) dropPosition(dragStateRef.current.id);

    dragStateRef.current = null;
    setDraggedId(null);
  };

  return (
    <>
      {/* ພາບລວມຢູ່ຂວາ — ຕອນສະແດງ ພື້ນທີ່ວາງໄອຄອນແຄບລົງ (has-glance) ບໍ່ໃຫ້ໄອຄອນໄປຢູ່ກ້ອງມັນ */}
      {glanceHidden ? (
        <button type="button" className="acc-glance-pill" onClick={() => setGlanceHidden(false)}>
          <i className="fa-solid fa-chart-simple" /> {t('glanceShow')}
        </button>
      ) : (
        <DesktopGlance menus={menus} openShortcut={openShortcut} openWindows={openWindows} onHide={() => setGlanceHidden(true)} />
      )}
      <nav ref={containerRef} className={`life-desktop-shortcuts${glanceHidden ? '' : ' has-glance'}`} aria-label={t('lifeShortcutsAriaLabel')}>
        {menus.map((shortcut, index) => {
          const position = getPosition(shortcut.id, index);
          return (
            <button
              type="button"
              key={shortcut.id}
              className={`life-desktop-shortcut ${draggedId === shortcut.id ? 'is-dragging' : ''}`}
              style={{
                left: position.x,
                top: position.y,
                '--shortcut-order': index,
              } as React.CSSProperties}
              onClick={(event) => {
                event.stopPropagation();
                if (wasDraggingRef.current) {
                  wasDraggingRef.current = false;
                  return;
                }
                openShortcut(shortcut.id);
              }}
              onPointerDown={(event) => handlePointerDown(event, shortcut.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <span className={`life-desktop-shortcut-icon is-${shortcut.tone}`}>
                <i className={shortcut.iconClass} aria-hidden="true" />
                {shortcut.locked && (
                  <em className="life-desktop-shortcut-lock" title={t('menuLockLocked')}>
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                  </em>
                )}
              </span>
              <span>{shortcut.name}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default AccountDesktopMenu;
