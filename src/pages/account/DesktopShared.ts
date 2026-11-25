import { useEffect, useRef, useState } from 'react';
import type { AccountMenu } from './accountMenus';
import { useIsTablet } from '../../utils/hook/useMediaQuery';
import { type LangCode } from '../../context/LanguageContext';
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
  | 'fixedAssets'
  | 'closing'
  | 'employees'
  | 'tasks'
  | 'hr'
  | 'attendance'
  | 'payroll'
  | 'calendar'
  | 'myWork'
  | 'myPay'
  | 'myTasks'
  | 'myTeam'
  | 'myInbox'
  | 'settings'
  | 'platform';

/** Dict key (src/i18n/lao-dict.ts) for each shortcut's display name, for use with useT()/t(). */
export const shortcutNameKeys: Record<ShortcutId, string> = {
  fixedAssets: 'accountAppFixedAssets',
  closing: 'accountAppClosing',
  journal: 'accountAppJournal',
  chartOfAccounts: 'accountAppChartOfAccounts',
  generalLedger: 'accountAppGeneralLedger',
  cashBank: 'accountAppCashBank',
  receivables: 'accountAppReceivables',
  payables: 'accountAppPayables',
  trialBalance: 'accountAppTrialBalance',
  financialStatements: 'accountAppFinancialStatements',
  budget: 'accountAppBudget',
  employees: 'accountAppEmployees',
  tasks: 'accountAppTasks',
  hr: 'accountAppHr',
  attendance: 'accountAppAttendance',
  payroll: 'accountAppPayroll',
  calendar: 'calendar',
  myWork: 'accountAppMyWork',
  myPay: 'accountAppMyPay',
  myTasks: 'accountAppMyTasks',
  myTeam: 'accountAppMyTeam',
  myInbox: 'accountAppMyInbox',
  settings: 'accountAppSettings',
  platform: 'accountAppPlatform',
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
  fixedAssets: 'accountAppFixedAssetsDesc',
  closing: 'accountAppClosingDesc',
  employees: 'accountAppEmployeesDesc',
  tasks: 'accountAppTasksDesc',
  hr: 'accountAppHrDesc',
  attendance: 'accountAppAttendanceDesc',
  payroll: 'accountAppPayrollDesc',
  myWork: 'accountAppMyWorkDesc',
  myPay: 'accountAppMyPayDesc',
  myTasks: 'accountAppMyTasksDesc',
  myTeam: 'accountAppMyTeamDesc',
  myInbox: 'accountAppMyInboxDesc',
  settings: 'accountAppSettingsDesc',
  platform: 'accountAppPlatformDesc',
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
  { id: 'fixedAssets', icon: 'fa-building', tone: 'gold', path: '/account/fixed-assets', popup: true },
  { id: 'closing', icon: 'fa-clipboard-check', tone: 'violet', path: '/account/closing', popup: true },
  { id: 'employees', icon: 'fa-id-card', tone: 'cyan', path: '/hr/employees', popup: true },
  { id: 'tasks', icon: 'fa-list-check', tone: 'sky', path: '/hr/tasks', popup: true },
  { id: 'hr', icon: 'fa-users-gear', tone: 'violet', path: '/hr', popup: true },
  { id: 'attendance', icon: 'fa-user-clock', tone: 'sky', path: '/hr/attendance', popup: true },
  { id: 'payroll', icon: 'fa-money-check-dollar', tone: 'emerald', path: '/hr/payroll', popup: true },
  { id: 'calendar', icon: 'fa-calendar-days', tone: 'coral', path: '/calendar', popup: true },
  // ຂອງຂ້ອຍ (/me/…) — ບໍ່ຢູ່ໃນ tbl_main_menu: ຂຶ້ນເອງສະເພາະຜູ້ໃຊ້ທີ່ຜູກກັບພະນັກງານ (useAccountMenus); ສ່ວນທີ່ຕໍ່ເນື່ອງກັນຢູ່ເມນູດຽວ
  { id: 'myWork', icon: 'fa-house-user', tone: 'emerald', path: '/me/work', popup: true },
  { id: 'myPay', icon: 'fa-wallet', tone: 'gold', path: '/me/pay', popup: true },
  { id: 'myTasks', icon: 'fa-list-check', tone: 'sky', path: '/me/tasks', popup: true },
  { id: 'myTeam', icon: 'fa-people-group', tone: 'violet', path: '/me/team', popup: true },
  { id: 'myInbox', icon: 'fa-bell', tone: 'coral', path: '/me/inbox', popup: true },
  { id: 'settings', icon: 'fa-gears', tone: 'slate', path: '/account/setting', popup: true },
  // ຈັດການບໍລິສັດ / ແພັກເກດ — ບໍ່ຢູ່ໃນ tbl_main_menu: ຂຶ້ນສະເພາະເຈົ້າຂອງລະບົບ (GET /platform/me, useAccountMenus)
  { id: 'platform', icon: 'fa-building-shield', tone: 'violet', path: '/platform', popup: true },
];

