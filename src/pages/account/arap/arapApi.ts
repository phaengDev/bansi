import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { getApi, postApi, formatNumber } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { isNotReady } from '../gl/glApi';

/**
 * ລູກໜີ້ (AR, kind 1) ແລະ ເຈົ້າໜີ້ (AP, kind 2) — ຊະນິດຂໍ້ມູນ, ການຕັ້ງຄ່າຂອງແຕ່ລະຝັ່ງ ແລະ hook ດຶງຂໍ້ມູນ.
 * backend: controllers/bansi/arapController.ts (ຕາຕະລາງຈາກ sql/create_gl_ar_ap.sql)
 */

export const AR = 1;
export const AP = 2;
export type Kind = typeof AR | typeof AP;

/** ປ້າຍ / ສີ / ກຸ່ມບັນຊີຂອງແຖວ ແຍກຕາມຝັ່ງ — label ເປັນ key ຂອງ lao-dict */
export const KINDS = {
  [AR]: {
    tone: 'is-emerald',
    partnerTypes: [1, 3],
    lineGroups: [4, 2, 3],
    doc: 'arInvoice',
    docs: 'arInvoices',
    docAdd: 'arInvoiceAdd',
    pay: 'arReceipt',
    pays: 'arReceipts',
    payAdd: 'arReceiptAdd',
    partner: 'arCustomer',
    partners: 'arCustomers',
    open: 'arOpen',
    docIcon: 'fa-file-invoice-dollar',
    payIcon: 'fa-hand-holding-dollar',
    partnerIcon: 'fa-user-tie',
  },
  [AP]: {
    tone: 'is-coral',
    partnerTypes: [2, 3],
    lineGroups: [5, 1],
    doc: 'apBill',
    docs: 'apBills',
    docAdd: 'apBillAdd',
    pay: 'apPayment',
    pays: 'apPayments',
    payAdd: 'apPaymentAdd',
    partner: 'apSupplier',
    partners: 'apSuppliers',
    open: 'apOpen',
    docIcon: 'fa-file-lines',
    payIcon: 'fa-money-bill-transfer',
    partnerIcon: 'fa-truck-field',
  },
} as const;

export type Currency = { _id: number; name: string; genus?: string | null };

export type Partner = {
  _uuid: number;
  partner_code: string;
  name: string;
  partner_type: number;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tax_number?: string | null;
  credit_days: number;
  receivable_account_id?: number | null;
  payable_account_id?: number | null;
  description?: string | null;
  status: number;
  ar_open: number;
  ar_overdue: number;
  ar_docs: number;
  ap_open: number;
  ap_overdue: number;
  ap_docs: number;
};

export type PartnerDoc = {
  _uuid: number;
  doc_kind: number;
  doc_number: string;
  partner_id: number;
  doc_date: string;
  due_date: string;
  reference?: string | null;
  description?: string | null;
  currency_id?: number | null;
  currency?: Currency | null;
  exchange_rate: string | number;
  subtotal: string | number;
  tax_id?: number | null;
  tax: string | number;
  total: string | number;
  paid: string | number;
  open: number;
  status: number;
  partner?: { _uuid: number; partner_code: string; name: string; phone?: string | null } | null;
  lines: {
    _uuid: number;
    line_no: number;
    account_id: number;
    description?: string | null;
    amount: string | number;
    account?: { account_code: string; name_la: string; name_en?: string | null; name_cn?: string | null; account_group: number } | null;
  }[];
  allocations: { _uuid: number; amount: string | number; payment?: { pay_number: string; pay_date: string; status: number } | null }[];
};

export type PartnerPayment = {
  _uuid: number;
  pay_kind: number;
  pay_number: string;
  partner_id: number;
  pay_date: string;
  treasury_account_id: number;
  currency_id?: number | null;
  exchange_rate: string | number;
  amount: string | number;
  reference?: string | null;
  description?: string | null;
  status: number;
  createdAt: string;
  partner?: { _uuid: number; partner_code: string; name: string } | null;
  account?: {
    _uuid: number;
    acountName: string;
    acount_number?: string | null;
    banks?: { abbr?: string; url?: string | null } | null;
    treasury?: { currency?: Currency | null } | null;
  } | null;
  allocations: { _uuid: number; doc_id: number; amount: string | number; doc?: { doc_number: string; doc_date: string; due_date: string } | null }[];
};

