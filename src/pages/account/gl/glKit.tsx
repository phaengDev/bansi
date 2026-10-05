import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../../utils/configApi';
import { toThousands } from '../../../utils/formater';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useLangField, useT } from '../../../context/LanguageContext';
import { groupOf, isNotReady, sourceOf, type ChartAccount } from './glApi';

/** ຜັງບັນຊີທັງໝົດ (ພ້ອມຍອດສະສົມ) — notReady = ຍັງບໍ່ໄດ້ແລ່ນ SQL */
export const useChartAccounts = () => {
  const [rows, setRows] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/chart-account/fetch');
      setRows(res.data?.data ?? []);
      setNotReady(false);
    } catch (error) {
      if (isNotReady(error)) setNotReady(true);
      else Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, notReady, reload };
};

/** ບອກວ່າຕ້ອງສ້າງຕາຕະລາງກ່ອນ (sql/create_gl_accounting.sql ຂອງ backend) */
export const GlNotReady = () => {
  const t = useT();
  return (
    <div className="acc-gl-setup-card is-warn">
      <i className="fa-solid fa-database" />
      <div>
        <b>{t('glNotReadyTitle')}</b>
        <p>{t('glNotReadyText')}</p>
        <code>sql/create_gl_accounting.sql</code> <code>sql/create_gl_ar_ap.sql</code>
      </div>
    </div>
  );
};

/** ກ່ອງລະຫັດບັນຊີ ສີຕາມກຸ່ມ */
export const AccountCode = ({ code, group }: { code: string; group: number }) => (
  <span className={`acc-gl-code acc-tone ${groupOf(group).tone}`}>{code}</span>
);

/** ລາຍການໃນ SelectPicker ຂອງບັນຊີ — ລະຫັດ + ຊື່ (ພາສາປັດຈຸບັນ) */
export const useAccountOptions = (accounts: ChartAccount[], filter?: (a: ChartAccount) => boolean) => {
  const lf = useLangField();
  const t = useT();
  return accounts
    .filter((a) => Number(a.is_postable) === 1 && Number(a.status) === 1 && (!filter || filter(a)))
    .map((a) => ({
      value: a._uuid,
      label: `${a.account_code} ${lf(a, 'name')}`,
      code: a.account_code,
      name: lf(a, 'name'),
      group: a.account_group,
      groupLabel: t(groupOf(a.account_group).label),
    }));
};

export const accountOptionLabel = (_: unknown, item: any) => item && (
  <span className="acc-gl-opt">
    <AccountCode code={item.code} group={item.group} />
    <span>{item.name}</span>
  </span>
);

/** formatter ຂອງ NumberInput ຈຳນວນເງິນ — ຊ່ອງຫວ່າງຍັງຫວ່າງ (toThousands('') ໃຫ້ "0.00" ຈົນ placeholder ບໍ່ສະແດງ) */
export const amountFormatter = (value: unknown) => (value === '' || value === null || value === undefined ? '' : toThousands(value));

/** ປ້າຍປະເພດເອກະສານຕົ້ນທາງ */
export const SourceChip = ({ type }: { type: string }) => {
  const t = useT();
  const source = sourceOf(type);
  return (
    <span className={`acc-gl-source acc-tone ${source.tone}`}>
      <i className={`fa-solid ${source.icon}`} /> {t(source.label)}
    </span>
  );
};
