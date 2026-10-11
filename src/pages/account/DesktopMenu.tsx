import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useT } from '../../context/LanguageContext';
import { isFolderId, type DesktopFolder, type LifeOutletContext, type ShortcutId } from './DesktopShared';
import type { AccountMenu } from './accountMenus';
import DesktopGlance, { useGlanceHidden } from './DesktopGlance';

type DragState = {
  id: string;
  /** ລາກມາຈາກກຸ່ມທີ່ເປີດຢູ່ ແລະ ຍັງບໍ່ອອກນອກກອບ — ອອກເມື່ອໃດ ຈຶ່ງອອກຈາກກຸ່ມມາລາກຕໍ່ເທິງ desktop */
  folderId?: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  /** ຈາກ pointer ຫາກາງໄອຄອນທີ່ຈັບຢູ່ — ກາງໄອຄອນໄປທັບໄອຄອນອື່ນ = ປ່ອຍແລ້ວຈະເປັນກຸ່ມ */
  probeX: number;
  probeY: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

/**
 * ໄອຄອນອື່ນທີ່ຢູ່ກ້ອງຈຸດ (x, y): `dropId` = ກ່ອງໄອຄອນເທິງ desktop (ທັບແລ້ວເປັນກຸ່ມ),
 * `folderSlot` = ຊ່ອງໃນກຸ່ມທີ່ເປີດຢູ່ (ສະລັບລຳດັບ)
 */
const dropTargetAt = (x: number, y: number, draggedId: string, attribute: 'dropId' | 'folderSlot') =>
  document.elementsFromPoint(x, y)
    .map((element) => (element as HTMLElement).dataset?.[attribute])
    .find((id) => id && id !== draggedId) ?? null;

/**
 * The desktop "app launcher" view — wallpaper and the shortcut icons, freely draggable to anywhere
 * on the desktop (position remembered per-browser). Rendered by <LifeShell> via <Outlet> as the
 * index route of `life/*`; the taskbar, popups, brand/user menu, and Start menu all live in
 * <LifeShell> so they persist no matter which `life/*` page is active.
 *
 * ລາກໄອຄອນໄປທັບອີກອັນ = ຈັດເປັນກຸ່ມ (ຄືໜ້າຫຼັກຂອງໂທລະສັບ) · ຄລິກກຸ່ມ = ເປີດເບິ່ງ ແລະ ປ່ຽນຊື່ ·
 * ລາກໄອຄອນອອກນອກກອບກຸ່ມ = ເອົາອອກຈາກກຸ່ມ.
 *
 * Dragging uses pointer events (not the HTML5 drag-and-drop API — it's flaky across browsers and
 * doesn't work on touch), same technique as dragging an <AppWindow> popup by its titlebar. Move/up are
 * heard on window so a drag carries on after its icon leaves the folder popup and remounts on the desktop.
 */
const AccountDesktopMenu: React.FC = () => {
  const { openShortcut, desktopLayout, menus, openWindows } = useOutletContext<LifeOutletContext>();
  const [glanceHidden, setGlanceHidden] = useGlanceHidden();
  const { items, setPosition, dropItem, pullFromFolder, moveInFolder, renameFolder, setArea, grid } = desktopLayout;
  const t = useT();
  const containerRef = useRef<HTMLElement>(null);
  const folderPanelRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const wasDraggingRef = useRef(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  /** ໄອຄອນທີ່ກຳລັງຖືກທັບ — ປ່ອຍຕອນນີ້ = ລວມເປັນກຸ່ມ (ຫຼື ສະລັບລຳດັບ ຖ້າລາກຢູ່ໃນກຸ່ມ) */
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  /** ໄອຄອນໃນກຸ່ມທີ່ລາກຢູ່ ເລື່ອນຈາກບ່ອນເດີມເທົ່າໃດ (ຍັງຢູ່ໃນກອບກຸ່ມ) */
  const [folderDragOffset, setFolderDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  /** ໄອຄອນເຂົ້າມາຄົບແລ້ວ — ອັນທີ່ເກີດໃໝ່ພາຍຫຼັງ (ກຸ່ມໃໝ່, ອອກຈາກກຸ່ມ) ຂຶ້ນທັນທີ ບໍ່ລໍຖ້າຕາມລຳດັບ */
  const [settled, setSettled] = useState(false);

  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const membersOf = (folder: DesktopFolder) => folder.items.flatMap((id) => menuById.get(id) ?? []);
  const folderName = (folder: DesktopFolder) => folder.name.trim() || t('desktopFolderUntitled');
  const openFolder = items.find((item) => item.id === openFolderId)?.folder;

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

  // ລຳດັບການເຂົ້າມາ (--shortcut-order) ໃຊ້ສະເພາະຕອນເປີດໜ້າ — ເກີນເວລາທີ່ໄອຄອນສຸດທ້າຍເຂົ້າມາແລ້ວ
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!openFolderId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenFolderId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openFolderId]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, id: string, folderId?: string) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const icon = event.currentTarget.querySelector('.life-desktop-shortcut-icon')!.getBoundingClientRect();
    wasDraggingRef.current = false;
    dragStateRef.current = {
      id,
      folderId,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      probeX: icon.left + icon.width / 2 - event.clientX,
      probeY: icon.top + icon.height / 2 - event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /**
   * ອອກນອກກອບກຸ່ມແລ້ວ ໄອຄອນຈະໄປເປັນປຸ່ມເທິງ desktop — ຕັ້ງ offset ໃໝ່ໃຫ້ກາງໄອຄອນຂອງປຸ່ມນັ້ນຢູ່ບ່ອນດຽວ
   * ກັບກາງໄອຄອນທີ່ຈັບຢູ່. ກ່ອງໄອຄອນຢູ່ບ່ອນດຽວກັນໃນທຸກປຸ່ມ ຈຶ່ງວັດຈາກປຸ່ມໃດກໍ່ໄດ້ (offset* ບໍ່ນັບ transform)
   */
  const alignToDesktopButton = (state: DragState, container: HTMLElement) => {
    const icon = container.querySelector<HTMLElement>('.life-desktop-shortcut > .life-desktop-shortcut-icon');
    const button = icon?.parentElement;
    const iconCenterX = icon && button ? button.clientLeft + icon.offsetLeft + icon.offsetWidth / 2 : grid.width / 2;
    const iconCenterY = icon && button ? button.clientTop + icon.offsetTop + icon.offsetHeight / 2 : grid.height / 2;
    state.offsetX = iconCenterX - state.probeX;
    state.offsetY = iconCenterY - state.probeY;
  };

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    const state = dragStateRef.current;
    const container = containerRef.current;
    if (!state || state.pointerId !== event.pointerId || !container) return;

    if (!state.dragging) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 6) return;
      state.dragging = true;
      wasDraggingRef.current = true;
      setDraggedId(state.id);
    }

    const probeX = event.clientX + state.probeX;
    const probeY = event.clientY + state.probeY;

    if (state.folderId) {
      const panel = folderPanelRef.current?.getBoundingClientRect();
      const insidePanel = panel
        && event.clientX >= panel.left && event.clientX <= panel.right
        && event.clientY >= panel.top && event.clientY <= panel.bottom;
      if (insidePanel) {
        setFolderDragOffset({ x: event.clientX - state.startX, y: event.clientY - state.startY });
        setDropTargetId(dropTargetAt(probeX, probeY, state.id, 'folderSlot'));
        return;
      }
      alignToDesktopButton(state, container);
    }

    const containerRect = container.getBoundingClientRect();
    const maxX = Math.max(0, containerRect.width - grid.width);
    const maxY = Math.max(0, containerRect.height - grid.height);
    const next = {
      x: Math.min(maxX, Math.max(0, event.clientX - containerRect.left - state.offsetX)),
      y: Math.min(maxY, Math.max(0, event.clientY - containerRect.top - state.offsetY)),
    };

    if (state.folderId) {
      pullFromFolder(state.folderId, state.id as ShortcutId, next);
      state.folderId = undefined;
      setOpenFolderId(null);
      setFolderDragOffset(null);
      setDropTargetId(null);
      return;
    }

    setPosition(state.id, next);
    // ກຸ່ມບໍ່ຊ້ອນເຂົ້າກຸ່ມອື່ນ — ລາກກຸ່ມບໍ່ມີເປົ້າໃຫ້ທັບ
    setDropTargetId(isFolderId(state.id) ? null : dropTargetAt(probeX, probeY, state.id, 'dropId'));
  });

  const endDrag = useEffectEvent((event: PointerEvent) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    setFolderDragOffset(null);
    if (!state.dragging) return;

    const target = event.type === 'pointerup'
      ? dropTargetAt(
        event.clientX + state.probeX,
        event.clientY + state.probeY,
        state.id,
        state.folderId ? 'folderSlot' : 'dropId',
      )
      : null;

    if (state.folderId) {
      if (target) moveInFolder(state.folderId, state.id as ShortcutId, target as ShortcutId);
      return;
    }
    // Let go of a dragged icon: onto another icon → they become a folder; anywhere else → it settles
    // onto the grid, nudged to the nearest free cell so icons stay evenly spaced instead of piling up.
    dropItem(state.id, target);
  });

  useEffect(() => {
    const move = (event: PointerEvent) => handlePointerMove(event);
    const end = (event: PointerEvent) => endDrag(event);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  /** ຄລິກທີ່ຕາມຫຼັງການລາກ ບໍ່ນັບເປັນການເປີດ */
  const clickedAfterDrag = () => {
    if (!wasDraggingRef.current) return false;
    wasDraggingRef.current = false;
    return true;
  };

  const renderIcon = (menu: AccountMenu, dropId?: string) => (
    <span className={`life-desktop-shortcut-icon is-${menu.tone}`} data-drop-id={dropId}>
      <i className={menu.iconClass} aria-hidden="true" />
      {menu.locked && (
        <em className="life-desktop-shortcut-lock" title={t('menuLockLocked')}>
          <i className="fa-solid fa-lock" aria-hidden="true" />
        </em>
      )}
    </span>
  );

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
      <nav
        ref={containerRef}
        className={`life-desktop-shortcuts${glanceHidden ? '' : ' has-glance'}${settled ? ' is-settled' : ''}`}
        aria-label={t('lifeShortcutsAriaLabel')}
      >
        {items.map((item, index) => {
          const menu = item.folder ? undefined : menuById.get(item.id as ShortcutId);
          if (!item.folder && !menu) return null;
          const isDragged = draggedId === item.id;
          const className = [
            'life-desktop-shortcut',
            item.folder && 'is-folder',
            isDragged && 'is-dragging',
            isDragged && dropTargetId && 'is-merging',
            dropTargetId === item.id && 'is-drop-target',
          ].filter(Boolean).join(' ');

          return (
            <button
              type="button"
              key={item.id}
              className={className}
              style={{
                left: item.position.x,
                top: item.position.y,
                '--shortcut-order': index,
              } as React.CSSProperties}
              aria-haspopup={item.folder ? 'dialog' : undefined}
              onClick={(event) => {
                event.stopPropagation();
                if (clickedAfterDrag()) return;
                if (item.folder) setOpenFolderId(item.id);
                else openShortcut(menu!.id);
              }}
              onPointerDown={(event) => startDrag(event, item.id)}
            >
              {item.folder ? (
                <span className="life-desktop-shortcut-icon is-folder" data-drop-id={item.id}>
                  {/* ໄອຄອນນ້ອຍຂອງສະມາຊິກ 3×3 ຄືກຸ່ມໃນໂທລະສັບ */}
                  {membersOf(item.folder).slice(0, 9).map((member) => (
                    <span key={member.id} className={`life-desktop-shortcut-icon is-${member.tone}`} aria-hidden="true">
                      <i className={member.iconClass} />
                    </span>
                  ))}
                </span>
              ) : (
                renderIcon(menu!, item.id)
              )}
              <span>{item.folder ? folderName(item.folder) : menu!.name}</span>
            </button>
          );
        })}
      </nav>

      {openFolder && (
        <div
          className="life-desktop-folder-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenFolderId(null);
          }}
        >
          <section ref={folderPanelRef} className="life-desktop-folder" role="dialog" aria-label={folderName(openFolder)}>
            <input
              className="life-desktop-folder-name"
              value={openFolder.name}
              placeholder={t('desktopFolderUntitled')}
              aria-label={t('desktopFolderName')}
              maxLength={40}
              onChange={(event) => renameFolder(openFolder.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <div className="life-desktop-folder-apps">
              {membersOf(openFolder).map((menu, index) => {
                const isDragged = draggedId === menu.id;
                return (
                  <button
                    type="button"
                    key={menu.id}
                    autoFocus={index === 0}
                    className={`life-desktop-folder-app${isDragged ? ' is-dragging' : ''}${dropTargetId === menu.id ? ' is-drop-target' : ''}`}
                    style={isDragged && folderDragOffset
                      ? { transform: `translate(${folderDragOffset.x}px, ${folderDragOffset.y}px)` }
                      : undefined}
                    data-folder-slot={menu.id}
                    onClick={() => {
                      if (clickedAfterDrag()) return;
                      setOpenFolderId(null);
                      openShortcut(menu.id);
                    }}
                    onPointerDown={(event) => startDrag(event, menu.id, openFolder.id)}
                  >
                    {renderIcon(menu)}
                    <span>{menu.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="life-desktop-folder-hint">{t('desktopFolderHint')}</p>
          </section>
        </div>
      )}
    </>
  );
};

export default AccountDesktopMenu;
