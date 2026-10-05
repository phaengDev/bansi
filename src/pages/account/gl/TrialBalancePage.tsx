import { useEffect, useMemo, useState } from 'react';
import { DateRangePicker, Loader, Toggle } from 'rsuite';
import moment from 'moment';
import AppPage from '../../../components/Elements/AppPage';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { useLangField, useT } from '../../../context/LanguageContext';
import { rangeOf, type Period, type Range } from '../journal/reportData';
import StatementDoc from '../statements/StatementDoc';
import { GROUPS, buildTree, flatten, isNotReady, money, rollup, type Balance, type ChartAccount } from './glApi';
import { AccountCode, GlNotReady, useChartAccounts } from './glKit';
import AccountLedgerModal from './AccountLedgerModal';

type Row = { account: ChartAccount; depth: number; opening: number; debit: number; credit: number; closing: number };

/** ຍອດ (ໜີ້ − ມີ) → ສອງຖັນ ໜີ້ / ມີ */
const split = (value: number) => (value >= 0 ? [value, 0] : [0, -value]);

/**
 * ງົບທົດລອງ — ທຸກບັນຊີ: ຍອດຍົກມາ, ການເຄື່ອນໄຫວໃນຊ່ວງ (ໜີ້/ມີ) ແລະ ຍອດທ້າຍງວດ.
 * ລວມໜີ້ = ລວມມີ ທຸກຖັນ ເມື່ອບັນຊີຖືກຕ້ອງ. ກົດແຖວ = ປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີນັ້ນ
 */
