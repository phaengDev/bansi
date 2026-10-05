import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useLanguage, useT, type LangCode } from '../../context/LanguageContext';
import { Notific } from '../../utils/Notification';
import AppWindow from '../../components/Elements/AppWindow';
import DesktopSettings from './DesktopSettings';
import CalendarPage from '../calendar';
// Same lunar engine the full calendar page uses, so the flyout can't drift out of step with it.
import { getLaoLunarDate, type LaoLunarDate } from '../calendar/laoLunarCalendar';
import AppPage from '../../components/Elements/AppPage';
import AccountModule from './AccountModule';
import AccountSettingPage from './setting/AccountSettingPage';
import TreasuryAccountPage from './ledger/TreasuryAccountPage';
import GeneralLedgerPage from './gl/GeneralLedgerPage';
import JournalPage from './journal/JournalPage';
import FinancialStatementsPage from './statements/FinancialStatementsPage';
import ChartOfAccountsPage from './gl/ChartOfAccountsPage';
import TrialBalancePage from './gl/TrialBalancePage';
import ArApWindow from './arap/ArApWindow';
import MenuUnlockModal from './MenuUnlockModal';
import MenuContextMenu from './MenuContextMenu';
import { MenuLockForm, type MenuLockMode } from './setting/MenuLockPage';
import { refreshAccountMenus, useAccountMenus } from './accountMenus';
import {
  langLabels,
  localeByLanguage,
  shortcutDescKeys,
  shortcutNameKeys,
  shortcuts,
  usePopupWindow,
  useShortcutPositions,
  useWallpaper,
  type LifeOutletContext,
  type ShortcutId,
} from './DesktopShared';

/**
 * ໂມດູນທີ່ມີໜ້າແທ້ແລ້ວ — ອັນທີ່ບໍ່ມີໃນນີ້ຂຶ້ນ <AccountModule> (ກຳລັງພັດທະນາ). ຊື່ ແລະ ຄຳອະທິບາຍຢູ່ຫົວ
 * <AppWindow> ແລ້ວ ຈຶ່ງເຊື່ອງຫົວຂອງ <AppPage>.
 */
const MODULE_PAGES: Partial<Record<ShortcutId, React.ReactNode>> = {
  journal: <JournalPage />,
  generalLedger: <GeneralLedgerPage />,
  cashBank: <AppPage showHeader={false}><TreasuryAccountPage /></AppPage>,
  financialStatements: <FinancialStatementsPage />,
  chartOfAccounts: <ChartOfAccountsPage />,
  trialBalance: <TrialBalancePage />,
  receivables: <ArApWindow kind={1} />,
  payables: <ArApWindow kind={2} />,
};

/**
 * The persistent chrome around every `/account/*` page — taskbar (start button, running popups, pinned
 * links, language switcher, clock), one <AppWindow> popup per accounting module, and the Start menu. Renders whichever
 * page is active (DesktopMenu, ExampleRegister, …) full-bleed via <Outlet> above the taskbar, so
 * popups and the taskbar stay put no matter which "app" is open.
 */
