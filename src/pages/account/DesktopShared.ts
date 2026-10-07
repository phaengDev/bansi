import { useEffect, useRef, useState } from 'react';
import type { AccountMenu } from './accountMenus';
import { useIsTablet } from '../../utils/hook/useMediaQuery';
import type { LangCode } from '../../context/LanguageContext';
import type { AppWindowHandle } from '../../components/Elements/AppWindow';

/**
 * Account-only color themes — deep, low-saturation "banking" palettes over a faint ledger grid
 * (see the `$account-themes` map in _life-desktop.scss). They deliberately don't reuse the Life
 * desktop's insurance themes (protect/family/health…) or its lifebuoy bloom rings.
 */
export type WallpaperColorId =
  | 'acc-ledger'
  | 'acc-navy'
  | 'acc-graphite'
  | 'acc-treasury'
  | 'acc-slate'
  | 'acc-bronze'
  | 'acc-burgundy'
  | 'acc-plum';
/** Accounting artwork only — the insurance photos (shield, family, umbrella…) stay with the Life desktop. */
export type WallpaperPhotoId = 'finance' | 'ledger' | 'rosette' | 'contour' | 'silk';
export type WallpaperId = WallpaperColorId | WallpaperPhotoId;

// More than fit the settings flyout at once on purpose — that swatch row scrolls sideways.
export const wallpaperColorIds: readonly WallpaperColorId[] = [
  'acc-ledger',
  'acc-navy',
  'acc-graphite',
  'acc-treasury',
  'acc-slate',
  'acc-bronze',
  'acc-burgundy',
  'acc-plum',
];
export const wallpaperPhotoIds: readonly WallpaperPhotoId[] = ['finance', 'ledger', 'rosette', 'contour', 'silk'];
export const wallpaperIds: readonly WallpaperId[] = [...wallpaperColorIds, ...wallpaperPhotoIds];

/** Two-stop preview for each color theme's swatch button — its base tone into its accent line color. */
export const wallpaperSwatches: Record<WallpaperColorId, [string, string]> = {
  'acc-ledger': ['#0d3b31', '#7fc8a4'],
  'acc-navy': ['#0f1f3f', '#d4b46a'],
  'acc-graphite': ['#1a1e24', '#9fb0c3'],
  'acc-treasury': ['#0a3339', '#6fd1cf'],
  'acc-slate': ['#1e2d3d', '#a9c1d9'],
  'acc-bronze': ['#3a2511', '#e2bd7a'],
  'acc-burgundy': ['#3a1019', '#e0a38a'],
  'acc-plum': ['#2b1a3f', '#c6a8e6'],
};

/** Dict key (src/i18n/lao-dict.ts) for each wallpaper's display name, for use with useT()/t(). */
export const wallpaperNameKeys: Record<WallpaperId, string> = {
  finance: 'accountWallpaperFinance',
  ledger: 'accountWallpaperLedger',
  rosette: 'accountWallpaperRosette',
  contour: 'accountWallpaperContour',
  silk: 'accountWallpaperSilk',
  'acc-ledger': 'accountThemeLedger',
  'acc-navy': 'accountThemeNavy',
  'acc-graphite': 'accountThemeGraphite',
  'acc-treasury': 'accountThemeTreasury',
  'acc-slate': 'accountThemeSlate',
  'acc-bronze': 'accountThemeBronze',
  'acc-burgundy': 'accountThemeBurgundy',
  'acc-plum': 'accountThemePlum',
};

/**
 * Thumbnail for each photo wallpaper's swatch button — the same image is also shown full-size on
 * the desktop (background-size: cover, see [data-wallpaper] in _life-desktop.scss).
 */
export const wallpaperPhotos: Record<WallpaperPhotoId, string> = {
  finance: '/assets/img/desktop/finance-wallpaper.svg',
  ledger: '/assets/img/desktop/ledger-wallpaper.svg',
  rosette: '/assets/img/desktop/rosette-wallpaper.svg',
  contour: '/assets/img/desktop/contour-wallpaper.svg',
  silk: '/assets/img/desktop/silk-wallpaper.svg',
};

// The previous fixed illustration stored only a chrome color under accountDesktopWallpaper.
// Actual background selections start with the finance illustration and persist independently.
const WALLPAPER_STORAGE_KEY = 'accountDesktopBackground';

