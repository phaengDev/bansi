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
  | 'attendance'
  | 'payroll'
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
  attendance: 'accountAppAttendance',
  payroll: 'accountAppPayroll',
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
  attendance: 'accountAppAttendanceDesc',
  payroll: 'accountAppPayrollDesc',
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
  { id: 'attendance', icon: 'fa-user-clock', tone: 'sky', path: '/hr/attendance', popup: true },
  { id: 'payroll', icon: 'fa-money-check-dollar', tone: 'emerald', path: '/hr/payroll', popup: true },
  { id: 'calendar', icon: 'fa-calendar-days', tone: 'coral', path: '/calendar', popup: true },
  { id: 'settings', icon: 'fa-gears', tone: 'slate', path: '/account/setting', popup: true },
];

export type Shortcut = (typeof shortcuts)[number];

export type ShortcutPosition = { x: number; y: number };

/**
 * ກຸ່ມໄອຄອນ (ຄື folder ໃນໜ້າຫຼັກຂອງໂທລະສັບ) — ລາກປຸ່ມລັດໜຶ່ງໄປທັບອີກອັນຈຶ່ງເກີດ ແລະ ຍຸບເອງເມື່ອເຫຼືອ
 * ອັນດຽວ. ຊື່ຫວ່າງ = ສະແດງ "ກຸ່ມບໍ່ມີຊື່" ຕາມພາສາທີ່ເລືອກຢູ່
 */
export type DesktopFolder = { id: string; name: string; items: ShortcutId[] };

/** ສິ່ງໜຶ່ງເທິງ desktop: ປຸ່ມລັດ (id = ShortcutId) ຫຼື ກຸ່ມ (ມີ `folder` — items ສະເພາະເມນູທີ່ຜູ້ໃຊ້ເຫັນ) */
export type DesktopItem = { id: string; folder?: DesktopFolder; position: ShortcutPosition };

const ICON_POSITIONS_STORAGE_KEY = 'accountDesktopIconPositions';
const FOLDERS_STORAGE_KEY = 'accountDesktopFolders';
const FOLDER_ID_PREFIX = 'folder-';

export const isFolderId = (id: string) => id.startsWith(FOLDER_ID_PREFIX);

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
 * `total` = ຈຳນວນສິ່ງເທິງ desktop (ກຸ່ມນັບເປັນອັນດຽວ)
 */
const getDefaultPosition = (index: number, total: number, area: DesktopArea, grid: IconGrid): ShortcutPosition => {
  const rows = rowsPerColumn(area, grid, total);
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

/** ຕຳແໜ່ງທີ່ປັກໄວ້ແລ້ວ ຕາມ id (ປຸ່ມລັດ ຫຼື ກຸ່ມ) — ອັນທີ່ບໍ່ມີໃນນີ້ຢູ່ບ່ອນຕັ້ງຕົ້ນ */
type Positions = Record<string, ShortcutPosition>;

/** ຕຳແໜ່ງ ແລະ ກຸ່ມຢູ່ state ດຽວກັນ — ສ້າງ/ຍຸບກຸ່ມຈຶ່ງປ່ຽນທັງສອງພ້ອມກັນໃນເທື່ອດຽວ */
type DesktopLayout = { positions: Positions; folders: DesktopFolder[] };

const readStoredPositions = (): Positions => {
  try {
    const stored = localStorage.getItem(ICON_POSITIONS_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Positions;
  } catch {
    // malformed/blocked storage — fall through to defaults
  }
  return {};
};

/** ກຸ່ມທີ່ບັນທຶກໄວ້ — ຂ້າມເມນູທີ່ບໍ່ມີແລ້ວ ຫຼື ຢູ່ຊ້ຳສອງກຸ່ມ, ກຸ່ມທີ່ເຫຼືອບໍ່ເຖິງ 2 ອັນຖືກຍຸບ */
const readStoredFolders = (): DesktopFolder[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) ?? '[]') as DesktopFolder[];
    const used = new Set<ShortcutId>();
    return stored.flatMap((folder) => {
      const items = folder.items.filter((id) => shortcuts.some((shortcut) => shortcut.id === id) && !used.has(id));
      if (!isFolderId(String(folder.id)) || items.length < 2) return [];
      items.forEach((id) => used.add(id));
      return [{ id: folder.id, name: String(folder.name ?? ''), items }];
    });
  } catch {
    return [];
  }
};

