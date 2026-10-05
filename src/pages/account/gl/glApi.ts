import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';

/**
 * ສ່ວນກາງຂອງລະບົບບັນຊີຄູ່ (GL) ໃນໜ້າເວັບ — ຊະນິດຂໍ້ມູນ, ກຸ່ມ/ໝວດຍ່ອຍ ຂອງຜັງບັນຊີ ແລະ ການຄິດຍອດ.
 * backend: controllers/bansi/chartAccountController.ts, journalController.ts (ຕາຕະລາງຈາກ sql/create_gl_accounting.sql)
 */

export const DEBIT = 1;
export const CREDIT = 2;

export type ChartAccount = {
  _uuid: number;
  account_code: string;
  name_la: string;
  name_en?: string | null;
  name_cn?: string | null;
  parent_id: number | null;
  account_group: number;
  account_type: string;
  normal_side: number;
  is_postable: number;
  currency_id?: number | null;
  is_system: number;
  description?: string | null;
  status: number;
  /** ຍອດສະສົມທັງໝົດ (LAK) ຈາກ /chart-account/fetch */
  debit?: number;
  credit?: number;
  lines?: number;
  /** ບົດບາດຂອງລະບົບທີ່ຜູກກັບບັນຊີນີ້ */
  roles?: string[];
};

export type JournalLine = {
  _uuid: number;
  line_no: number;
  account_id: number;
  description?: string | null;
  debit: string | number;
  credit: string | number;
  currency_id?: number | null;
  amount_currency: string | number;
  exchange_rate: string | number;
  treasury_account_id?: number | null;
  account?: Pick<ChartAccount, '_uuid' | 'account_code' | 'name_la' | 'name_en' | 'name_cn' | 'account_group'>;
};

export type JournalEntry = {
  _uuid: number;
  entry_number: string;
  entry_date: string;
  source_type: string;
  source_id?: string | null;
  reference?: string | null;
  description?: string | null;
  total_debit: string | number;
  total_credit: string | number;
  reversal_of?: number | null;
  reversed_by?: number | null;
  createdAt: string;
  user?: { user_uuid: number; user_name: string } | null;
  lines: JournalLine[];
};

export type Balance = { account_id: number; opening: number; debit: number; credit: number; closing: number };

/** ກຸ່ມຂອງຜັງບັນຊີ — ຕົວເລກທຳອິດຂອງລະຫັດ */
export const GROUPS = [
  { value: 1, label: 'glGroupAsset', icon: 'fa-building-columns', tone: 'is-sky', side: DEBIT },
  { value: 2, label: 'glGroupLiability', icon: 'fa-file-invoice-dollar', tone: 'is-coral', side: CREDIT },
  { value: 3, label: 'glGroupEquity', icon: 'fa-landmark', tone: 'is-violet', side: CREDIT },
  { value: 4, label: 'glGroupRevenue', icon: 'fa-arrow-trend-up', tone: 'is-emerald', side: CREDIT },
  { value: 5, label: 'glGroupExpense', icon: 'fa-arrow-trend-down', tone: 'is-gold', side: DEBIT },
] as const;
export const groupOf = (value: number) => GROUPS.find((g) => g.value === Number(value)) ?? GROUPS[0];