/** Account theme preference, stored separately from the Life workspace. */
export const useWallpaper = () => {
  const [wallpaper, setWallpaper] = useState<WallpaperId>(() => {
    try {
      const stored = localStorage.getItem(WALLPAPER_STORAGE_KEY) as WallpaperId | null;
      if (stored && wallpaperIds.includes(stored)) return stored;
    } catch {
      // malformed/blocked storage — fall through to the default
    }
    return 'finance';
  });

  useEffect(() => {
    localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaper);

    // Overlay ຂອງ RSuite (Popover/Tooltip) ຖືກ render ຢູ່ <body> ນອກ .life-desktop ຈຶ່ງບໍ່ໄດ້ຮັບ
    // ຕົວແປ --app-chrome-* ຈາກມັນ — ຕິດ attribute ໄວ້ທີ່ <html> ນຳ ສີຈຶ່ງໄປເຖິງ (ເບິ່ງ _life-desktop.scss)
    document.documentElement.setAttribute('data-wallpaper', wallpaper);
    return () => document.documentElement.removeAttribute('data-wallpaper');
  }, [wallpaper]);

  return { wallpaper, setWallpaper };
};

export type ShortcutId =
  | 'journal'
  | 'chartOfAccounts'
  | 'generalLedger'
  | 'cashBank'
  | 'receivables'
  | 'payables'
  | 'trialBalance'
  | 'financialStatements'
  | 'budget'
  | 'hr'
  | 'calendar'
  | 'settings';

/** Dict key (src/i18n/lao-dict.ts) for each shortcut's display name, for use with useT()/t(). */
export const shortcutNameKeys: Record<ShortcutId, string> = {
  journal: 'accountAppJournal',
  chartOfAccounts: 'accountAppChartOfAccounts',
  generalLedger: 'accountAppGeneralLedger',
  cashBank: 'accountAppCashBank',
  receivables: 'accountAppReceivables',
  payables: 'accountAppPayables',
  trialBalance: 'accountAppTrialBalance',
  financialStatements: 'accountAppFinancialStatements',
  budget: 'accountAppBudget',
  hr: 'accountAppHr',
  calendar: 'calendar',
  settings: 'accountAppSettings',
};

/** Dict key for the one-line description shown in each module's window (and as its window subtitle). */
export const shortcutDescKeys: Partial<Record<ShortcutId, string>> = {
  journal: 'accountAppJournalDesc',
  chartOfAccounts: 'accountAppChartOfAccountsDesc',
  generalLedger: 'accountAppGeneralLedgerDesc',
  cashBank: 'accountAppCashBankDesc',
  receivables: 'accountAppReceivablesDesc',
  payables: 'accountAppPayablesDesc',
  trialBalance: 'accountAppTrialBalanceDesc',
  financialStatements: 'accountAppFinancialStatementsDesc',
  budget: 'accountAppBudgetDesc',
  hr: 'accountAppHrDesc',
  settings: 'accountAppSettingsDesc',
};

export const shortcuts: ReadonlyArray<{
  id: ShortcutId;
  icon: string;
  tone: string;
  path: string;
  /** true = opens as a floating <AppWindow> popup (with a taskbar entry); false/omitted = navigates to a full page. */
  popup?: boolean;
}> = [
  { id: 'journal', icon: 'fa-pen-to-square', tone: 'cyan', path: '/account/journal', popup: true },
  { id: 'chartOfAccounts', icon: 'fa-sitemap', tone: 'slate', path: '/account/chart', popup: true },
  { id: 'generalLedger', icon: 'fa-book', tone: 'emerald', path: '/account/ledger', popup: true },
  { id: 'cashBank', icon: 'fa-building-columns', tone: 'sky', path: '/account/cash-bank', popup: true },
  { id: 'receivables', icon: 'fa-hand-holding-dollar', tone: 'gold', path: '/account/receivable', popup: true },
  { id: 'payables', icon: 'fa-file-invoice-dollar', tone: 'coral', path: '/account/payable', popup: true },
  { id: 'trialBalance', icon: 'fa-scale-balanced', tone: 'violet', path: '/account/trial-balance', popup: true },
  { id: 'financialStatements', icon: 'fa-chart-pie', tone: 'emerald', path: '/account/statements', popup: true },
  { id: 'budget', icon: 'fa-bullseye', tone: 'gold', path: '/account/budget', popup: true },
  { id: 'hr', icon: 'fa-users-gear', tone: 'violet', path: '/hr', popup: true },
  { id: 'calendar', icon: 'fa-calendar-days', tone: 'coral', path: '/calendar', popup: true },
  { id: 'settings', icon: 'fa-gears', tone: 'slate', path: '/account/setting', popup: true },
];