const withoutPositions = (positions: Positions, ...ids: string[]): Positions =>
  Object.fromEntries(Object.entries(positions).filter(([id]) => !ids.includes(id)));

/**
 * ສິ່ງທີ່ຢູ່ເທິງ desktop ຕາມລຳດັບເມນູ — ກຸ່ມຢູ່ບ່ອນຂອງສະມາຊິກທຳອິດ. ເມນູທີ່ຜູ້ໃຊ້ບໍ່ເຫັນ (ບໍ່ມີໃນ
 * `menuIds`) ບໍ່ສະແດງ ແຕ່ຍັງຢູ່ໃນກຸ່ມທີ່ບັນທຶກໄວ້
 */
const listItems = (menuIds: ShortcutId[], folders: DesktopFolder[]): Omit<DesktopItem, 'position'>[] => {
  const placed = new Set<string>();
  return menuIds.flatMap<Omit<DesktopItem, 'position'>>((id) => {
    const folder = folders.find((item) => item.items.includes(id));
    if (!folder) return [{ id }];
    if (placed.has(folder.id)) return [];
    placed.add(folder.id);
    return [{ id: folder.id, folder: { ...folder, items: folder.items.filter((member) => menuIds.includes(member)) } }];
  });
};

/**
 * Drag-anywhere desktop icons and folders — an icon follows the pointer freely while dragging, then
 * snaps onto the grid when dropped, taking the nearest free cell if that spot is already used so two
 * icons can never end up stacked on top of each other. Dropping a shortcut right onto another icon
 * groups them into a folder instead (like a phone's home screen). Positions and folders are
 * per-browser (localStorage), so they stick across visits; anything never dragged sits at its default
 * grid spot.
 *
 * ຕາໜ່າງປັບຕາມໜ້າຈໍເອງ: <DesktopMenu> ວັດພື້ນທີ່ແທ້ສົ່ງເຂົ້າ `setArea()` (ResizeObserver) ແລ້ວ
 * ໄອຄອນທີ່ຍັງບໍ່ເຄີຍລາກຈະລຽງລົງທາງລຸ່ມ ແລະ ຂຶ້ນຖັນໃໝ່ເມື່ອສຸດຄວາມສູງ — ເພີ່ມປຸ່ມລັດຫຼາຍເທົ່າໃດ
 * ກໍ່ບໍ່ລົ້ນອອກນອກຈໍ ແລະ ຈໍນ້ອຍກໍ່ໃຊ້ຕາໜ່າງແຄບລົງໃຫ້ກົງກັບຂະໜາດໄອຄອນໃນ CSS.
 *
 * `menuIds` = ເມນູທີ່ຜູ້ໃຊ້ເຫັນ ຕາມລຳດັບຂອງ backend (useAccountMenus)
 */