/** ໝວດຍ່ອຍ (account_type) ຂອງແຕ່ລະກຸ່ມ — ໃຊ້ຈັດແຖວໃນໃບລາຍງານ; ຕ້ອງກົງກັບ TYPES_BY_GROUP ຂອງ backend */
export const ACCOUNT_TYPES: Record<number, { value: string; label: string }[]> = {
  1: [
    { value: 'CASH', label: 'glTypeCash' },
    { value: 'RECEIVABLE', label: 'glTypeReceivable' },
    { value: 'CURRENT_ASSET', label: 'glTypeCurrentAsset' },
    { value: 'FIXED_ASSET', label: 'glTypeFixedAsset' },
    { value: 'NONCURRENT_ASSET', label: 'glTypeNoncurrentAsset' },
  ],
  2: [
    { value: 'PAYABLE', label: 'glTypePayable' },
    { value: 'CURRENT_LIABILITY', label: 'glTypeCurrentLiability' },
    { value: 'NONCURRENT_LIABILITY', label: 'glTypeNoncurrentLiability' },
  ],
  3: [{ value: 'EQUITY', label: 'glTypeEquity' }],
  4: [
    { value: 'REVENUE', label: 'glTypeRevenue' },
    { value: 'OTHER_INCOME', label: 'glTypeOtherIncome' },
  ],
  5: [
    { value: 'COST_OF_SALES', label: 'glTypeCostOfSales' },
    { value: 'EXPENSE', label: 'glTypeExpense' },
    { value: 'OTHER_EXPENSE', label: 'glTypeOtherExpense' },
    { value: 'TAX_EXPENSE', label: 'glTypeTaxExpense' },
  ],
};
export const typeLabelOf = (group: number, type: string) =>
  ACCOUNT_TYPES[Number(group)]?.find((x) => x.value === type)?.label ?? type;

/** ບົດບາດຂອງລະບົບ (tbl_gl_mapping ROLE) — ຕ້ອງກົງກັບ ROLES ຂອງ backend */
export const ROLES = [
  { key: 'DEFAULT_CASH', label: 'glRoleDefaultCash', hint: 'glRoleDefaultCashHint', groups: [1] },
  { key: 'DEFAULT_BANK', label: 'glRoleDefaultBank', hint: 'glRoleDefaultBankHint', groups: [1] },
  { key: 'AR', label: 'glRoleAr', hint: 'glRoleArHint', groups: [1] },
  { key: 'AP', label: 'glRoleAp', hint: 'glRoleApHint', groups: [2] },
  { key: 'DEFAULT_REVENUE', label: 'glRoleDefaultRevenue', hint: 'glRoleDefaultRevenueHint', groups: [4] },
  { key: 'DEFAULT_EXPENSE', label: 'glRoleDefaultExpense', hint: 'glRoleDefaultExpenseHint', groups: [5] },
  { key: 'VAT_OUTPUT', label: 'glRoleVatOutput', hint: 'glRoleVatOutputHint', groups: [2] },
  { key: 'VAT_INPUT', label: 'glRoleVatInput', hint: 'glRoleVatInputHint', groups: [1] },
  { key: 'OPENING_EQUITY', label: 'glRoleOpeningEquity', hint: 'glRoleOpeningEquityHint', groups: [3] },
  { key: 'RETAINED_EARNINGS', label: 'glRoleRetainedEarnings', hint: 'glRoleRetainedEarningsHint', groups: [3] },
  { key: 'FX_GAIN', label: 'glRoleFxGain', hint: 'glRoleFxGainHint', groups: [4] },
  { key: 'FX_LOSS', label: 'glRoleFxLoss', hint: 'glRoleFxLossHint', groups: [5] },
] as const;
export const roleLabelOf = (key: string) => ROLES.find((r) => r.key === key)?.label ?? key;

/** ປະເພດເອກະສານຕົ້ນທາງຂອງໃບບັນທຶກ */
export const SOURCES: Record<string, { label: string; icon: string; tone: string }> = {
  MANUAL: { label: 'glSourceManual', icon: 'fa-pen-nib', tone: 'is-violet' },
  INCOME: { label: 'glSourceIncome', icon: 'fa-arrow-trend-up', tone: 'is-emerald' },
  EXPENSE: { label: 'glSourceExpense', icon: 'fa-arrow-trend-down', tone: 'is-coral' },
  TRANSFER: { label: 'glSourceTransfer', icon: 'fa-right-left', tone: 'is-sky' },
  OPENING: { label: 'glSourceOpening', icon: 'fa-flag-checkered', tone: 'is-gold' },
  CLOSING: { label: 'glSourceClosing', icon: 'fa-lock', tone: 'is-slate' },
  AR_INVOICE: { label: 'arInvoice', icon: 'fa-file-invoice-dollar', tone: 'is-emerald' },
  AR_RECEIPT: { label: 'arReceipt', icon: 'fa-hand-holding-dollar', tone: 'is-emerald' },
  AP_BILL: { label: 'apBill', icon: 'fa-file-lines', tone: 'is-coral' },
  AP_PAYMENT: { label: 'apPayment', icon: 'fa-money-bill-transfer', tone: 'is-coral' },
};
export const sourceOf = (type: string) => SOURCES[type] ?? { label: type, icon: 'fa-file', tone: 'is-slate' };

