import moment, { type Moment } from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { currencySymbol } from '../ledger/currency';
import type { PartnerPayment } from '../arap/arapApi';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import type { Entry, Range } from '../journal/reportData';

/**
 * ຄິດໄລ່ໃບລາຍງານການເງິນ (ໜ້າຕ່າງ ລາຍງານການເງິນ) ຈາກລາຍຮັບ / ລາຍຈ່າຍ (Entry ຂອງ journal/reportData),
 * ບັນຊີເງິນຄັງ (ຍອດປັດຈຸບັນ) ແລະ ການໂອນລະຫວ່າງບັນຊີ. ນັບສະເພາະທີ່ໃຊ້ງານ, ສະກຸນດຽວຕໍ່ຄັ້ງ
 */

/** ແຖວຈາກ POST /transfer-money/fetch */
export type Transfer = {
  _uuid: string;
  account_outid: number;
  account_inid: number;
  balance_transfer: number;
  createdAt: string;
};

/**
 * ຮັບ/ຈ່າຍຊຳລະໜີ້ (POST /partner-payment/fetch) ເປັນ Entry ໃຫ້ໃບກະແສເງິນສົດ — ເງິນເຂົ້າ/ອອກແທ້ຂອງບັນຊີເງິນຄັງ
 * ແຕ່ບໍ່ແມ່ນລາຍຮັບ-ລາຍຈ່າຍ (ບໍ່ໃຊ້ໃນໃບຜົນດຳເນີນງານ). category = ແຖວດຽວ "ຮັບຊຳລະໜີ້" / "ຈ່າຍຊຳລະໜີ້"
 */
export const fromPartnerPayment = (p: PartnerPayment, categoryName: string): Entry => {
  const date = moment(p.pay_date);
  const currency = p.account?.treasury?.currency;
  const amount = Number(p.amount) || 0;
  return {
    id: -p._uuid,
    number: p.pay_number,
    date,
    dateKey: date.format('YYYY-MM-DD'),
    title: p.description || p.partner?.name || p.pay_number,
    category: { id: Number(p.pay_kind) === 1 ? -1 : -2, code: '', name: categoryName },
    account: p.account
      ? { id: p.account._uuid, name: p.account.acountName, bank: p.account.banks?.abbr ?? null, url: p.account.banks?.url ?? null }
      : null,
    currency: { key: currency?.name ?? '—', symbol: currencySymbol({ name: currency?.name, genus: currency?.genus ?? undefined }) },
    transfer: true,
    party: p.partner?.name ?? null,
    base: amount,
    tax: 0,
    amount,
    active: Number(p.status) === 1,
    user: null,
    items: [],
    raw: p as any,
  };
};

/** ຕົວເລກແບບບັນຊີ — ຕິດລົບຢູ່ໃນວົງເລັບ (1,250,000) */
export const acct = (value: number) => (value < 0 ? `(${formatNumber(-value)})` : formatNumber(value));

export const within = (date: Moment, range: Range) =>
  !date.isBefore(range.start, 'day') && !date.isAfter(range.end, 'day');

/** ຍອດສຸດທິບໍ່ລວມອາກອນ — ອາກອນເປັນໜີ້ສິນ/ຊັບສິນ (ເກັບແທນ ຫຼື ຈ່າຍລ່ວງໜ້າ) ບໍ່ແມ່ນລາຍຮັບ-ລາຍຈ່າຍ */
export const netOf = (e: Entry) => e.amount - e.tax;

export type Line = { key: string; code: string; label: string; current: number; previous: number };

/** ລວມຕາມປະເພດ ທັງຊ່ວງນີ້ ແລະ ຊ່ວງກ່ອນ — ລຽງຕາມລະຫັດປະເພດ */
export const linesByCategory = (
  entries: Entry[],
  range: Range,
  prev: Range,
  valueOf: (e: Entry) => number,
  unnamed: string,
) => {
  const map = new Map<string, Line>();
  entries.forEach((e) => {
    const inCurrent = within(e.date, range);
    const inPrevious = within(e.date, prev);
    if (!inCurrent && !inPrevious) return;
    const key = String(e.category?.id ?? 0);
    const line = map.get(key) ?? {
      key,
      code: e.category?.code ?? '',
      label: e.category?.name ?? unnamed,
      current: 0,
      previous: 0,
    };
    if (inCurrent) line.current += valueOf(e);
    if (inPrevious) line.previous += valueOf(e);
    map.set(key, line);
  });
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
};