export type Shortcut = (typeof shortcuts)[number];

/** ເມນູທີ່ບໍ່ຢູ່ເທິງ desktop — ເປີດຈາກປຸ່ມໃນ taskbar ທາງຂວາ (ຂ້າງ wifi) ແລະ Start menu */
export const TRAY_APPS: ShortcutId[] = ['calendar'];

export type ShortcutPosition = { x: number; y: number };

/**
 * ກຸ່ມຂອງເມນູ (ຕາມ path) — ໃຊ້ຮ່ວມກັນທັງກອບເທິງ desktop ແລະ ຟອມສິດເຂົ້າເມນູ (ຕິກທັງກຸ່ມ, UserPage).
 * ລຳດັບໃນນີ້ = ລຳດັບຂອງກອບຈາກຊ້າຍໄປຂວາ
 */
export const MENU_GROUPS = [
  { key: 'account', label: 'hrMenuGroupAccount', icon: 'fa-calculator', match: (path: string) => path.startsWith('/account/') },
  { key: 'hr', label: 'hrMenuGroupHr', icon: 'fa-people-group', match: (path: string) => path === '/hr' || path.startsWith('/hr/') },
  { key: 'me', label: 'myMenuGroup', icon: 'fa-house-user', match: (path: string) => path === '/me' || path.startsWith('/me/') },
  { key: 'other', label: 'hrMenuGroupOther', icon: 'fa-shapes', match: () => true },
] as const;
export type MenuGroupKey = (typeof MENU_GROUPS)[number]['key'];
export const menuGroupOf = (path: string): MenuGroupKey => MENU_GROUPS.find((group) => group.match(path))!.key;
const groupOfShortcut = (id: ShortcutId) => menuGroupOf(shortcuts.find((shortcut) => shortcut.id === id)?.path ?? '');
const isGroupKey = (value: unknown): value is MenuGroupKey => MENU_GROUPS.some((group) => group.key === value);

/**
 * ກຸ່ມໄອຄອນ (ຄື folder ໃນໜ້າຫຼັກຂອງໂທລະສັບ) — ລາກປຸ່ມລັດໜຶ່ງໄປທັບອີກອັນຈຶ່ງເກີດ ແລະ ຍຸບເອງເມື່ອເຫຼືອ
 * ອັນດຽວ. ຊື່ຫວ່າງ = ສະແດງ "ກຸ່ມບໍ່ມີຊື່" ຕາມພາສາທີ່ເລືອກຢູ່. section = ກອບທີ່ກຸ່ມຢູ່ (ກອບຂອງອັນທີ່ຖືກທັບ)
 */
export type DesktopFolder = { id: string; name: string; items: ShortcutId[]; section?: MenuGroupKey };