export type Shortcut = (typeof shortcuts)[number];

export type ShortcutPosition = { x: number; y: number };

const ICON_POSITIONS_STORAGE_KEY = 'accountDesktopIconPositions';

/**
 * ຂະໜາດຂອງປຸ່ມລັດໜຶ່ງອັນ ແລະ ໄລຍະຫ່າງຂອງຕາໜ່າງທີ່ມັນເກາະ — ຕ້ອງກົງກັບ CSS ໃນ _life-desktop.scss
 * (pitch ເຜື່ອຊ່ອງວ່າງອ້ອມໄອຄອນໄວ້ເລັກໜ້ອຍ)
 */
export type IconGrid = { width: number; height: number; columnPitch: number; rowPitch: number };

/** ຈໍໃຫຍ່ */
const WIDE_GRID: IconGrid = { width: 112, height: 112, columnPitch: 120, rowPitch: 122 };
/** ຈໍນ້ອຍ (≤ 767.98px) — ໄອຄອນຫົດລົງຕາມ @media ໃນ _life-desktop.scss ຕາໜ່າງຈຶ່ງຕ້ອງຫົດນຳ */
const COMPACT_GRID: IconGrid = { width: 92, height: 98, columnPitch: 98, rowPitch: 104 };

/** ຂະໜາດຂອງພື້ນທີ່ວາງໄອຄອນ (nav.life-desktop-shortcuts) */
export type DesktopArea = { width: number; height: number };

/** ຄາດຄະເນພື້ນທີ່ໄວ້ກ່ອນ <DesktopMenu> ວັດແທ້ — ຫົວ ~56px + ແຖບໜ້າວຽກ 72px */
const estimateArea = (): DesktopArea => ({
  width: Math.max(0, window.innerWidth - 84),
  height: Math.max(0, window.innerHeight - 128),
});

/** ຈຳນວນຖັນທີ່ຢາກໃຫ້ເປັນ — ລຽງໃຫ້ຄົບ 2 ຖັນນີ້ກ່ອນ ຖ້າຄວາມສູງບໍ່ພໍຈຶ່ງລົ້ນເປັນຖັນທີ 3, 4 … ເອງ */
const DEFAULT_COLUMNS = 2;

/** ຈຳນວນແຖວທີ່ວາງໄດ້ໃນໜຶ່ງຖັນ ຕາມຄວາມສູງທີ່ມີແທ້ — ຢ່າງໜ້ອຍ 1 ແຖວສະເໝີ */
const rowsThatFit = (area: DesktopArea, grid: IconGrid) =>
  Math.max(1, Math.floor((area.height - grid.height) / grid.rowPitch) + 1);

/**
 * ແຖວຕໍ່ຖັນທີ່ຈະໃຊ້ແທ້: ແບ່ງໃຫ້ພໍດີ `DEFAULT_COLUMNS` ຖັນ ແຕ່ບໍ່ເກີນຄວາມສູງທີ່ມີ —
 * ປຸ່ມລັດໜ້ອຍ/ຈໍສູງ = ໄດ້ 2 ຖັນຕາມຕັ້ງໃຈ · ປຸ່ມລັດຫຼາຍ/ຈໍເຕັ້ຍ = ຕັດແຖວລົງ ແລ້ວຂຶ້ນຖັນໃໝ່ແທນ
 * ການລົ້ນອອກນອກຈໍ
 */
const rowsPerColumn = (area: DesktopArea, grid: IconGrid, total: number) =>
  Math.min(rowsThatFit(area, grid), Math.max(1, Math.ceil(total / DEFAULT_COLUMNS)));

type Cell = { col: number; row: number };

/**
 * ບ່ອນຢືນຕັ້ງຕົ້ນຂອງໄອຄອນທີ່ຍັງບໍ່ເຄີຍຖືກລາກ — ລຽງລົງທາງລຸ່ມກ່ອນ (ຄືເດັສທັອບທົ່ວໄປ):
 * ເພີ່ມປຸ່ມລັດໃໝ່ມັນຈະໄປຕໍ່ທ້າຍຖັນເກົ່າ ແລະ ຂຶ້ນຖັນໃໝ່ທາງຂວາເມື່ອສຸດແຖວຂອງຖັນນັ້ນ.
 */
