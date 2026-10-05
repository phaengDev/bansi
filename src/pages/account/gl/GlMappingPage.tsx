import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader, SelectPicker } from 'rsuite';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { ROLES, isNotReady, type ChartAccount } from './glApi';
import { GlNotReady, accountOptionLabel, useAccountOptions, useChartAccounts } from './glKit';

type Mapping = { source_type: string; source_key: string; account_id: number };
type Category = { _uuid: number; type_code: string; type_name: string; typestatus: number; status: number };
type Treasury = {
  _uuid: number;
  acountName: string;
  acount_number?: string;
  status: number;
  isCash: boolean;
  banks?: { abbr?: string } | null;
  treasury?: { treasury_name?: string; currency?: { name: string } } | null;
};

const keyOf = (type: string, key: string | number) => `${type}:${key}`;

/**
 * ຜູກບັນຊີ — ບອກລະບົບວ່າເອກະສານແຕ່ລະແບບລົງບັນຊີໃດ:
 * ບົດບາດຂອງລະບົບ (ອາກອນ, ທຶນຍອດຍົກມາ, ບັນຊີເລີ່ມຕົ້ນ …), ປະເພດລາຍຮັບ-ລາຍຈ່າຍ ແລະ ບັນຊີເງິນຄັງ.
 * ອັນທີ່ບໍ່ຜູກ ໃຊ້ບັນຊີຂອງບົດບາດເລີ່ມຕົ້ນ (DEFAULT_*). ບັນທຶກເທື່ອດຽວທຸກອັນທີ່ປ່ຽນ
 */
