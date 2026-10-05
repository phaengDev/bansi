import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import type { AccountMenu } from './accountMenus';
import type { MenuLockMode } from './setting/MenuLockPage';

type Props = {
  menu: AccountMenu;
  /** ຈຸດທີ່ຄລິກຂວາ (clientX/clientY) — ເມນູຍັບເຂົ້າໃນຈໍເອງຖ້າລົ້ນ */
  x: number;
  y: number;
  onOpen: () => void;
  onLock: (mode: MenuLockMode) => void;
  onClose: () => void;
};

/**
 * ເມນູຄລິກຂວາຂອງລາຍການໃນ Start menu — ເປີດ + ຕັ້ງ/ປ່ຽນ/ຍົກເລີກ ລະຫັດຜ່ານເມນູ.
 * ປິດເມື່ອຄລິກບ່ອນອື່ນ, ກົດ Esc, ປ່ຽນຂະໜາດຈໍ ຫຼື ສະຫຼັບໜ້າຕ່າງ
 */
const MenuContextMenu = ({ menu, x, y, onOpen, onLock, onClose }: Props) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // ວັດຂະໜາດແທ້ກ່ອນ paint ແລ້ວຍັບເຂົ້າ — ຄລິກໃກ້ຂອບຂວາ/ລຸ່ມ ເມນູບໍ່ລົ້ນຈໍ
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerAway);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onPointerAway);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="life-context-menu"
      role="menu"
      aria-label={menu.name}
      style={{ left: pos.left, top: pos.top }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="life-context-menu-head">
        <span className={`life-desktop-shortcut-icon is-${menu.tone}`}>
          <i className={menu.iconClass} aria-hidden="true" />
        </span>
        <b>{menu.name}</b>
        {menu.locked && <em><i className="fa-solid fa-lock" aria-hidden="true" /> {t('menuLockLocked')}</em>}
      </div>

      <button type="button" role="menuitem" autoFocus onClick={onOpen}>
        <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> {t('menuLockOpenMenu')}
      </button>

      <hr />

      {!menu.lockable ? (
        <span className="life-context-menu-note">
          <i className="fa-solid fa-circle-info" aria-hidden="true" /> {t('menuLockNotAllowed')}
        </span>
      ) : menu.locked ? (
        <>
          <button type="button" role="menuitem" disabled={!canEdit} onClick={() => onLock('change')}>
            <i className="fa-solid fa-key" aria-hidden="true" /> {t('menuLockChange')}
          </button>
          <button type="button" role="menuitem" className="is-danger" disabled={!canEdit} onClick={() => onLock('remove')}>
            <i className="fa-solid fa-lock-open" aria-hidden="true" /> {t('menuLockRemove')}
          </button>
        </>
      ) : (
        <button type="button" role="menuitem" disabled={!canEdit} onClick={() => onLock('set')}>
          <i className="fa-solid fa-lock" aria-hidden="true" /> {t('menuLockSet')}
        </button>
      )}
    </div>
  );
};

export default MenuContextMenu;