const TrialBalancePage = () => {
  const t = useT();
  const lf = useLangField();
  const { rows: accounts, notReady: chartNotReady } = useChartAccounts();
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(() => rangeOf('month'));
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const [showHeaders, setShowHeaders] = useState(true);
  const [hideZero, setHideZero] = useState(true);
  const [ledger, setLedger] = useState<ChartAccount | null>(null);

  const startKey = range.start.format('YYYY-MM-DD');
  const endKey = range.end.format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    setError('');
    postApi('/gl/balances', { start_date: startKey, end_date: endKey })
      .then((res) => !cancelled && setBalances(res.data?.data ?? []))
      .catch((err) => {
        if (cancelled) return;
        if (isNotReady(err)) setNotReady(true);
        else setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [startKey, endKey]);

  const rows = useMemo<Row[]>(() => {
    if (!balances) return [];
    const map = new Map(balances.map((b) => [b.account_id, b]));
    const roots = buildTree(accounts);
    const pick = (key: 'opening' | 'debit' | 'credit' | 'closing') => rollup(roots, (a) => map.get(a._uuid)?.[key] ?? 0);
    const opening = pick('opening');
    const debit = pick('debit');
    const credit = pick('credit');
    const closing = pick('closing');
    return flatten(roots)
      .filter((a) => showHeaders || Number(a.is_postable) === 1)
      .map((a) => ({
        account: a,
        depth: showHeaders ? a.depth : 0,
        opening: opening.get(a._uuid) ?? 0,
        debit: debit.get(a._uuid) ?? 0,
        credit: credit.get(a._uuid) ?? 0,
        closing: closing.get(a._uuid) ?? 0,
      }))
      .filter((r) => !hideZero || r.opening || r.debit || r.credit || r.closing);
  }, [balances, accounts, showHeaders, hideZero]);

  // ລວມສະເພາະບັນຊີລົງລາຍການ (ບັນຊີຫົວລວມລູກຢູ່ແລ້ວ — ນັບຊ້ຳບໍ່ໄດ້)
  const leaves = rows.filter((r) => Number(r.account.is_postable) === 1);
  const sum = (pick: (r: Row) => number) => leaves.reduce((n, r) => n + pick(r), 0);
  const total = {
    openingDr: sum((r) => split(r.opening)[0]),
    openingCr: sum((r) => split(r.opening)[1]),
    debit: sum((r) => r.debit),
    credit: sum((r) => r.credit),
    closingDr: sum((r) => split(r.closing)[0]),
    closingCr: sum((r) => split(r.closing)[1]),
  };
  const balanced = Math.abs(total.closingDr - total.closingCr) < 0.01 && Math.abs(total.debit - total.credit) < 0.01;

  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const periods: { key: Exclude<Period, 'custom'>; label: string }[] = [
    { key: 'month', label: t('mvThisMonth') },
    { key: 'lastMonth', label: t('mvLastMonth') },
    { key: 'quarter', label: t('rpThisQuarter') },
    { key: 'year', label: t('mvThisYear') },
  ];

  const exportRows = () => {
    const c = {
      code: t('glAccountCode'), name: t('glAccount'),
      od: `${t('glOpeningBalance')} ${t('glDebit')}`, oc: `${t('glOpeningBalance')} ${t('glCredit')}`,
      pd: `${t('glMovement')} ${t('glDebit')}`, pc: `${t('glMovement')} ${t('glCredit')}`,
      cd: `${t('glClosingBalance')} ${t('glDebit')}`, cc: `${t('glClosingBalance')} ${t('glCredit')}`,
    };
    const line = (code: string, name: string, o: number, d: number, cr: number, cl: number) => {
      const [od, oc] = split(o);
      const [cd, cc] = split(cl);
      return { [c.code]: code, [c.name]: name, [c.od]: od, [c.oc]: oc, [c.pd]: d, [c.pc]: cr, [c.cd]: cd, [c.cc]: cc };
    };
    exportExcel([
      ...rows.map((r) => line(r.account.account_code, `${'   '.repeat(r.depth)}${lf(r.account, 'name')}`, r.opening, r.debit, r.credit, r.closing)),
      {
        [c.code]: '', [c.name]: t('total'), [c.od]: total.openingDr, [c.oc]: total.openingCr,
        [c.pd]: total.debit, [c.pc]: total.credit, [c.cd]: total.closingDr, [c.cc]: total.closingCr,
      },
    ], `trial-balance_${startKey}_${endKey}`, `${t('accountAppTrialBalance')} ${rangeText} (LAK)`);
  };

  const body = notReady || chartNotReady ? <GlNotReady /> : error ? (
    <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
  ) : !balances ? (
    <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
  ) : (
    <StatementDoc title={t('accountAppTrialBalance')} period={`${t('fsForPeriod')} ${rangeText}`} unit="LAK" onExcel={exportRows}
      note={<>
        <p className={balanced ? 'acc-gl-ok' : 'acc-gl-bad'}>
          <i className={`fa-solid ${balanced ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {t(balanced ? 'glTbBalanced' : 'glTbUnbalanced')}
        </p>
        <p>{t('glTbNote')}</p>
      </>}
    >
      <div className="acc-rp-scroll">
        <table className="acc-gl-tb">
          <thead>
            <tr>
              <th rowSpan={2}>{t('glAccount')}</th>
              <th colSpan={2}>{t('glOpeningBalance')}<small>{range.start.format('DD/MM/YYYY')}</small></th>
              <th colSpan={2}>{t('glMovement')}<small>{rangeText}</small></th>
              <th colSpan={2}>{t('glClosingBalance')}<small>{range.end.format('DD/MM/YYYY')}</small></th>
            </tr>
            <tr>
              <th>{t('glDebit')}</th><th>{t('glCredit')}</th>
              <th>{t('glDebit')}</th><th>{t('glCredit')}</th>
              <th>{t('glDebit')}</th><th>{t('glCredit')}</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => {
              const groupRows = rows.filter((r) => r.account.account_group === g.value);
              if (!groupRows.length) return null;
              return groupRows.map((r) => {
                const header = Number(r.account.is_postable) === 0;
                const [od, oc] = split(r.opening);
                const [cd, cc] = split(r.closing);
                return (
                  <tr key={r.account._uuid} className={header ? 'is-header' : 'is-postable'} onClick={() => !header && setLedger(r.account)}>
                    <td style={{ paddingLeft: 10 + r.depth * 18 }}>
                      <AccountCode code={r.account.account_code} group={r.account.account_group} />
                      <span>{lf(r.account, 'name')}</span>
                    </td>
                    <td>{money(od)}</td><td>{money(oc)}</td>
                    <td>{money(r.debit)}</td><td>{money(r.credit)}</td>
                    <td className="is-strong">{money(cd)}</td><td className="is-strong">{money(cc)}</td>
                  </tr>
                );
              });
            })}
            {!rows.length && <tr className="is-empty"><td colSpan={7}>{t('rpEmpty')}</td></tr>}
          </tbody>
          <tfoot>
            <tr className={balanced ? '' : 'is-bad'}>
              <td>{t('total')}</td>
              <td>{money(total.openingDr)}</td><td>{money(total.openingCr)}</td>
              <td>{money(total.debit)}</td><td>{money(total.credit)}</td>
              <td>{money(total.closingDr)}</td><td>{money(total.closingCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </StatementDoc>
  );

  return (
    <AppPage title={t('accountAppTrialBalance')} subtitle={t('accountAppTrialBalance')} showHeader={false}>
      <div className="acc-rp acc-fs acc-gl">
        <div className="acc-rp-filters">
          <div className="acc-rp-filter-row">
            <div className="acc-type-segment" role="tablist">
              {periods.map((p) => (
                <button key={p.key} type="button" role="tab" aria-selected={period === p.key}
                  className={period === p.key ? 'is-active' : ''}
                  onClick={() => {
                    setPeriod(p.key);
                    setRange(rangeOf(p.key));
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="acc-gl-switch"><Toggle size="sm" checked={showHeaders} onChange={setShowHeaders} /> {t('glShowHeaders')}</label>
            <label className="acc-gl-switch"><Toggle size="sm" checked={hideZero} onChange={setHideZero} /> {t('glHideZero')}</label>
            <DateRangePicker className="acc-rp-range" format="dd/MM/yyyy" character=" – " cleanable={false} placement="bottomEnd"
              value={[range.start.toDate(), range.end.toDate()]}
              onChange={(value) => {
                if (!value) return;
                setPeriod('custom');
                setRange({ start: moment(value[0]).startOf('day'), end: moment(value[1]).endOf('day') });
              }}
            />
          </div>
        </div>
        {body}
      </div>
      {ledger && (
        <AccountLedgerModal account={ledger} range={[range.start.toDate(), range.end.toDate()]} onClose={() => setLedger(null)} />
      )}
    </AppPage>
  );
};

export default TrialBalancePage;