const AccountShell: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const t = useT();
  const navigate = useNavigate();
  const desktopRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [startOpen, setStartOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [clockPanelOpen, setClockPanelOpen] = useState(false);
  // The flyout's own little month grid: closed until the date is clicked, and the month it is showing.
  const [clockCalendarOpen, setClockCalendarOpen] = useState(false);
  const [clockMonth, setClockMonth] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [taskbarPinned, setTaskbarPinned] = useState<boolean>(
    () => (localStorage.getItem('accountTaskbarPinned') ?? localStorage.getItem('lifeTaskbarPinned')) !== 'false',
  );
  const [taskbarRevealed, setTaskbarRevealed] = useState(false);
  const taskbarVisible = taskbarPinned || taskbarRevealed;
  const userName = localStorage.getItem('user_name');
  const iconPositions = useShortcutPositions();
  const { wallpaper, setWallpaper } = useWallpaper();
  /** ເມນູບັນຊີຈາກ GET /menu/main (ລຳດັບ, ຊື່, ໄອຄອນ, ລັອກ) — ຍັງບໍ່ມີກໍ່ໃຊ້ shortcuts ຂອງໜ້າເວັບ */
  const menus = useAccountMenus();
  const menuOf = (id: ShortcutId) => menus.find((menu) => menu.id === id);
  const menuName = (id: ShortcutId) => menuOf(id)?.name ?? t(shortcutNameKeys[id]);
  /** ເມນູທີ່ກຳລັງຖາມລະຫັດຜ່ານ (null = ບໍ່ມີ) */
  const [unlocking, setUnlocking] = useState<ShortcutId | null>(null);
  /** ເມນູຄລິກຂວາໃນ Start menu (ຕຳແໜ່ງ + ລາຍການ) ແລະ ຟອມລະຫັດຜ່ານທີ່ເປີດຈາກມັນ */
  const [contextMenu, setContextMenu] = useState<{ id: ShortcutId; x: number; y: number } | null>(null);
  const [lockForm, setLockForm] = useState<{ id: ShortcutId; mode: MenuLockMode } | null>(null);
  const journalWindow = usePopupWindow();
  const chartWindow = usePopupWindow();
  const ledgerWindow = usePopupWindow();
  const cashBankWindow = usePopupWindow();
  const receivablesWindow = usePopupWindow();
  const payablesWindow = usePopupWindow();
  const trialBalanceWindow = usePopupWindow();
  const statementsWindow = usePopupWindow();
  const calendarWindow = usePopupWindow();
  const settingsWindow = usePopupWindow();
  const popupWindows: Partial<Record<ShortcutId, ReturnType<typeof usePopupWindow>>> = {
    journal: journalWindow,
    chartOfAccounts: chartWindow,
    generalLedger: ledgerWindow,
    cashBank: cashBankWindow,
    receivables: receivablesWindow,
    payables: payablesWindow,
    trialBalance: trialBalanceWindow,
    financialStatements: statementsWindow,
    calendar: calendarWindow,
    settings: settingsWindow,
  };
  // Shared minimize/maximize/restore/close labels for every <AppWindow> popup in this shell.
  const windowLabels = {
    minimize: t('lifeWindowMinimize'),
    maximize: t('lifeWindowMaximize'),
    restore: t('lifeWindowRestore'),
    close: t('close'),
  };

  const handleLogout = () => {
    Notific.confirm('logoutConfirm', () => {
      // ເກັບພາສາທີ່ເລືອກໄວ້ — clear() ລຶບ token, ສິດ ແລະ ຂໍ້ມູນຜູ້ໃຊ້ທັງໝົດ
      const savedLang = localStorage.getItem('lang');
      localStorage.clear();
      if (savedLang) localStorage.setItem('lang', savedLang);
      window.location.href = '/login';
    });
  };

  const showShortcut = (id: ShortcutId) => {
    const popup = popupWindows[id];
    if (popup) {
      popup.show();
      return;
    }
    const shortcut = shortcuts.find((item) => item.id === id);
    if (shortcut) navigate(shortcut.path);
  };

  // ເມນູທີ່ຕັ້ງລະຫັດໄວ້ (ໜ້າ ຕັ້ງຄ່າບັນຊີ → ລະຫັດຜ່ານເມນູ) ຖາມລະຫັດທຸກເທື່ອທີ່ເປີດໃໝ່;
  // ໜ້າຕ່າງທີ່ເປີດຢູ່ແລ້ວ (ລວມທັງຫຍໍ້ລົງ taskbar) ບໍ່ຖາມຊ້ຳ — ປິດໜ້າຕ່າງແລ້ວຈຶ່ງລັອກຄືນ
  const openShortcut = (id: ShortcutId) => {
    setStartOpen(false);
    if (menuOf(id)?.locked && !popupWindows[id]?.open) {
      setUnlocking(id);
      return;
    }
    showShortcut(id);
  };

  useEffect(() => {
    refreshAccountMenus();
  }, []);

  useEffect(() => {
    localStorage.setItem('accountTaskbarPinned', String(taskbarPinned));
    if (taskbarPinned) setTaskbarRevealed(false);
  }, [taskbarPinned]);

  // The tray only shows hours/minutes, so 30s is plenty — but the flyout puts a big clock on screen,
  // so while it's open tick every second (and refresh straight away) to keep it honest.
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), clockPanelOpen ? 1_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [clockPanelOpen]);

  // Closing the flyout folds the month grid away and forgets whatever month was being browsed, so it
  // always comes back showing today.
  useEffect(() => {
    if (clockPanelOpen) return;
    setClockCalendarOpen(false);
    setClockMonth(new Date());
  }, [clockPanelOpen]);

  useEffect(() => {
    const closeOnClickAway = (event: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
      if (clockRef.current && !clockRef.current.contains(event.target as Node)) {
        setClockPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnClickAway);
    return () => document.removeEventListener('mousedown', closeOnClickAway);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStartOpen(false);
        setLangMenuOpen(false);
        setUserMenuOpen(false);
        setSettingsMenuOpen(false);
        setClockPanelOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMenus = normalizedQuery
    ? menus.filter((menu) => menu.name.toLocaleLowerCase().includes(normalizedQuery))
    : menus;

  const locale = localeByLanguage[lang];
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  // ງວດບັນຊີປັດຈຸບັນ (MM/YYYY) ສະແດງໃຕ້ຊື່ຜູ້ໃຊ້
  const period = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  // Spelled out for the clock flyout, where there is room for the full thing.
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now);
  const longDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  // ----- the flyout's month grid -------------------------------------------------------------
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const shiftClockMonth = (months: number) =>
    setClockMonth((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));

  const clockMonthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(clockMonth);

  // Weeks run Monday→Sunday like the full calendar app, so seed the labels from a known Monday.
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)),
  );

  // Always six rows, so the panel doesn't change height as the months are flipped through.
  const clockMonthDays = (() => {
    const firstOfMonth = new Date(clockMonth.getFullYear(), clockMonth.getMonth(), 1);
    const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(clockMonth.getFullYear(), clockMonth.getMonth(), 1 - mondayOffset + index);
      return { day, lunar: getLaoLunarDate(day) };
    });
  })();

  const todayLunar = getLaoLunarDate(now);
  const phaseLabel = (phase: 'waxing' | 'waning') => t(phase === 'waxing' ? 'lunarWaxing' : 'lunarWaning');
  const phaseLabelShort = (phase: 'waxing' | 'waning') =>
    t(phase === 'waxing' ? 'lunarWaxingShort' : 'lunarWaningShort');
  // "ຫຼັງ" in the engine's own label is Lao-only, so rebuild it from the dict for the other languages.
  const lunarMonthLabel = (lunar: LaoLunarDate) =>
    lunar.isSecondEighthMonth ? `8 ${t('lunarSecondEighth')}` : String(lunar.month);
  const lunarSummary = (lunar: LaoLunarDate) =>
    `${phaseLabel(lunar.phase)} ${lunar.phaseDay} ${t('lunarNightUnit')} · ${t('lunarMonthShort')} ${lunarMonthLabel(lunar)}`;

  const openWindows = Object.values(popupWindows).filter((popup) => popup?.open).length;
  const outletContext: LifeOutletContext = { openShortcut, iconPositions, menus, openWindows };

  return (
    <main
      ref={desktopRef}
      className={`life-desktop ${!taskbarVisible ? 'is-taskbar-hidden' : ''}`}
      data-wallpaper={wallpaper}
      onClick={() => {
        setStartOpen(false);
        setLangMenuOpen(false);
      }}
    >
      <div className="life-desktop-wallpaper" aria-hidden="true">
        <div className="life-desktop-glow" />
        <div className="life-desktop-bloom life-desktop-bloom--back" />
        <div className="life-desktop-bloom life-desktop-bloom--middle" />
        <div className="life-desktop-bloom life-desktop-bloom--front" />
      </div>
      <div className={`life-desktop-stage ${!taskbarVisible ? 'is-full' : ''}`}>
        <Outlet context={outletContext} />
      </div>

      <div className="life-desktop-toolbar">
        <div className="life-desktop-brand" ref={brandRef}>
          <button
            type="button"
            className="life-desktop-brand-trigger"
            aria-label={t('accountWorkspaceTitle')}
            aria-expanded={userMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setUserMenuOpen((open) => !open);
            }}
          >
            <span className="life-desktop-brand-logo">
              <img src="/assets/img/logo/plc2.png" alt="PL Lao Development" />
            </span>
            <span>
              <strong>{userName || 'PLC'}</strong>
              <small><i className="fa-solid fa-calculator" /> {t('accountWorkspaceTitle')} · {t('accountFiscalPeriod')} {period}</small>
            </span>
          </button>

          {userMenuOpen && (
            <div className="life-desktop-brand-menu" onClick={(event) => event.stopPropagation()}>
              <div className="life-desktop-brand-menu-user">
                <img src="/assets/img/user.webp" alt="" />
                <span>{userName}</span>
              </div>
              <button
                type="button"
                className="life-desktop-brand-menu-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  openShortcut('settings');
                }}
              >
                <i className="fa-solid fa-gear" aria-hidden="true" /> {t('settings')}
              </button>
              <button type="button" className="life-desktop-brand-menu-item is-danger" onClick={handleLogout}>
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> {t('logOut')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ໜຶ່ງໂມດູນບັນຊີ = ໜຶ່ງໜ້າຕ່າງ — ຕາຕະລາງບັນຊີກວ້າງ ຈຶ່ງເປີດເຕັມຈໍໄວ້ກ່ອນ (ຍົກເວັ້ນປະຕິທິນ ແລະ ຕັ້ງຄ່າ) */}
      {shortcuts.map((shortcut) => {
        const popup = popupWindows[shortcut.id];
        if (!popup) return null;
        const isCalendar = shortcut.id === 'calendar';
        // ຕັ້ງຄ່າ ແລະ ປະຕິທິນ ເປີດເປັນໜ້າຕ່າງຂະໜາດປົກກະຕິ — ຜູ້ໃຊ້ຂະຫຍາຍເຕັມຈໍເອງໄດ້
        const isSettings = shortcut.id === 'settings';
        const descKey = shortcutDescKeys[shortcut.id];
        return (
          <AppWindow
            key={shortcut.id}
            ref={popup.windowRef}
            open={popup.open}
            onClose={() => popup.setOpen(false)}
            onMinimizedChange={popup.setMinimized}
            desktopRef={desktopRef}
            ariaLabel={menuName(shortcut.id)}
            icon={shortcut.icon}
            title={menuName(shortcut.id)}
            subtitle={descKey ? t(descKey) : undefined}
            width={isCalendar ? 1040 : isSettings ? 900 : 1140}
            height={isCalendar ? 700 : isSettings ? 610 : 720}
            defaultMaximized={!isCalendar && !isSettings}
            labels={windowLabels}
          >
            {isCalendar ? (
              <CalendarPage />
            ) : isSettings ? (
              <AccountSettingPage
                title={t(shortcutNameKeys.settings)}
                onClose={() => popup.setOpen(false)}
              />
            ) : (
              MODULE_PAGES[shortcut.id] ?? <AccountModule id={shortcut.id} />
            )}
          </AppWindow>
        );
      })}

      {unlocking && menuOf(unlocking) && (
        <MenuUnlockModal
          menu={menuOf(unlocking)!}
          onClose={() => setUnlocking(null)}
          onUnlocked={() => {
            setUnlocking(null);
            showShortcut(unlocking);
          }}
        />
      )}

      {contextMenu && menuOf(contextMenu.id) && (
        <MenuContextMenu
          menu={menuOf(contextMenu.id)!}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            setContextMenu(null);
            openShortcut(contextMenu.id);
          }}
          onLock={(mode) => {
            setContextMenu(null);
            setStartOpen(false);
            setLockForm({ id: contextMenu.id, mode });
          }}
        />
      )}

      {lockForm && menuOf(lockForm.id) && (
        <MenuLockForm menu={menuOf(lockForm.id)!} mode={lockForm.mode} onClose={() => setLockForm(null)} />
      )}

      {startOpen && (
        <section
          className="life-start"
          aria-label={t('lifePinnedApps')}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="life-start-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('lifeSearchApps')}
              aria-label={t('lifeSearchApps')}
            />
          </div>

          <div className="life-start-heading">
            <strong>{t('lifePinnedApps')}</strong>
            <button type="button" onClick={() => setStartOpen(false)} aria-label={t('close')}>
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>

          {filteredMenus.length > 0 ? (
            <div className="life-start-apps">
              {filteredMenus.map((menu) => (
                <button
                  type="button"
                  key={menu.id}
                  className={contextMenu?.id === menu.id ? 'is-context' : ''}
                  onClick={() => openShortcut(menu.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ id: menu.id, x: event.clientX, y: event.clientY });
                  }}
                >
                  <span className={`life-desktop-shortcut-icon is-${menu.tone}`}>
                    <i className={menu.iconClass} aria-hidden="true" />
                    {menu.locked && (
                      <em className="life-desktop-shortcut-lock" title={t('menuLockLocked')}>
                        <i className="fa-solid fa-lock" aria-hidden="true" />
                      </em>
                    )}
                  </span>
                  <span>{menu.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="life-start-empty">
              <i className="fa-regular fa-folder-open" aria-hidden="true" />
              <span>{t('lifeNoMatchingApps')}</span>
            </div>
          )}

          <div className="life-start-footer">
            <img src="/assets/img/logo/plc2.png" alt="" />
            <span>
              <strong>PL Lao Development</strong>
              <small>{t('accountWorkspaceTitle')}</small>
            </span>
          </div>
        </section>
      )}

      {!taskbarPinned && (
        <div
          className="life-taskbar-trigger"
          onMouseEnter={() => setTaskbarRevealed(true)}
          aria-hidden="true"
        />
      )}

      <footer
        className={`life-taskbar ${!taskbarVisible ? 'is-hidden' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onMouseLeave={() => {
          if (!taskbarPinned) setTaskbarRevealed(false);
        }}
      >
        <div className="life-taskbar-left">
          <div className="life-taskbar-settings" ref={settingsRef}>
          <button
            type="button"
            className={`life-taskbar-settings-btn ${settingsMenuOpen ? 'is-active' : ''}`}
            aria-label={t('lifeSettingsTitle')}
            aria-haspopup="menu"
            aria-expanded={settingsMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setStartOpen(false);
              setSettingsMenuOpen((open) => !open);
            }}
          >
            <i className="fa-solid fa-sliders" aria-hidden="true" />
          </button>

          {settingsMenuOpen && (
            <div className="settings-menu" onClick={(event) => event.stopPropagation()}>
              <div className="settings-menu-heading">{t('lifeSettingsTitle')}</div>
              <DesktopSettings
                taskbarPinned={taskbarPinned}
                onToggleTaskbarPinned={setTaskbarPinned}
                onArrangeIcons={iconPositions.resetPositions}
                wallpaper={wallpaper}
                onSelectWallpaper={setWallpaper}
              />
            </div>
          )}
          </div>
        </div>

        <div className="life-taskbar-apps is-center">
          <button
            type="button"
            className={startOpen ? 'is-active' : ''}
            onClick={() => setStartOpen((open) => !open)}
            title={t('lifeOpenMenu')}
            aria-label={t('lifeOpenMenu')}
            aria-expanded={startOpen}
          >
            <span className="life-taskbar-start" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          </button>
          {shortcuts
            .filter((shortcut) => popupWindows[shortcut.id]?.open)
            .map((shortcut) => {
              const popup = popupWindows[shortcut.id]!;
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  className={`life-taskbar-running-app ${popup.minimized ? '' : 'is-active'}`}
                  onClick={() => {
                    setStartOpen(false);
                    popup.toggleFromTaskbar();
                  }}
                  title={menuName(shortcut.id)}
                  aria-label={menuName(shortcut.id)}
                >
                  <i className={menuOf(shortcut.id)?.iconClass ?? `fa-solid ${shortcut.icon}`} aria-hidden="true" />
                </button>
              );
            })}
        </div>

        <div className="life-taskbar-tray" aria-label={`${time}, ${date}`}>
          <span className="life-taskbar-status" aria-hidden="true">
            <i className="fa-solid fa-wifi" />
            <i className="fa-solid fa-volume-high" />
          </span>
          <div className="life-taskbar-lang">
            <button
              type="button"
              className={langMenuOpen ? 'is-active' : ''}
              onClick={(event) => {
                event.stopPropagation();
                setLangMenuOpen((open) => !open);
              }}
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
            >
              {langLabels[lang]}
            </button>
            {langMenuOpen && (
              <div className="life-taskbar-lang-menu" role="listbox">
                {(Object.keys(langLabels) as LangCode[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={code === lang}
                    className={code === lang ? 'is-selected' : ''}
                    onClick={() => {
                      setLang(code);
                      setLangMenuOpen(false);
                    }}
                  >
                    {langLabels[code]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="life-taskbar-clock" ref={clockRef}>
            <button
              type="button"
              className={`life-taskbar-clock-trigger ${clockPanelOpen ? 'is-active' : ''}`}
              aria-label={t('lifeClockPanel')}
              aria-haspopup="dialog"
              aria-expanded={clockPanelOpen}
              onClick={(event) => {
                event.stopPropagation();
                setStartOpen(false);
                setLangMenuOpen(false);
                setSettingsMenuOpen(false);
                setClockPanelOpen((open) => !open);
              }}
            >
              <strong>{time}</strong>
              <small>{date}</small>
            </button>

            {clockPanelOpen && (
              <div
                className="life-clock-panel"
                role="dialog"
                aria-label={t('lifeClockPanel')}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="life-clock-panel-time">{time}</div>
                <div className="life-clock-panel-weekday">{weekday}</div>
                <div className="life-clock-panel-lunar">
                  {lunarSummary(todayLunar)}
                  {todayLunar.isWanPhra && (
                    <strong>
                      <img src="/assets/img/calendar/wan-phra-buddha.png" alt="" aria-hidden="true" />
                      {t('wanPhra')}
                    </strong>
                  )}
                </div>

                <button
                  type="button"
                  className={`life-clock-panel-date ${clockCalendarOpen ? 'is-open' : ''}`}
                  aria-expanded={clockCalendarOpen}
                  onClick={() => setClockCalendarOpen((open) => !open)}
                >
                  <span>
                    <strong>{longDate}</strong>
                    <small>{t('lifeOpenCalendar')}</small>
                  </span>
                  <i
                    className={`fa-solid ${clockCalendarOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}
                    aria-hidden="true"
                  />
                </button>

                {clockCalendarOpen && (
                  <div className="life-clock-calendar">
                    <div className="life-clock-calendar-head">
                      <button
                        type="button"
                        aria-label={t('lifePreviousMonth')}
                        onClick={() => shiftClockMonth(-1)}
                      >
                        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                      </button>
                      <strong>{clockMonthLabel}</strong>
                      <button
                        type="button"
                        aria-label={t('lifeNextMonth')}
                        onClick={() => shiftClockMonth(1)}
                      >
                        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="life-clock-calendar-grid">
                      {weekdayLabels.map((label) => (
                        <span key={label} className="life-clock-calendar-weekday">{label}</span>
                      ))}
                      {clockMonthDays.map(({ day, lunar }) => (
                        <span
                          key={day.toDateString()}
                          className={
                            'life-clock-calendar-day' +
                            (day.getMonth() === clockMonth.getMonth() ? '' : ' is-outside') +
                            (isSameDay(day, now) ? ' is-today' : '') +
                            (lunar.isWanPhra ? ' is-wan-phra' : '')
                          }
                          title={
                            lunarSummary(lunar) + (lunar.isWanPhra ? ` · ${t('wanPhra')}` : '')
                          }
                        >
                          <em>
                            {day.getDate()}
                            {lunar.isWanPhra && (
                              <img
                                src="/assets/img/calendar/wan-phra-buddha.png"
                                alt=""
                                aria-hidden="true"
                              />
                            )}
                          </em>
                          <small>{phaseLabelShort(lunar.phase)} {lunar.phaseDay}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
};

export default AccountShell;