const GlMappingPage = () => {
  const t = useT();
  const lf = useLangField();
  const { rows: accounts, notReady: chartNotReady } = useChartAccounts();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/gl-mapping/fetch');
      setMappings(res.data?.mappings ?? []);
      setCategories(res.data?.categories ?? []);
      setTreasuries(res.data?.treasuries ?? []);
      setDraft({});
    } catch (error) {
      if (isNotReady(error)) setNotReady(true);
      else Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saved = useMemo(() => new Map(mappings.map((m) => [keyOf(m.source_type, m.source_key), Number(m.account_id)])), [mappings]);
  const valueOf = (type: string, key: string | number) => {
    const k = keyOf(type, key);
    return k in draft ? draft[k] : saved.get(k) ?? null;
  };
  const setValue = (type: string, key: string | number, value: number | null) =>
    setDraft((prev) => ({ ...prev, [keyOf(type, key)]: value }));
  const changed = Object.entries(draft).filter(([k, v]) => (saved.get(k) ?? null) !== (v ?? null));

  const accountName = (id: number | null | undefined) => {
    const a = accounts.find((x) => x._uuid === id);
    return a ? `${a.account_code} · ${lf(a, 'name')}` : '—';
  };
  const roleAccount = (role: string) => valueOf('ROLE', role);

  const inGroups = (groups: number[]) => (a: ChartAccount) => groups.includes(Number(a.account_group));
  const assetOptions = useAccountOptions(accounts, inGroups([1]));
  const incomeOptions = useAccountOptions(accounts, inGroups([4, 2, 3]));
  const expenseOptions = useAccountOptions(accounts, inGroups([5, 1]));
  const allOptions = useAccountOptions(accounts);

  const save = async () => {
    if (!changed.length) return;
    try {
      setSaving(true);
      await postApi('/gl-mapping/save', {
        items: changed.map(([k, v]) => {
          const [source_type, source_key] = k.split(':');
          return { source_type, source_key, account_id: v };
        }),
      });
      Notific.success('saveSuccessDone');
      load();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (notReady || chartNotReady) return <GlNotReady />;
  if (loading && !mappings.length) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  // ຟັງຊັນ render (ບໍ່ແມ່ນ component ຊ້ອນ) — ບໍ່ດັ່ງນັ້ນ SelectPicker ຈະ mount ໃໝ່ທຸກເທື່ອທີ່ປ່ຽນຄ່າ
  const renderRow = ({ type, k, icon, title, sub, options, fallback, required }: {
    type: string;
    k: string | number;
    icon: ReactNode;
    title: ReactNode;
    sub?: ReactNode;
    options: ReturnType<typeof useAccountOptions>;
    fallback?: number | null;
    required?: boolean;
  }) => {
    const value = valueOf(type, k);
    const dirty = keyOf(type, k) in draft && (saved.get(keyOf(type, k)) ?? null) !== (value ?? null);
    return (
      <div key={keyOf(type, k)} className={`acc-gl-map-row${dirty ? ' is-dirty' : ''}`}>
        <span className="acc-gl-map-icon">{icon}</span>
        <span className="acc-gl-map-text">
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </span>
        <i className="fa-solid fa-arrow-right-long acc-gl-map-arrow" />
        <SelectPicker
          className="acc-gl-map-picker"
          data={options}
          value={value}
          groupBy="groupLabel"
          cleanable={!required}
          disabled={!canEdit}
          placeholder={fallback ? `${t('glUseDefault')}: ${accountName(fallback)}` : t('glChooseAccount')}
          renderOption={accountOptionLabel}
          renderValue={(_, item) => accountOptionLabel(_, item)}
          onChange={(v) => setValue(type, k, (v as number) ?? null)}
          popupClassName="acc-book-menu"
          block
        />
      </div>
    );
  };

  const incomeCats = categories.filter((c) => Number(c.typestatus) === 1);
  const expenseCats = categories.filter((c) => Number(c.typestatus) === 2);

  return (
    <div className="acs-page acc-gl">
      <div className="acc-gl-map-bar">
        <p><i className="fa-solid fa-circle-info" /> {t('glMappingIntro')}</p>
        <button type="button" className="acc-class-add" disabled={!changed.length || saving || !canEdit} onClick={save}>
          {saving ? <Loader size="xs" /> : <i className="fa-solid fa-floppy-disk" />} {t('save')}
          {changed.length > 0 && <em>{changed.length}</em>}
        </button>
      </div>

      <section className="acc-gl-map">
        <header><i className="fa-solid fa-gears" /> {t('glMapRoles')}<small>{t('glMapRolesHint')}</small></header>
        {ROLES.map((r) => renderRow({
          type: 'ROLE', k: r.key, required: true,
          icon: <i className="fa-solid fa-key" />, title: t(r.label), sub: t(r.hint),
          options: allOptions.filter((o) => (r.groups as readonly number[]).includes(o.group)),
        }))}
      </section>

      <section className="acc-gl-map">
        <header><i className="fa-solid fa-building-columns" /> {t('glMapTreasury')}<small>{t('glMapTreasuryHint')}</small></header>
        {treasuries.map((a) => renderRow({
          type: 'TREASURY_ACCOUNT', k: a._uuid,
          icon: <i className={`fa-solid ${a.isCash ? 'fa-money-bill-wave' : 'fa-building-columns'}`} />,
          title: a.acountName,
          sub: [a.banks?.abbr ?? (a.isCash ? t('glCash') : null), a.acount_number, a.treasury?.currency?.name].filter(Boolean).join(' · '),
          options: assetOptions,
          fallback: roleAccount(a.isCash ? 'DEFAULT_CASH' : 'DEFAULT_BANK'),
        }))}
        {!treasuries.length && <p className="acc-gl-map-empty">{t('noData')}</p>}
      </section>

      <section className="acc-gl-map">
        <header><i className="fa-solid fa-arrow-trend-up" /> {t('glMapIncome')}<small>{t('glMapIncomeHint')}</small></header>
        {incomeCats.map((c) => renderRow({
          type: 'FINANCE_CATEGORY', k: c._uuid,
          icon: <b>{c.type_code}</b>, title: c.type_name, sub: Number(c.status) === 1 ? undefined : t('inactive'),
          options: incomeOptions, fallback: roleAccount('DEFAULT_REVENUE'),
        }))}
        {!incomeCats.length && <p className="acc-gl-map-empty">{t('noData')}</p>}
      </section>

      <section className="acc-gl-map">
        <header><i className="fa-solid fa-arrow-trend-down" /> {t('glMapExpense')}<small>{t('glMapExpenseHint')}</small></header>
        {expenseCats.map((c) => renderRow({
          type: 'FINANCE_CATEGORY', k: c._uuid,
          icon: <b>{c.type_code}</b>, title: c.type_name, sub: Number(c.status) === 1 ? undefined : t('inactive'),
          options: expenseOptions, fallback: roleAccount('DEFAULT_EXPENSE'),
        }))}
        {!expenseCats.length && <p className="acc-gl-map-empty">{t('noData')}</p>}
      </section>
    </div>
  );
};

export default GlMappingPage;