/** API ຕອບ 503 notReady = ຍັງບໍ່ໄດ້ແລ່ນ sql/create_gl_accounting.sql */
export const isNotReady = (error: any) => error?.response?.status === 503 && !!error?.response?.data?.notReady;

/** ຍອດຕາມຝັ່ງປົກກະຕິ: ບັນຊີຝັ່ງໜີ້ = ໜີ້ − ມີ, ຝັ່ງມີ = ມີ − ໜີ້ (ບວກ = ປົກກະຕິ) */
export const naturalOf = (side: number, debitMinusCredit: number) =>
  Number(side) === CREDIT ? -debitMinusCredit : debitMinusCredit;

/** ຊ່ວງວັນທີຕັ້ງຕົ້ນຂອງປຶ້ມບັນຊີໃຫຍ່: ຕົ້ນປີ → ມື້ນີ້ */
export const defaultLedgerRange = (): [Date, Date] => [moment().startOf('year').toDate(), moment().toDate()];

/** ຕົວເລກແບບບັນຊີ — ລົບຢູ່ໃນວົງເລັບ; 0 = ຂີດ */
export const money = (value: number) => {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  if (!n) return '–';
  return n < 0 ? `(${formatNumber(-n)})` : formatNumber(n);
};

export type TreeNode = ChartAccount & { depth: number; children: TreeNode[] };

/** ສ້າງຕົ້ນໄມ້ຕາມ parent_id (ລຽງຕາມລະຫັດ) — ບັນຊີທີ່ແມ່ຫາຍ ຂຶ້ນເປັນຮາກ */
export const buildTree = (accounts: ChartAccount[]) => {
  const byId = new Map<number, TreeNode>();
  accounts.forEach((a) => byId.set(a._uuid, { ...a, depth: 0, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sort = (list: TreeNode[], depth: number) => {
    list.sort((a, b) => a.account_code.localeCompare(b.account_code, undefined, { numeric: true }));
    list.forEach((n) => {
      n.depth = depth;
      sort(n.children, depth + 1);
    });
  };
  sort(roots, 0);
  return roots;
};

/** ລາຍການແບນຕາມລຳດັບຕົ້ນໄມ້ (ພໍ່ກ່ອນລູກ) */
export const flatten = (nodes: TreeNode[]): TreeNode[] => nodes.flatMap((n) => [n, ...flatten(n.children)]);

/**
 * ລວມຍອດຂຶ້ນຫາບັນຊີຫົວ — value(account) = ໜີ້ − ມີ ຂອງບັນຊີນັ້ນເອງ;
 * ຄືນ Map id → ໜີ້ − ມີ ລວມທັງລູກຫຼານ
 */
export const rollup = (roots: TreeNode[], value: (a: ChartAccount) => number) => {
  const totals = new Map<number, number>();
  const walk = (node: TreeNode): number => {
    const sum = value(node) + node.children.reduce((n, c) => n + walk(c), 0);
    totals.set(node._uuid, sum);
    return sum;
  };
  roots.forEach(walk);
  return totals;
};

/** ຂໍ້ຄວາມບັນຊີສັ້ນ: "1110 · ເງິນສົດ" */
export const accountText = (a: { account_code: string } & Record<string, any>, name: string) => `${a.account_code} · ${name}`;
