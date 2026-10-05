import { useEffect, useMemo, useState } from 'react';
import { getApi, postApi } from '../../../utils/configApi';
import { useLangField } from '../../../context/LanguageContext';
import type { Range } from '../journal/reportData';
import type { Line } from '../statements/statementData';
import type { Balance, ChartAccount } from './glApi';

type Snapshot = Map<number, Balance>;

/**
 * ລາຍຮັບ (ກຸ່ມ 4) ແລະ ລາຍຈ່າຍ (ກຸ່ມ 5) ຕາມບັນຊີໃນຜັງ ຈາກສະໝຸດບັນຊີ (LAK) — ງວດນີ້ ທຽບງວດກ່ອນ.
 * ຄືນ null ເມື່ອລະບົບບັນຊີຄູ່ຍັງບໍ່ພ້ອມ ຫຼື ຍັງບໍ່ມີລາຍການຈັກແຖວ (ໃບລາຍງານໃຊ້ຂໍ້ມູນລາຍຮັບ-ລາຍຈ່າຍເດີມແທນ)
 */
export const useGlPnl = (range: Range, prev: Range) => {
  const lf = useLangField();
  const [state, setState] = useState<{ accounts: ChartAccount[]; now: Snapshot; before: Snapshot } | null>(null);
  const keys = [range.start, range.end, prev.start, prev.end].map((d) => d.format('YYYY-MM-DD'));

  useEffect(() => {
    let cancelled = false;
    const [start, end, prevStart, prevEnd] = keys;
    const balances = (start_date: string, end_date: string) =>
      postApi('/gl/balances', { start_date, end_date })
        .then((res) => new Map<number, Balance>((res.data?.data ?? []).map((b: Balance) => [b.account_id, b])));
    Promise.all([getApi('/chart-account/fetch'), balances(start, end), balances(prevStart, prevEnd)])
      .then(([accounts, now, before]) => !cancelled && setState({ accounts: accounts.data?.data ?? [], now, before }))
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, keys); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    if (!state) return null;
    const moved = (snap: Snapshot) => [...snap.values()].some((b) => b.debit || b.credit);
    if (!moved(state.now) && !moved(state.before)) return null;
    // ຍອດໃນງວດ: ລາຍຮັບ = ມີ − ໜີ້, ລາຍຈ່າຍ = ໜີ້ − ມີ
    const periodOf = (snap: Snapshot, a: ChartAccount) => {
      const b = snap.get(a._uuid);
      const net = (b?.debit ?? 0) - (b?.credit ?? 0);
      return Number(a.account_group) === 4 ? -net : net;
    };
    const lines = (group: number): Line[] => state.accounts
      .filter((a) => Number(a.is_postable) === 1 && Number(a.account_group) === group)
      .map((a) => ({
        key: String(a._uuid),
        code: a.account_code,
        label: lf(a, 'name'),
        current: periodOf(state.now, a),
        previous: periodOf(state.before, a),
      }))
      .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.previous) >= 0.005);
    return { revenue: lines(4), expense: lines(5) };
  }, [state, lf]);
};