/** ສິ່ງໜຶ່ງເທິງ desktop: ປຸ່ມລັດ (id = ShortcutId) ຫຼື ກຸ່ມ (ມີ `folder` — items ສະເພາະເມນູທີ່ຜູ້ໃຊ້ເຫັນ) */
export type DesktopItem = { id: string; folder?: DesktopFolder; section: MenuGroupKey; position: ShortcutPosition };

/** ກອບຂອງກຸ່ມເມນູເທິງ desktop (px ໃນພື້ນທີ່ວາງໄອຄອນ) — ກອບແກ້ວລ້ວນ ບໍ່ມີແຖບຊື່ */
export type DesktopSection = {
  key: MenuGroupKey;
  cols: number;
  rows: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** ຊ່ອງຂອງໄອຄອນພາຍໃນກອບຂອງມັນເອງ (ຖັນ/ແຖວ) — ກອບຍ້າຍບ່ອນ ໄອຄອນກໍ່ຍ້າຍຕາມ */
const CELLS_STORAGE_KEY = 'accountDesktopSectionCells';
/** ຕຳແໜ່ງ px ແບບເກົ່າ (ກ່ອນມີກອບ) — ບໍ່ໃຊ້ແລ້ວ, ລຶບອອກຕອນເປີດໜ້າ */
const LEGACY_POSITIONS_STORAGE_KEY = 'accountDesktopIconPositions';
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

/** ກອບ: ຂອບໃນ (pad), ໄລຍະລະຫວ່າງກອບ (gap) — px, ຕ້ອງກົງກັບ .life-desktop-section ໃນ _life-desktop.scss (ບໍ່ມີແຖບຊື່) */
const FRAME = { pad: 6, gap: 16 };

/** ຂະໜາດຂອງພື້ນທີ່ວາງໄອຄອນ (nav.life-desktop-shortcuts) */
export type DesktopArea = { width: number; height: number };

/** ຄາດຄະເນພື້ນທີ່ໄວ້ກ່ອນ <DesktopMenu> ວັດແທ້ — ຫົວ ~56px + ແຖບໜ້າວຽກ 72px */
const estimateArea = (): DesktopArea => ({
  width: Math.max(0, window.innerWidth - 84),
  height: Math.max(0, window.innerHeight - 128),
});

type Cell = { col: number; row: number };

const sameCell = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;

/** ຈຳນວນແຖວສູງສຸດຂອງກອບ ຕາມຄວາມສູງທີ່ມີແທ້ (ຫັກແຖບຊື່ ແລະ ຂອບໃນ) — ຢ່າງໜ້ອຍ 1 ແຖວ */
const fitRows = (area: DesktopArea, grid: IconGrid) =>
  Math.max(1, Math.floor((area.height - FRAME.pad * 2 - grid.height) / grid.rowPitch) + 1);

const frameWidth = (cols: number, grid: IconGrid) => FRAME.pad * 2 + (cols - 1) * grid.columnPitch + grid.width;
const frameHeight = (rows: number, grid: IconGrid) => FRAME.pad * 2 + (rows - 1) * grid.rowPitch + grid.height;

/**
 * The free cell closest to `wanted`, searched in rings outwards so a dropped icon settles right next
 * to where it was let go rather than jumping across its frame. Falls back to `wanted` only if the
 * whole frame is full.
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

/** ຊ່ອງທີ່ປັກໄວ້ແລ້ວ ຕາມ id (ປຸ່ມລັດ ຫຼື ກຸ່ມ) — ອັນທີ່ບໍ່ມີໃນນີ້ ລຽງຕາມລຳດັບເມນູ */
type Cells = Record<string, Cell>;

/** ຊ່ອງ ແລະ ກຸ່ມຢູ່ state ດຽວກັນ — ສ້າງ/ຍຸບກຸ່ມຈຶ່ງປ່ຽນທັງສອງພ້ອມກັນ. drag = ໄອຄອນທີ່ກຳລັງລາກ (ບໍ່ບັນທຶກ) */
type DesktopLayout = { cells: Cells; folders: DesktopFolder[]; drag: { id: string; position: ShortcutPosition } | null };

const readStoredCells = (): Cells => {
  try {
    localStorage.removeItem(LEGACY_POSITIONS_STORAGE_KEY);
    const stored = JSON.parse(localStorage.getItem(CELLS_STORAGE_KEY) ?? '{}') as Cells;
    return Object.fromEntries(Object.entries(stored).filter(([, cell]) =>
      Number.isInteger(cell?.col) && Number.isInteger(cell?.row) && cell.col >= 0 && cell.row >= 0));
  } catch {
    // malformed/blocked storage — fall through to defaults
    return {};
  }
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
      return [{ id: folder.id, name: String(folder.name ?? ''), items, ...(isGroupKey(folder.section) ? { section: folder.section } : {}) }];
    });
  } catch {
    return [];
  }
};

