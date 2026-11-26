import { useEffect, useRef, useState } from 'react';
import { putApi } from '../../utils/configApi';
import { useT } from '../../context/LanguageContext';
import { useMyEmployee, type AccountMenu } from '../account/accountMenus';
import type { ShortcutId } from '../account/DesktopShared';
import { fullName } from '../hr/hrApi';
import { HrAvatar } from '../hr/hrKit';
import { dismissArrived, markReadLocally, pendingApprovals, refreshMyInbox, unreadNotifications, useMyInbox } from './meInbox';
import { openMyPage } from './meNav';
import { NotificationItem, newestFirst, openNotification } from './myNotificationKit';

/** ແຈ້ງເຕືອນລ່າສຸດທີ່ສະແດງໃນກ່ອງ (ທີ່ເຫຼືອ = ເບິ່ງທັງໝົດ) */
const PREVIEW = 5;
/** ສັ່ນກະດິ່ງເມື່ອມີແຈ້ງເຕືອນໃໝ່ເຂົ້າມາ (ms) */
const RING_MS = 4000;
/** ຟອງແຈ້ງເຕືອນໃໝ່ຄ້າງໄວ້ (ms) — ຊີ້ເມົ້າໃສ່ = ຄ້າງຕໍ່ */
const BUBBLE_MS = 8000;

const countText = (n: number) => (n > 99 ? '99+' : String(n));

/**
 * "ຂອງຂ້ອຍ" ໃນ taskbar (ແທນກອບເທິງ desktop) — ປຸ່ມມີຕົວເລກສີແດງ = ລໍຂ້ອຍອະນຸມັດ + ແຈ້ງເຕືອນທີ່ຍັງບໍ່ອ່ານ,
 * ສັ່ນເມື່ອມີແຈ້ງເຕືອນໃໝ່ເຂົ້າມາ ແລະ ຟອງບອກຫົວຂໍ້ຂຶ້ນເທິງປຸ່ມ (ມາທັນທີຜ່ານ stream). ກົດ = ກ່ອງຂຶ້ນ: ຫົວ (ຮູບ + ຊື່), ໜ້າຕ່າງຂອງຂ້ອຍ (ພ້ອມຕົວເລກ), ລໍອະນຸມັດ,
 * ແຈ້ງເຕືອນລ່າສຸດ (ກົດ = ອ່ານແລ້ວ + ເປີດໜ້າທີ່ກ່ຽວຂ້ອງ). ຂໍ້ມູນມາຈາກ meInbox ອັນດຽວກັບໜ້າຕ່າງ (ບໍ່ໂຫຼດຊ້ຳ)
 */