export const sumLines = (lines: Line[]) => ({
  current: lines.reduce((n, l) => n + l.current, 0),
  previous: lines.reduce((n, l) => n + l.previous, 0),
});

export type AccountFlow = {
  account: TreasuryAccount;
  opening: number;
  receipts: number;
  payments: number;
  transferIn: number;
  transferOut: number;
  closing: number;
};

/**
 * ກະແສເງິນຂອງແຕ່ລະບັນຊີ (ສະກຸນ cur) ໃນຊ່ວງ range. ຍອດທ້າຍງວດ = ຍອດປັດຈຸບັນ (ໃຊ້ໄດ້ + ຄ້າງ) ລົບການເຄື່ອນໄຫວ
 * ຫຼັງວັນທ້າຍງວດ; ຍອດຕົ້ນງວດ = ທ້າຍງວດ − ການເຄື່ອນໄຫວໃນຊ່ວງ. ບັນຊີທີ່ເປີດຫຼັງວັນທ້າຍງວດ ບໍ່ນັບ.
 * ຍອດເລີ່ມຕົ້ນຂອງບັນຊີທີ່ເປີດລະຫວ່າງຊ່ວງ ຈຶ່ງຢູ່ໃນ "ຕົ້ນງວດ"
 */
export const accountFlows = (
  accounts: TreasuryAccount[],
  incomes: Entry[],
  expenses: Entry[],
  transfers: Transfer[],
  range: Range,
  cur: string | null,
): AccountFlow[] => {
  const ofCurrency = accounts.filter((a) => (a.treasury?.currency?.name ?? '—') === cur);
  return ofCurrency
    .filter((a) => {
      const created = (a as any).createdAt;
      return !created || !moment(created).isAfter(range.end, 'day');
    })
    .map((account) => {
      const id = account._uuid;
      let receipts = 0;
      let payments = 0;
      let transferIn = 0;
      let transferOut = 0;
      let after = 0;
      incomes.forEach((e) => {
        if (!e.active || e.account?.id !== id) return;
        if (within(e.date, range)) receipts += e.amount;
        else if (e.date.isAfter(range.end, 'day')) after += e.amount;
      });
      expenses.forEach((e) => {
        if (!e.active || e.account?.id !== id) return;
        if (within(e.date, range)) payments += e.amount;
        else if (e.date.isAfter(range.end, 'day')) after -= e.amount;
      });
      transfers.forEach((tr) => {
        const date = moment(tr.createdAt);
        const amount = Number(tr.balance_transfer) || 0;
        const sign = Number(tr.account_inid) === id ? 1 : Number(tr.account_outid) === id ? -1 : 0;
        if (!sign) return;
        if (within(date, range)) {
          if (sign > 0) transferIn += amount;
          else transferOut += amount;
        } else if (date.isAfter(range.end, 'day')) {
          after += sign * amount;
        }
      });
      const current = (Number(account.balance_treasury) || 0) + (Number(account.balance_unable) || 0);
      const closing = current - after;
      const opening = closing - (receipts - payments + transferIn - transferOut);
      return { account, opening, receipts, payments, transferIn, transferOut, closing };
    })
    .sort((a, b) => b.closing - a.closing);
};

/** ສະກຸນເງິນທີ່ມີໃນຂໍ້ມູນ — ລຽງຕາມຈຳນວນລາຍການ + ບັນຊີ ຫຼາຍສຸດກ່ອນ */
export const currenciesOf = (entries: Entry[], accounts: TreasuryAccount[]) => {
  const map = new Map<string, { key: string; symbol: string; count: number }>();
  const add = (key: string, symbol: string) => {
    const item = map.get(key) ?? { key, symbol, count: 0 };
    item.count += 1;
    map.set(key, item);
  };
  entries.filter((e) => e.active).forEach((e) => add(e.currency.key, e.currency.symbol));
  accounts.forEach((a) => {
    const cur = a.treasury?.currency;
    add(cur?.name ?? '—', cur?.genus || cur?.name || '');
  });
  return [...map.values()].filter((c) => c.key !== '—').sort((a, b) => b.count - a.count);
};