const withoutCells = (cells: Cells, ...ids: string[]): Cells =>
  Object.fromEntries(Object.entries(cells).filter(([id]) => !ids.includes(id)));

/**
 * ສິ່ງທີ່ຢູ່ເທິງ desktop ຕາມລຳດັບເມນູ — ກຸ່ມຢູ່ບ່ອນຂອງສະມາຊິກທຳອິດ ແລະ ຢູ່ໃນກອບທີ່ສ້າງມັນ.
 * ເມນູທີ່ຜູ້ໃຊ້ບໍ່ເຫັນ (ບໍ່ມີໃນ `menuIds`) ບໍ່ສະແດງ ແຕ່ຍັງຢູ່ໃນກຸ່ມທີ່ບັນທຶກໄວ້
 */
const listItems = (menuIds: ShortcutId[], folders: DesktopFolder[]): Omit<DesktopItem, 'position'>[] => {
  const placed = new Set<string>();
  return menuIds.flatMap<Omit<DesktopItem, 'position'>>((id) => {
    const folder = folders.find((item) => item.items.includes(id));
    if (!folder) return [{ id, section: groupOfShortcut(id) }];
    if (placed.has(folder.id)) return [];
    placed.add(folder.id);
    return [{
      id: folder.id,
      section: folder.section ?? groupOfShortcut(id),
      folder: { ...folder, items: folder.items.filter((member) => menuIds.includes(member)) },
    }];
  });
};

type Placement = { items: DesktopItem[]; sections: DesktopSection[]; cellOf: Cells };

/**
 * ຈັດກອບ ແລະ ໄອຄອນ: ແຕ່ລະກຸ່ມເມນູ (MENU_GROUPS) ມີກອບຂອງມັນ — ໄອຄອນທີ່ຍັງບໍ່ເຄີຍລາກ ລຽງລົງທາງລຸ່ມກ່ອນ
 * ແລ້ວຂຶ້ນຖັນໃໝ່ (ຖັນ = ຈຳນວນ ÷ ແຖວທີ່ພໍດີຈໍ), ອັນທີ່ລາກແລ້ວຢູ່ຊ່ອງຂອງມັນ. ກອບວາງຈາກຊ້າຍໄປຂວາ,
 * ກອບທີ່ພໍລົງຢູ່ກ້ອງກອບກ່ອນໄດ້ (ສູງບໍ່ເກີນຈໍ) ກໍ່ລົງຢູ່ກ້ອງ ບໍ່ກິນພື້ນທີ່ທາງຂວາ
 */