/** ດຶງລາຍການຈາກ API — notReady = ຍັງບໍ່ໄດ້ແລ່ນ SQL */
const useFetch = <T,>(load: () => Promise<{ data: { data?: T[] } }>, deps: unknown[]) => {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await load();
      setRows(res.data?.data ?? []);
      setNotReady(false);
    } catch (error) {
      if (isNotReady(error)) setNotReady(true);
      else Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // deps ມາຈາກຜູ້ເອີ້ນ (ຕົວກອງ) — `load` ສ້າງໃໝ່ທຸກ render ຈຶ່ງບໍ່ໃສ່
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, loading, notReady, reload };
};

export const usePartners = () => useFetch<Partner>(() => getApi('/partner/fetch'), []);

export const usePartnerDocs = (kind: Kind, filter: { start_date?: string; partner_id?: number; open_only?: boolean } = {}) =>
  useFetch<PartnerDoc>(() => postApi('/partner-doc/fetch', { kind, ...filter }), [kind, filter.start_date, filter.partner_id, filter.open_only]);

export const usePartnerPayments = (kind: Kind, filter: { start_date?: string; partner_id?: number } = {}) =>
  useFetch<PartnerPayment>(() => postApi('/partner-payment/fetch', { kind, ...filter }), [kind, filter.start_date, filter.partner_id]);

export const isPartnerOf = (kind: Kind, p: { partner_type: number }) => (KINDS[kind].partnerTypes as readonly number[]).includes(Number(p.partner_type));

export const today = () => moment().format('YYYY-MM-DD');

/** ມື້ທີ່ເກີນກຳນົດ (ຍັງບໍ່ຮອດ = ຕິດລົບ) */
export const overdueDays = (due: string) => moment(today()).diff(moment(due), 'days');

/** ຊ່ວງອາຍຸໜີ້ */
export const BUCKETS = [
  { key: 'current', label: 'arapBucketCurrent', tone: '#3fb68b' },
  { key: 'd30', label: 'arapBucket30', tone: '#f2b84b' },
  { key: 'd60', label: 'arapBucket60', tone: '#f08a4b' },
  { key: 'd90', label: 'arapBucket90', tone: '#e5604d' },
  { key: 'd90p', label: 'arapBucket90p', tone: '#b4233a' },
] as const;
export type BucketKey = (typeof BUCKETS)[number]['key'];
export const bucketOf = (due: string): BucketKey => {
  const d = overdueDays(due);
  if (d <= 0) return 'current';
  if (d <= 30) return 'd30';
  if (d <= 60) return 'd60';
  if (d <= 90) return 'd90';
  return 'd90p';
};

/** ສະຖານະຂອງໃບ */
export const docStatusOf = (doc: PartnerDoc): 'cancelled' | 'paid' | 'overdue' | 'partial' | 'open' => {
  if (Number(doc.status) !== 1) return 'cancelled';
  if (doc.open <= 0) return 'paid';
  if (overdueDays(doc.due_date) > 0) return 'overdue';
  if (Number(doc.paid) > 0) return 'partial';
  return 'open';
};
export const DOC_STATUS: Record<ReturnType<typeof docStatusOf>, { label: string; tone: string }> = {
  open: { label: 'arapStatusOpen', tone: 'is-blue' },
  partial: { label: 'arapStatusPartial', tone: 'is-gold' },
  overdue: { label: 'arapStatusOverdue', tone: 'is-coral' },
  paid: { label: 'arapStatusPaid', tone: 'is-emerald' },
  cancelled: { label: 'arapStatusCancelled', tone: 'is-slate' },
};

/** ຍອດຄ້າງເປັນ LAK ຕາມອັດຕາຂອງໃບ (ມູນຄ່າຕາມບັນຊີ) */
export const openBase = (doc: PartnerDoc) => doc.open * (Number(doc.exchange_rate) || 1);

/** ຈຳນວນ + ລະຫັດສະກຸນ (LAK ບໍ່ຕໍ່ທ້າຍ) */
export const amountText = (value: number | string, currency?: { name?: string } | null) => {
  const code = currency?.name && currency.name.toUpperCase() !== 'LAK' ? ` ${currency.name}` : '';
  return `${formatNumber(Number(value) || 0)}${code}`;
};
