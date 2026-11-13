import { useEffect, useState } from 'react';
import type { Moment } from 'moment';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { isNotReady, type Balance, type ChartAccount } from '../gl/glApi';

export type Snapshot = Map<number, Balance>;
type Span = { start?: Moment | null; end: Moment };

/** POST /gl/balances → Map ຕາມບັນຊີ; start ບໍ່ສົ່ງ = ສະສົມທຸກຢ່າງເຖິງ end (opening = 0) */
export const fetchBalances = ({ start, end }: Span) =>
  postApi('/gl/balances', {
    ...(start ? { start_date: start.format('YYYY-MM-DD') } : {}),
    end_date: end.format('YYYY-MM-DD'),
  }).then((res) => new Map<number, Balance>((res.data?.data ?? []).map((b: Balance) => [b.account_id, b])));

/**
 * ຍອດຕາມບັນຊີຫຼາຍຊ່ວງພ້ອມກັນ (key → ຊ່ວງ) — ໃຊ້ໃນໃບການປ່ຽນແປງທຶນ ແລະ ບົດອະທິບາຍ.
 * notReady = ລະບົບບັນຊີຄູ່ຍັງບໍ່ເປີດ
 */
export const useGlSnapshots = <K extends string>(spans: Record<K, Span>) => {
  const [data, setData] = useState<Record<K, Snapshot> | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const signature = JSON.stringify(Object.entries(spans).map(([k, s]) => {
    const span = s as Span;
    return [k, span.start?.format('YYYY-MM-DD') ?? '', span.end.format('YYYY-MM-DD')];
  }));

  useEffect(() => {
    let cancelled = false;
    setError('');
    const keys = Object.keys(spans) as K[];
    Promise.all(keys.map((k) => fetchBalances(spans[k])))
      .then((maps) => {
        if (!cancelled) setData(Object.fromEntries(keys.map((k, i) => [k, maps[i]])) as Record<K, Snapshot>);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotReady(err)) setNotReady(true);
        else setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error, notReady };
};

/** ຍອດ ນ ທ້າຍຊ່ວງ ຕາມຝັ່ງປົກກະຕິ: ຊັບສິນ/ລາຍຈ່າຍ = ໜີ້ − ມີ, ອື່ນໆ = ມີ − ໜີ້ */
export const naturalClosing = (snap: Snapshot, a: ChartAccount) => {
  const closing = snap.get(a._uuid)?.closing ?? 0;
  return Number(a.account_group) === 1 || Number(a.account_group) === 5 ? closing : -closing;
};

/** ການເຄື່ອນໄຫວໃນຊ່ວງ ຕາມຝັ່ງປົກກະຕິ (ລາຍຮັບ = ມີ − ໜີ້, ລາຍຈ່າຍ = ໜີ້ − ມີ) */
export const naturalMovement = (snap: Snapshot, a: ChartAccount) => {
  const b = snap.get(a._uuid);
  const net = (b?.debit ?? 0) - (b?.credit ?? 0);
  return Number(a.account_group) === 1 || Number(a.account_group) === 5 ? net : -net;
};

/** ບັນຊີກຳໄລສະສົມ (ບົດບາດ RETAINED_EARNINGS ໃນ ຜັງບັນຊີ → ຜູກບັນຊີ) — null = ບໍ່ໄດ້ຜູກ */
export const useRoleAccountId = (role: string) => {
  const [id, setId] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    getApi('/gl-mapping/fetch')
      .then((res) => {
        const row = (res.data?.mappings ?? []).find((m: any) => m.source_type === 'ROLE' && m.source_key === role);
        setId(row ? Number(row.account_id) : null);
      })
      .catch(() => setId(null));
  }, [role]);
  return id;
};