export const useDesktopLayout = (menuIds: ShortcutId[]) => {
  const [layout, setLayout] = useState<DesktopLayout>(() => ({
    positions: readStoredPositions(),
    folders: readStoredFolders(),
  }));
  /** ພື້ນທີ່ວາງໄອຄອນ — ຄາດຄະເນໄວ້ກ່ອນ ແລ້ວ <DesktopMenu> ວັດແທ້ສົ່ງມາທັບຕອນ mount/ປ່ຽນຂະໜາດ */
  const [area, setArea] = useState<DesktopArea>(estimateArea);
  const grid = useIsTablet() ? COMPACT_GRID : WIDE_GRID;

  useEffect(() => {
    localStorage.setItem(ICON_POSITIONS_STORAGE_KEY, JSON.stringify(layout.positions));
  }, [layout.positions]);

  useEffect(() => {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(layout.folders));
  }, [layout.folders]);

  /**
   * ຫຍໍ້ຈໍລົງ (ຫຼື ສະຫຼັບໄປຕາໜ່າງແຄບ) — ດຶງໄອຄອນທີ່ລາກໄວ້ກັບເຂົ້າມາໃນຂອບ ບໍ່ໃຫ້ຫາຍອອກນອກຈໍ.
   * ຄືນ `current` ອັນເກົ່າເມື່ອບໍ່ມີອັນໃດຍ້າຍ — React ຈຶ່ງບໍ່ render ຊ້ຳຈົນວົນ
   */
  useEffect(() => {
    if (!area.width || !area.height) return;
    const maxX = Math.max(0, area.width - grid.width);
    const maxY = Math.max(0, area.height - grid.height);

    setLayout((current) => {
      let moved = false;
      const next: Positions = {};
      Object.entries(current.positions).forEach(([id, position]) => {
        const clamped = { x: Math.min(maxX, position.x), y: Math.min(maxY, position.y) };
        if (clamped.x !== position.x || clamped.y !== position.y) moved = true;
        next[id] = clamped;
      });
      return moved ? { ...current, positions: next } : current;
    });
  }, [area, grid]);

  const placeItems = ({ positions, folders }: DesktopLayout): DesktopItem[] => {
    const list = listItems(menuIds, folders);
    return list.map((item, index) => ({
      ...item,
      position: positions[item.id] ?? getDefaultPosition(index, list.length, area, grid),
    }));
  };

  /**
   * ປັກຕຳແໜ່ງຂອງທຸກອັນທີ່ເຫັນຢູ່ໄວ້ກ່ອນສ້າງ/ຍຸບກຸ່ມ — ຈຳນວນສິ່ງເທິງ desktop ປ່ຽນ ບ່ອນຕັ້ງຕົ້ນກໍ່ປ່ຽນ,
   * ຖ້າບໍ່ປັກໄວ້ ໄອຄອນທີ່ບໍ່ກ່ຽວຂ້ອງຈະເລື່ອນໜີຈາກບ່ອນເກົ່າ
   */
  const pinAll = (current: DesktopLayout): Positions => ({
    ...current.positions,
    ...Object.fromEntries(placeItems(current).map((item) => [item.id, item.position])),
  });

  const setPosition = (id: string, position: ShortcutPosition) => {
    setLayout((current) => ({ ...current, positions: { ...current.positions, [id]: position } }));
  };

  /**
   * ປ່ອຍສິ່ງທີ່ລາກ: ປຸ່ມລັດທັບປຸ່ມລັດອື່ນ = ສ້າງກຸ່ມໃໝ່ຢູ່ບ່ອນຂອງອັນທີ່ຖືກທັບ, ທັບກຸ່ມ = ເຂົ້າກຸ່ມນັ້ນ,
   * ບໍ່ທັບຫຍັງ = ເກາະຊ່ອງຕາໜ່າງທີ່ຫວ່າງໃກ້ທີ່ສຸດ. ກຸ່ມບໍ່ຊ້ອນເຂົ້າໃນກຸ່ມອື່ນ — ລາກກຸ່ມໄດ້ແຕ່ຍ້າຍບ່ອນ
   * ໃຊ້ພື້ນທີ່ທີ່ວັດໄວ້ລ່າສຸດ ຊ່ອງທີ່ເກາະຈຶ່ງບໍ່ຕົກນອກຈໍ.
   */
  const dropItem = (id: string, targetId: string | null) => {
    const maxColumn = Math.max(0, Math.floor((area.width - grid.width) / grid.columnPitch));
    const maxRow = Math.max(0, Math.floor((area.height - grid.height) / grid.rowPitch));
    const newFolderId = `${FOLDER_ID_PREFIX}${Date.now()}`;

    setLayout((current) => {
      const placed = placeItems(current);
      const target = targetId && !isFolderId(id) ? placed.find((item) => item.id === targetId) : undefined;

      if (!target) {
        const dropped = placed.find((item) => item.id === id);
        if (!dropped) return current;
        const taken = placed.filter((item) => item.id !== id).map((item) => toCell(item.position, grid));
        const cell = findFreeCell(toCell(dropped.position, grid), taken, maxColumn, maxRow);
        return { ...current, positions: { ...current.positions, [id]: toPosition(cell, grid) } };
      }

      // ອັນທີ່ລາກລົງໄປຢູ່ໃນກຸ່ມແລ້ວ ບໍ່ມີບ່ອນເທິງ desktop ອີກ
      const positions = withoutPositions(pinAll(current), id);
      const dropped = id as ShortcutId;

      if (target.folder) {
        return {
          positions,
          folders: current.folders.map((folder) =>
            (folder.id === target.id ? { ...folder, items: [...folder.items, dropped] } : folder)),
        };
      }

      return {
        positions: { ...withoutPositions(positions, target.id), [newFolderId]: positions[target.id] },
        folders: [...current.folders, { id: newFolderId, name: '', items: [target.id as ShortcutId, dropped] }],
      };
    });
  };

  /**
   * ລາກໄອຄອນອອກນອກກອບກຸ່ມ: ອອກມາຢູ່ເທິງ desktop ທີ່ `position`. ກຸ່ມທີ່ເຫຼືອອັນດຽວຖືກຍຸບ —
   * ອັນທີ່ເຫຼືອຢູ່ບ່ອນຂອງກຸ່ມແທນ (ຄືໂທລະສັບ)
   */
  const pullFromFolder = (folderId: string, id: ShortcutId, position: ShortcutPosition) => {
    setLayout((current) => {
      const folder = current.folders.find((item) => item.id === folderId);
      if (!folder) return current;
      const positions = { ...pinAll(current), [id]: position };
      const remaining = folder.items.filter((member) => member !== id);

      if (remaining.length > 1) {
        return {
          positions,
          folders: current.folders.map((item) => (item.id === folderId ? { ...item, items: remaining } : item)),
        };
      }

      return {
        positions: {
          ...withoutPositions(positions, folderId),
          ...(remaining.length ? { [remaining[0]]: positions[folderId] } : {}),
        },
        folders: current.folders.filter((item) => item.id !== folderId),
      };
    });
  };

  /** ລາກສະລັບລຳດັບພາຍໃນກຸ່ມ — `id` ຍ້າຍໄປຢູ່ບ່ອນຂອງ `targetId` */
  const moveInFolder = (folderId: string, id: ShortcutId, targetId: ShortcutId) => {
    setLayout((current) => ({
      ...current,
      folders: current.folders.map((folder) => {
        if (folder.id !== folderId || !folder.items.includes(targetId)) return folder;
        const items = folder.items.filter((member) => member !== id);
        items.splice(folder.items.indexOf(targetId), 0, id);
        return { ...folder, items };
      }),
    }));
  };

  const renameFolder = (folderId: string, name: string) => {
    setLayout((current) => ({
      ...current,
      folders: current.folders.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)),
    }));
  };

  /** "Arrange icons" — snaps every icon and folder back to the default tidy grid (folders are kept). */
  const resetPositions = () => setLayout((current) => ({ ...current, positions: {} }));

  return {
    items: placeItems(layout),
    setPosition,
    dropItem,
    pullFromFolder,
    moveInFolder,
    renameFolder,
    resetPositions,
    setArea,
    grid,
  };
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
  desktopLayout: ReturnType<typeof useDesktopLayout>;
  /** ເມນູບັນຊີຈາກ GET /menu/main (ລຳດັບ, ຊື່, ໄອຄອນ, ລັອກ) — desktop ສະແດງຕາມນີ້ */
  menus: AccountMenu[];
  /** ຈຳນວນໜ້າຕ່າງທີ່ເປີດຢູ່ — ຫຼຸດລົງ (ປິດໜ້າຕ່າງ) = ພາບລວມໃນ desktop ໂຫຼດໃໝ່ */
  openWindows: number;
};