const MySpaceTray = ({ menus, onOpenMenu, openIds }: {
  /** ເມນູຂອງຂ້ອຍທີ່ບັນຊີນີ້ໃຊ້ໄດ້ (ລຳດັບ = MY_WINDOWS) */
  menus: AccountMenu[];
  onOpenMenu: (id: ShortcutId) => void;
  /** ໜ້າຕ່າງທີ່ເປີດຢູ່ — ຂີດລຸ່ມປຸ່ມ */
  openIds: ShortcutId[];
}) => {
  const t = useT();
  const me = useMyEmployee();
  const inbox = useMyInbox(!!me);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const approvals = pendingApprovals(inbox);
  const unread = unreadNotifications(inbox);
  const total = approvals + unread;

  // ແຈ້ງເຕືອນໃໝ່ເຂົ້າມາ (ຕົວເລກເພີ່ມຂຶ້ນຫຼັງໂຫຼດຄັ້ງທຳອິດ) → ສັ່ນກະດິ່ງ
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!inbox.loaded) return undefined;
    const before = seen.current;
    seen.current = unread;
    if (before === null || unread <= before) return undefined;
    setRinging(true);
    const timer = window.setTimeout(() => setRinging(false), RING_MS);
    return () => window.clearTimeout(timer);
  }, [inbox.loaded, unread]);

  // ຟອງແຈ້ງເຕືອນທີ່ຫາກໍ່ມາ — ປິດເອງຫຼັງ BUBBLE_MS (ເປີດກ່ອງຢູ່ = ບໍ່ສະແດງ, ເຫັນໃນລາຍການແລ້ວ)
  const arrived = inbox.arrived;
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (!arrived || hovering) return undefined;
    const timer = window.setTimeout(dismissArrived, BUBBLE_MS);
    return () => window.clearTimeout(timer);
  }, [arrived, hovering]);
  useEffect(() => {
    if (open) dismissArrived();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    refreshMyInbox();
    const away = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!me || !menus.length) return null;

  const badgeOf = (id: ShortcutId) => (id === 'myTeam' ? approvals : id === 'myInbox' ? unread : 0);
  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const hasInbox = menus.some((m) => m.id === 'myInbox');
  const latest = newestFirst(inbox.notifications?.data ?? []).slice(0, PREVIEW);
  const readAll = () => {
    markReadLocally();
    putApi('/notification/me/read', {}).catch(() => undefined).finally(() => refreshMyInbox());
  };
  const label = total ? `${t('myMenuGroup')} · ${countText(total)}` : t('myMenuGroup');

  return (
    <div className="life-me-tray" ref={ref}>
      <button
        type="button"
        className={`life-taskbar-tray-app life-me-trigger${open ? ' is-active' : ''}${openIds.length ? ' is-open' : ''}${ringing ? ' is-ringing' : ''}`}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <i className="fa-solid fa-house-user" aria-hidden="true" />
        {total > 0 && <em className="life-me-count">{countText(total)}</em>}
      </button>

      {arrived && !open && (
        <div className="life-me-bubble my-page" role="status" aria-live="polite" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
          <NotificationItem n={arrived} time="HH:mm" onClick={() => {
            dismissArrived();
            openNotification(arrived, (key, intent) => openMyPage(key, intent));
          }}
          />
          <button type="button" className="life-me-bubble-close" aria-label={t('close')} title={t('close')} onClick={dismissArrived}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      )}

      {open && (
        <div className="life-me-panel" role="dialog" aria-label={t('myMenuGroup')} onClick={(event) => event.stopPropagation()}>
          <header className="life-me-head">
            <HrAvatar url={me.profile_url} name={me.first_name} size="md" />
            <span>
              <small>{t('myHello')}</small>
              <b>{fullName(me)}</b>
              <em>{[me.emp_code, me.position?.position_name].filter(Boolean).join(' · ')}</em>
            </span>
          </header>

          <nav className="life-me-apps" aria-label={t('myMenuGroup')}>
            {menus.map((menu) => {
              const count = badgeOf(menu.id);
              return (
                <button key={menu.id} type="button" className={openIds.includes(menu.id) ? 'is-open' : ''} onClick={() => go(() => onOpenMenu(menu.id))}>
                  <span className={`life-desktop-shortcut-icon is-${menu.tone}`}>
                    <i className={menu.iconClass} aria-hidden="true" />
                    {count > 0 && <em className="life-desktop-shortcut-badge">{countText(count)}</em>}
                  </span>
                  <span>{menu.name}</span>
                </button>
              );
            })}
          </nav>

          {approvals > 0 && (
            <button type="button" className="life-me-alert" onClick={() => go(() => openMyPage('approvals'))}>
              <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
              <span>{t('myTodayApprovals').replace('{n}', String(approvals))}</span>
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          )}

          {hasInbox && (
            <section className="life-me-feed">
              <header>
                <b><i className="fa-solid fa-bell" aria-hidden="true" /> {t('myNotifications')}{unread > 0 && <em>{countText(unread)}</em>}</b>
                {unread > 0 && <button type="button" onClick={readAll}><i className="fa-solid fa-check-double" aria-hidden="true" /> {t('myReadAll')}</button>}
              </header>
              {!latest.length ? (
                <p className="life-me-empty"><i className="fa-regular fa-bell-slash" aria-hidden="true" /> {t(inbox.loaded ? 'myNoNotifications' : 'loadingDots')}</p>
              ) : (
                <div className="my-page">
                  <ul className="my-notifications">
                    {latest.map((n) => (
                      <li key={n._uuid}>
                        <NotificationItem n={n} time="DD/MM HH:mm" onClick={() => go(() => openNotification(n, (key, intent) => openMyPage(key, intent)))} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button type="button" className="life-me-all" onClick={() => go(() => openMyPage('notifications'))}>
                {t('mySeeAllNotifications')} <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MySpaceTray;