const getDefaultPosition = (index: number, area: DesktopArea, grid: IconGrid): ShortcutPosition => {
  const rows = rowsPerColumn(area, grid, shortcuts.length);
  return {
    x: Math.floor(index / rows) * grid.columnPitch,
    y: (index % rows) * grid.rowPitch,
  };
};

const toCell = ({ x, y }: ShortcutPosition, grid: IconGrid): Cell => ({
  col: Math.round(x / grid.columnPitch),
  row: Math.round(y / grid.rowPitch),
});

const toPosition = ({ col, row }: Cell, grid: IconGrid): ShortcutPosition => ({
  x: col * grid.columnPitch,
  y: row * grid.rowPitch,
});

const sameCell = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;

/**
 * The free cell closest to `wanted`, searched in rings outwards so a dropped icon settles right next
 * to where it was let go rather than jumping across the desktop. Falls back to `wanted` only if the
 * whole desktop is full.
 */
const findFreeCell = (wanted: Cell, taken: Cell[], maxColumn: number, maxRow: number): Cell => {
  const clampCell = ({ col, row }: Cell): Cell => ({
    col: Math.min(maxColumn, Math.max(0, col)),
    row: Math.min(maxRow, Math.max(0, row)),
  });
  const isFree = (cell: Cell) => !taken.some((other) => sameCell(other, cell));

  const start = clampCell(wanted);
  if (isFree(start)) return start;

  for (let radius = 1; radius <= maxColumn + maxRow + 1; radius += 1) {
    for (let col = start.col - radius; col <= start.col + radius; col += 1) {
      for (let row = start.row - radius; row <= start.row + radius; row += 1) {
        // Only the ring at exactly this distance — the inner ones were checked on earlier passes.
        if (Math.max(Math.abs(col - start.col), Math.abs(row - start.row)) !== radius) continue;
        if (col < 0 || row < 0 || col > maxColumn || row > maxRow) continue;
        if (isFree({ col, row })) return { col, row };
      }
    }
  }
  return start;
};