const placeLayout = (list: Omit<DesktopItem, 'position'>[], cells: Cells, area: DesktopArea, grid: IconGrid): Placement => {
  const maxRows = fitRows(area, grid);
  const cellOf: Cells = {};
  const sections: DesktopSection[] = [];

  MENU_GROUPS.forEach((group) => {
    const members = list.filter((item) => item.section === group.key);
    if (!members.length) return;
    const stored = members.flatMap((item) => (cells[item.id] && cells[item.id].row < maxRows ? [cells[item.id]] : []));
    // ຢ່າງໜ້ອຍ 2 ຖັນ (ມີ 2 ອັນຂຶ້ນໄປ) — ກອບບໍ່ເປັນເສົາສູງແຄບ ແລະ ຊື່ກອບບໍ່ຖືກຕັດ
    let cols = Math.max(Math.ceil(members.length / maxRows), Math.min(members.length, 2), ...stored.map((cell) => cell.col + 1));
    let rows = Math.min(maxRows, Math.max(Math.ceil(members.length / cols), ...stored.map((cell) => cell.row + 1)));
    const taken: Cell[] = [];
    const isFree = (cell: Cell) => !taken.some((other) => sameCell(other, cell));

    const unplaced = members.filter((item) => {
      const cell = cells[item.id];
      if (!cell || cell.row >= rows || !isFree(cell)) return true;
      taken.push(cell);
      cellOf[item.id] = cell;
      return false;
    });
    // ຊ່ອງຫວ່າງທຳອິດ ລຽງລົງທາງລຸ່ມກ່ອນ — ເຕັມແລ້ວກໍ່ເພີ່ມຖັນ
    let index = 0;
    unplaced.forEach((item) => {
      let cell: Cell;
      do {
        cell = { col: Math.floor(index / rows), row: index % rows };
        index += 1;
      } while (!isFree(cell));
      taken.push(cell);
      cellOf[item.id] = cell;
    });
    // ກອບພໍດີກັບໄອຄອນທີ່ວາງຢູ່ແທ້ — ລາກມາລຽງຖັນດຽວ ກອບກໍ່ແຄບລົງຕາມ (ຖັນ/ແຖວຫວ່າງທາງຂວາ ແລະ ລຸ່ມບໍ່ນັບ)
    cols = Math.max(1, ...taken.map((cell) => cell.col + 1));
    rows = Math.max(1, ...taken.map((cell) => cell.row + 1));

    sections.push({ key: group.key, cols, rows, x: 0, y: 0, width: frameWidth(cols, grid), height: frameHeight(rows, grid) });
  });

  let x = 0;
  let y = 0;
  let columnWidth = 0;
  sections.forEach((section) => {
    if (y > 0 && y + section.height > area.height) {
      x += columnWidth + FRAME.gap;
      y = 0;
      columnWidth = 0;
    }
    section.x = x;
    section.y = y;
    y += section.height + FRAME.gap;
    columnWidth = Math.max(columnWidth, section.width);
  });

  const items = list.map((item) => {
    const section = sections.find((frame) => frame.key === item.section)!;
    const cell = cellOf[item.id];
    return {
      ...item,
      position: {
        x: section.x + FRAME.pad + cell.col * grid.columnPitch,
        y: section.y + FRAME.pad + cell.row * grid.rowPitch,
      },
    };
  });
  return { items, sections, cellOf };
};

/**
 * Desktop icons grouped into frames — ບັນຊີ / ບຸກຄະລາກອນ / ທົ່ວໄປ (MENU_GROUPS). An icon follows the
 * pointer freely while dragging, then snaps onto the nearest free cell of its own frame when dropped
 * (dropping it over another frame brings it back to its own; dropping just past the frame's edge adds
 * a column/row). Dropping a shortcut right onto another icon groups them into a folder instead (like a
 * phone's home screen); the folder stays in the frame of the icon it was dropped on. Cells and folders
 * are per-browser (localStorage), so they stick across visits; anything never dragged sits in menu order.
 *
 * ຕາໜ່າງປັບຕາມໜ້າຈໍເອງ: <DesktopMenu> ວັດພື້ນທີ່ແທ້ສົ່ງເຂົ້າ `setArea()` (ResizeObserver) — ແຖວຂອງກອບ
 * ບໍ່ເກີນຄວາມສູງ, ຈໍນ້ອຍກໍ່ໃຊ້ຕາໜ່າງແຄບລົງໃຫ້ກົງກັບຂະໜາດໄອຄອນໃນ CSS.
 *
 * `menuIds` = ເມນູທີ່ຜູ້ໃຊ້ເຫັນ ຕາມລຳດັບຂອງ backend (useAccountMenus)
 */