const readStoredPositions = (): Partial<Record<ShortcutId, ShortcutPosition>> => {
  try {
    const stored = localStorage.getItem(ICON_POSITIONS_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Partial<Record<ShortcutId, ShortcutPosition>>;
  } catch {
    // malformed/blocked storage — fall through to defaults
  }
  return {};
};

/**
 * Drag-anywhere positions for the desktop icons — an icon follows the pointer freely while dragging,
 * then snaps onto the grid when dropped, taking the nearest free cell if that spot is already used so
 * two icons can never end up stacked on top of each other. Positions are per-browser (localStorage),
 * so they stick across visits; an icon that has never been dragged sits at its default grid spot.
 *
 * ຕາໜ່າງປັບຕາມໜ້າຈໍເອງ: <DesktopMenu> ວັດພື້ນທີ່ແທ້ສົ່ງເຂົ້າ `setArea()` (ResizeObserver) ແລ້ວ
 * ໄອຄອນທີ່ຍັງບໍ່ເຄີຍລາກຈະລຽງລົງທາງລຸ່ມ ແລະ ຂຶ້ນຖັນໃໝ່ເມື່ອສຸດຄວາມສູງ — ເພີ່ມປຸ່ມລັດຫຼາຍເທົ່າໃດ
 * ກໍ່ບໍ່ລົ້ນອອກນອກຈໍ ແລະ ຈໍນ້ອຍກໍ່ໃຊ້ຕາໜ່າງແຄບລົງໃຫ້ກົງກັບຂະໜາດໄອຄອນໃນ CSS.
 */
export const useShortcutPositions = () => {
  const [positions, setPositions] = useState<Partial<Record<ShortcutId, ShortcutPosition>>>(readStoredPositions);
  /** ພື້ນທີ່ວາງໄອຄອນ — ຄາດຄະເນໄວ້ກ່ອນ ແລ້ວ <DesktopMenu> ວັດແທ້ສົ່ງມາທັບຕອນ mount/ປ່ຽນຂະໜາດ */
  const [area, setArea] = useState<DesktopArea>(estimateArea);
  const grid = useIsTablet() ? COMPACT_GRID : WIDE_GRID;

  useEffect(() => {
    localStorage.setItem(ICON_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  }, [positions]);

  /**
   * ຫຍໍ້ຈໍລົງ (ຫຼື ສະຫຼັບໄປຕາໜ່າງແຄບ) — ດຶງໄອຄອນທີ່ລາກໄວ້ກັບເຂົ້າມາໃນຂອບ ບໍ່ໃຫ້ຫາຍອອກນອກຈໍ.
   * ຄືນ `current` ອັນເກົ່າເມື່ອບໍ່ມີອັນໃດຍ້າຍ — React ຈຶ່ງບໍ່ render ຊ້ຳຈົນວົນ
   */
  useEffect(() => {
    if (!area.width || !area.height) return;
    const maxX = Math.max(0, area.width - grid.width);
    const maxY = Math.max(0, area.height - grid.height);

    setPositions((current) => {
      let moved = false;
      const next: Partial<Record<ShortcutId, ShortcutPosition>> = {};
      (Object.keys(current) as ShortcutId[]).forEach((id) => {
        const position = current[id]!;
        const clamped = { x: Math.min(maxX, position.x), y: Math.min(maxY, position.y) };
        if (clamped.x !== position.x || clamped.y !== position.y) moved = true;
        next[id] = clamped;
      });
      return moved ? next : current;
    });
  }, [area, grid]);

  const getPosition = (id: ShortcutId, index: number): ShortcutPosition =>
    positions[id] ?? getDefaultPosition(index, area, grid);

  const setPosition = (id: ShortcutId, position: ShortcutPosition) => {
    setPositions((current) => ({ ...current, [id]: position }));
  };

  /**
   * Called once the icon is let go: snaps it onto the grid, and pushes it out to the nearest free
   * cell if it was dropped on top of another icon. ໃຊ້ພື້ນທີ່ທີ່ວັດໄວ້ລ່າສຸດ ຊ່ອງທີ່ເກາະຈຶ່ງບໍ່ຕົກນອກຈໍ.
   */
  const dropPosition = (id: ShortcutId) => {
    const maxColumn = Math.max(0, Math.floor((area.width - grid.width) / grid.columnPitch));
    const maxRow = Math.max(0, Math.floor((area.height - grid.height) / grid.rowPitch));

    setPositions((current) => {
      const droppedIndex = shortcuts.findIndex((shortcut) => shortcut.id === id);
      const dropped = current[id] ?? getDefaultPosition(droppedIndex, area, grid);
      const taken = shortcuts
        .map((shortcut, index) => ({ shortcut, index }))
        .filter(({ shortcut }) => shortcut.id !== id)
        .map(({ shortcut, index }) =>
          toCell(current[shortcut.id] ?? getDefaultPosition(index, area, grid), grid));

      return {
        ...current,
        [id]: toPosition(findFreeCell(toCell(dropped, grid), taken, maxColumn, maxRow), grid),
      };
    });
  };

  /** "Arrange icons" — snaps every icon back to the default tidy grid. */
  const resetPositions = () => setPositions({});

  return { getPosition, setPosition, dropPosition, resetPositions, setArea, grid };
};

export const localeByLanguage: Record<LangCode, string> = {
  la: 'lo-LA',
  en: 'en-GB',
  cn: 'zh-CN',
};

export const langLabels: Record<LangCode, string> = { la: 'ລາວ', en: 'ENG', cn: '中文' };

/** Local orchestration for one <AppWindow> popup's open/minimized state + taskbar toggling. */
export const usePopupWindow = () => {
  const windowRef = useRef<AppWindowHandle>(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const show = () => {
    setOpen(true);
    windowRef.current?.restore();
  };

  const toggleFromTaskbar = () => {
    if (minimized) {
      windowRef.current?.restore();
    } else {
      windowRef.current?.minimize();
    }
  };

  return { windowRef, open, setOpen, minimized, setMinimized, show, toggleFromTaskbar };
};

/** What DesktopMenu (and any other `life/*` page) reads via useOutletContext() from <LifeShell>. */
export type LifeOutletContext = {
  /** Launch a shortcut by id — opens its popup, or navigates to its page, whichever it's configured for. */
  openShortcut: (id: ShortcutId) => void;
  /** Shared with the Desktop Settings "Arrange icons" action, so both read/write the same live state. */
  iconPositions: ReturnType<typeof useShortcutPositions>;
  /** ເມນູບັນຊີຈາກ GET /menu/main (ລຳດັບ, ຊື່, ໄອຄອນ, ລັອກ) — desktop ສະແດງຕາມນີ້ */
  menus: AccountMenu[];
  /** ຈຳນວນໜ້າຕ່າງທີ່ເປີດຢູ່ — ຫຼຸດລົງ (ປິດໜ້າຕ່າງ) = ພາບລວມໃນ desktop ໂຫຼດໃໝ່ */
  openWindows: number;
};