export const useDesktopLayout = (menuIds: ShortcutId[]) => {
  const [layout, setLayout] = useState<DesktopLayout>(() => ({
    cells: readStoredCells(),
    folders: readStoredFolders(),
    drag: null,
  }));
  /** ພື້ນທີ່ວາງໄອຄອນ — ຄາດຄະເນໄວ້ກ່ອນ ແລ້ວ <DesktopMenu> ວັດແທ້ສົ່ງມາທັບຕອນ mount/ປ່ຽນຂະໜາດ */
  const [area, setArea] = useState<DesktopArea>(estimateArea);
  const grid = useIsTablet() ? COMPACT_GRID : WIDE_GRID;

  useEffect(() => {
    localStorage.setItem(CELLS_STORAGE_KEY, JSON.stringify(layout.cells));
  }, [layout.cells]);

  useEffect(() => {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(layout.folders));
  }, [layout.folders]);

  const place = (current: DesktopLayout) => placeLayout(listItems(menuIds, current.folders), current.cells, area, grid);

  /**
   * ຊ່ອງໃນກອບ `section` ທີ່ໃກ້ກັບ px `position` ທີ່ສຸດ ແລະ ຍັງຫວ່າງ. ປ່ອຍຊິດຂອບກອບ (ເກີນໄປບໍ່ເກີນ 1 ຊ່ອງ)
   * = ກອບຂະຫຍາຍໄດ້ 1 ຖັນ/ແຖວ; ປ່ອຍໄກ (ເຊັ່ນ ໃນກອບອື່ນ) = ກັບເຂົ້າຊ່ອງຫວ່າງໃນກອບເດີມ ບໍ່ຂະຫຍາຍ (ເຕັມແລ້ວຈຶ່ງຂະຫຍາຍ)
   */
  const cellNear = (placement: Placement, section: MenuGroupKey, position: ShortcutPosition, exceptId: string): Cell => {
    const frame = placement.sections.find((item) => item.key === section);
    if (!frame) return { col: 0, row: 0 };
    const wanted = {
      col: Math.round((position.x - frame.x - FRAME.pad) / grid.columnPitch),
      row: Math.round((position.y - frame.y - FRAME.pad) / grid.rowPitch),
    };
    const taken = placement.items
      .filter((item) => item.section === section && item.id !== exceptId)
      .map((item) => placement.cellOf[item.id]);
    const growRow = Math.min(frame.rows, fitRows(area, grid) - 1);
    const nearFrame = wanted.col >= -1 && wanted.col <= frame.cols && wanted.row >= -1 && wanted.row <= frame.rows;
    if (!nearFrame) {
      const inside = findFreeCell(wanted, taken, frame.cols - 1, frame.rows - 1);
      if (!taken.some((cell) => sameCell(cell, inside))) return inside;
    }
    return findFreeCell(wanted, taken, frame.cols, growRow);
  };

  /** ລາກຢູ່ — ໄອຄອນຕາມ pointer (ບໍ່ບັນທຶກ ຈົນກວ່າຈະປ່ອຍ) */
  const dragTo = (id: string, position: ShortcutPosition) => {
    setLayout((current) => ({ ...current, drag: { id, position } }));
  };

  /**
   * ປ່ອຍສິ່ງທີ່ລາກ: ປຸ່ມລັດທັບປຸ່ມລັດອື່ນ = ສ້າງກຸ່ມໃໝ່ຢູ່ບ່ອນຂອງອັນທີ່ຖືກທັບ, ທັບກຸ່ມ = ເຂົ້າກຸ່ມນັ້ນ,
   * ບໍ່ທັບຫຍັງ = ເກາະຊ່ອງຫວ່າງໃກ້ທີ່ສຸດໃນກອບຂອງມັນເອງ. ກຸ່ມບໍ່ຊ້ອນເຂົ້າໃນກຸ່ມອື່ນ — ລາກກຸ່ມໄດ້ແຕ່ຍ້າຍບ່ອນ.
   * ປັກຊ່ອງຂອງທຸກອັນໄວ້ກ່ອນ — ຈຳນວນປ່ຽນ ອັນທີ່ບໍ່ກ່ຽວຂ້ອງຈະບໍ່ເລື່ອນໜີຈາກບ່ອນເກົ່າ
   */
  const dropItem = (id: string, targetId: string | null) => {
    const newFolderId = `${FOLDER_ID_PREFIX}${Date.now()}`;

    setLayout((current) => {
      const placement = place(current);
      const released = { ...current, drag: null };
      const target = targetId && !isFolderId(id) ? placement.items.find((item) => item.id === targetId) : undefined;

      if (!target) {
        const dropped = placement.items.find((item) => item.id === id);
        if (!dropped || current.drag?.id !== id) return released;
        const cell = cellNear(placement, dropped.section, current.drag.position, id);
        return { ...released, cells: { ...placement.cellOf, [id]: cell } };
      }

      // ອັນທີ່ລາກລົງໄປຢູ່ໃນກຸ່ມແລ້ວ ບໍ່ມີຊ່ອງເທິງ desktop ອີກ
      const cells = withoutCells(placement.cellOf, id);
      const dropped = id as ShortcutId;

      if (target.folder) {
        return {
          ...released,
          cells,
          folders: current.folders.map((folder) =>
            (folder.id === target.id ? { ...folder, items: [...folder.items, dropped] } : folder)),
        };
      }

      return {
        ...released,
        cells: { ...withoutCells(cells, target.id), [newFolderId]: cells[target.id] },
        folders: [...current.folders, { id: newFolderId, name: '', items: [target.id as ShortcutId, dropped], section: target.section }],
      };
    });
  };

  /**
   * ລາກໄອຄອນອອກນອກກອບກຸ່ມ: ອອກມາຢູ່ໃນກອບຂອງເມນູມັນເອງ ໃກ້ `position` (ແລ້ວລາກຕໍ່ໄດ້). ກຸ່ມທີ່ເຫຼືອ
   * ອັນດຽວຖືກຍຸບ — ອັນທີ່ເຫຼືອຢູ່ບ່ອນຂອງກຸ່ມແທນ (ຄືໂທລະສັບ) ຖ້າເປັນເມນູຂອງກອບດຽວກັນ
   */
  const pullFromFolder = (folderId: string, id: ShortcutId, position: ShortcutPosition) => {
    setLayout((current) => {
      const folder = current.folders.find((item) => item.id === folderId);
      if (!folder) return current;
      const placement = place(current);
      const cells: Cells = { ...placement.cellOf, [id]: cellNear(placement, groupOfShortcut(id), position, id) };
      const remaining = folder.items.filter((member) => member !== id);
      const drag = { id, position };

      if (remaining.length > 1) {
        return {
          cells,
          drag,
          folders: current.folders.map((item) => (item.id === folderId ? { ...item, items: remaining } : item)),
        };
      }

      const folderSection = placement.items.find((item) => item.id === folderId)?.section;
      const keepsCell = remaining.length === 1 && groupOfShortcut(remaining[0]) === folderSection && cells[folderId];
      return {
        cells: { ...withoutCells(cells, folderId), ...(keepsCell ? { [remaining[0]]: cells[folderId] } : {}) },
        drag,
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

  /** "Arrange icons" — every icon and folder back in menu order inside its frame (folders are kept). */
  const resetPositions = () => setLayout((current) => ({ ...current, cells: {} }));

  const placement = place(layout);
  const { drag } = layout;
  return {
    items: drag ? placement.items.map((item) => (item.id === drag.id ? { ...item, position: drag.position } : item)) : placement.items,
    sections: placement.sections,
    dragTo,
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
