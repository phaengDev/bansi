import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker, Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber, getApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { useT } from '../../context/LanguageContext';
import { money, type LoanCurrency } from '../account/loans/loanApi';
import ContractDetail from './ContractDetail';
import { AGING_BUCKETS } from './creditApi';
import { DaysLateChip } from './collectKit';
import { AgingBars, MeterList, MonthColumns, SegmentBar, compact } from './creditCharts';

/** ສີຂອງຊຸດຂໍ້ມູນ (ກວດດ້ວຍ validate_palette ແລ້ວ) */
const SERIES = ['#257de0', '#f47230', '#00b894'];

type Money = number;
type CurrencyDash = {
  currency: LoanCurrency;
  portfolio: { contracts: number; customers: number; outstanding: Money; overdue_amount: Money; penalty_due: Money; disbursed_total: Money; closed: number };
  par: Record<'par1' | 'par30' | 'par90', { amount: Money; rate: number; contracts: number }>;
  aging: { key: string; contracts: number; outstanding: Money }[];
  period: {
    disbursed: { contracts: number; amount: Money; upfront_fee: Money };
    collected: { principal: Money; interest: Money; fee: Money; penalty: Money; total: Money };
    income: { interest: Money; fees: Money; penalty: Money; total: Money };
    waived: Money;
  };
  months: { month: string; disbursed: Money; collected: Money; income: Money }[];
  products: { name: string; contracts: number; outstanding: Money; overdue: Money }[];
  top_overdue: { _uuid: number; loan_code: string; customer: { name: string; phone: string | null } | null; days_overdue: number; overdue_amount: Money; outstanding: Money; penalty_due: Money }[];
};
type Dash = { data: CurrencyDash[]; from: string; to: string; company: { revenue: Money; expense: Money; profit: Money } };

type Preset = 'month' | 'last' | 'quarter' | 'year' | 'custom';
const rangeOf = (p: Preset): [string, string] => {
  const now = moment();
  if (p === 'last') return [now.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), now.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')];
  if (p === 'quarter') return [now.clone().startOf('quarter').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')];
  if (p === 'year') return [now.clone().startOf('year').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')];
  return [now.clone().startOf('month').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')];
};

/**
 * ພາບລວມສິນເຊື່ອ — ຍອດຄ້າງ, ປ່ອຍກູ້ / ຮັບຄືນ / ລາຍຮັບ ໃນຊ່ວງ, ກຳໄລຂອງບໍລິສັດ (ຈາກບັນຊີ), ຄຸນນະພາບໜີ້ (PAR 1/30/90),
 * ອາຍຸໜີ້, 12 ເດືອນ, ລາຍຮັບແຍກປະເພດ, ຕາມຜະລິດຕະພັນ ແລະ ສັນຍາທີ່ກາຍກຳນົດດົນສຸດ
 */
const CreditOverview = () => {
  const t = useT();
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState<[string, string]>(() => rangeOf('month'));
  const [dash, setDash] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currencyKey, setCurrencyKey] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(`/credit/dashboard?from=${range[0]}&to=${range[1]}`);
      setDash(res.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => {
    load();
  }, [load]);

  const pickPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeOf(p));
  };

  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!dash) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  const d = dash.data.find((x) => (x.currency?.name ?? 'LAK') === currencyKey) ?? dash.data[0];
  const presets: { key: Preset; label: string }[] = [
    { key: 'month', label: t('crThisMonth') }, { key: 'last', label: t('crLastMonth') },
    { key: 'quarter', label: t('crThisQuarter') }, { key: 'year', label: t('crThisYear') },
  ];

  return (
    <div className={`acs-page cr-page cr-overview${loading ? ' is-loading' : ''}`}>
      {/* ---- ຕົວກັ່ນ: ຊ່ວງເວລາ (ກ່ຽວກັບທຸກຢ່າງລຸ່ມນີ້) ---- */}
      <div className="cr-filters">
        <div className="acc-type-segment" role="tablist">
          {presets.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={preset === p.key} className={preset === p.key ? 'is-active' : ''} onClick={() => pickPreset(p.key)}>{p.label}</button>
          ))}
        </div>
        <DateRangePicker size="md" format="dd/MM/yyyy" cleanable={false} character=" – "
          value={[moment(range[0]).toDate(), moment(range[1]).toDate()]}
          onChange={(v) => { if (v) { setPreset('custom'); setRange([moment(v[0]).format('YYYY-MM-DD'), moment(v[1]).format('YYYY-MM-DD')]); } }}
        />
        {dash.data.length > 1 && (
          <div className="acc-type-segment" role="tablist">
            {dash.data.map((x) => {
              const key = x.currency?.name ?? 'LAK';
              return <button key={key} type="button" role="tab" aria-selected={d === x} className={d === x ? 'is-active' : ''} onClick={() => setCurrencyKey(key)}>{key}</button>;
            })}
          </div>
        )}
      </div>

      {!d ? (
        <div className="acc-class-empty acc-fa-empty"><i className="fa-solid fa-chart-pie" /><p><b>{t('crNoContracts')}</b><br />{t('crNoContractsHint')}</p></div>
      ) : (
        <>
          {/* ---- ຕົວເລກຫຼັກ ---- */}
          <div className="cr-kpis">
            <div className="cr-kpi is-hero">
              <small>{t('crPortfolio')}</small>
              <b>{money(d.portfolio.outstanding, d.currency)}</b>
              <em>{t('crPortfolioSub').replace('{c}', String(d.portfolio.contracts)).replace('{u}', String(d.portfolio.customers))}</em>
            </div>
            <div className="cr-kpi">
              <small><i className="fa-solid fa-money-bill-transfer" /> {t('crDisbursedPeriod')}</small>
              <b>{money(d.period.disbursed.amount, d.currency)}</b>
              <em>{d.period.disbursed.contracts} {t('crContracts')}</em>
            </div>
            <div className="cr-kpi">
              <small><i className="fa-solid fa-hand-holding-dollar" /> {t('crCollectedPeriod')}</small>
              <b>{money(d.period.collected.total, d.currency)}</b>
              <em>{t('lnPrincipalShort')} {compact(d.period.collected.principal)}</em>
            </div>
            <div className="cr-kpi is-good">
              <small><i className="fa-solid fa-coins" /> {t('crIncomePeriod')}</small>
              <b>{money(d.period.income.total, d.currency)}</b>
              <em>{t('crIncomeKinds')}</em>
            </div>
            <div className={`cr-kpi${dash.company.profit < 0 ? ' is-bad' : ' is-good'}`}>
              <small><i className="fa-solid fa-scale-balanced" /> {t('crCompanyProfit')}</small>
              <b>₭ {formatNumber(Math.round(dash.company.profit))}</b>
              <em>{t('crCompanyProfitSub').replace('{r}', compact(dash.company.revenue)).replace('{e}', compact(dash.company.expense))}</em>
            </div>
          </div>

          <div className="cr-grid">
            <section className="cr-card">
              <header><b>{t('crQuality')}</b><small>{t('crQualityHint')}</small></header>
              <MeterList rows={[
                { label: 'PAR 1', hint: t('crPar1Hint'), rate: d.par.par1.rate, amount: `${compact(d.par.par1.amount)} · ${d.par.par1.contracts} ${t('crContracts')}`, warn: 10, bad: 20 },
                { label: 'PAR 30', hint: t('crPar30Hint'), rate: d.par.par30.rate, amount: `${compact(d.par.par30.amount)} · ${d.par.par30.contracts} ${t('crContracts')}`, warn: 5, bad: 10 },
                { label: 'PAR 90', hint: t('crPar90Hint'), rate: d.par.par90.rate, amount: `${compact(d.par.par90.amount)} · ${d.par.par90.contracts} ${t('crContracts')}`, warn: 3, bad: 5 },
              ]}
              />
              <dl className="cr-mini-stats">
                <div><dt>{t('crOverdueAmount')}</dt><dd>{money(d.portfolio.overdue_amount, d.currency)}</dd></div>
                <div><dt>{t('crPenaltyDue')}</dt><dd>{money(d.portfolio.penalty_due, d.currency)}</dd></div>
                <div><dt>{t('crWaivedPeriod')}</dt><dd>{money(d.period.waived, d.currency)}</dd></div>
              </dl>
            </section>
            <section className="cr-card">
              <header><b>{t('crAgingTitle')}</b><small>{t('crAgingHint')}</small></header>
              <AgingBars rows={AGING_BUCKETS.map((b) => {
                const row = d.aging.find((a) => a.key === b.key);
                return { key: b.key, label: t(b.label), contracts: row?.contracts ?? 0, amount: row?.outstanding ?? 0 };
              })}
              />
            </section>
          </div>

          <div className="cr-grid">
            <MonthColumns title={t('crMonthlyFlow')} hint={t('crMonthlyFlowHint')} months={d.months.map((m) => m.month)} series={[
              { key: 'disbursed', label: t('crDisbursedShort'), color: SERIES[0], values: d.months.map((m) => m.disbursed) },
              { key: 'collected', label: t('crCollectedShort'), color: SERIES[1], values: d.months.map((m) => m.collected) },
            ]}
            />
            <MonthColumns title={t('crIncomeByMonth')} hint={t('crIncomeKinds')} months={d.months.map((m) => m.month)} series={[
              { key: 'income', label: t('crIncomePeriod'), color: SERIES[0], values: d.months.map((m) => m.income) },
            ]}
            />
          </div>

          <div className="cr-grid">
            <section className="cr-card">
              <header><b>{t('crIncomeSplitTitle')}</b><small>{moment(dash.from).format('DD/MM/YYYY')} – {moment(dash.to).format('DD/MM/YYYY')}</small></header>
              <SegmentBar parts={[
                { key: 'interest', label: t('lnInterestShort'), value: d.period.income.interest, color: SERIES[0] },
                { key: 'fees', label: t('crFees'), value: d.period.income.fees, color: SERIES[1] },
                { key: 'penalty', label: t('crPenalty'), value: d.period.income.penalty, color: SERIES[2] },
              ]} empty={t('crNoIncomePeriod')}
              />
              <header className="is-sub"><b>{t('crByProduct')}</b></header>
              {d.products.length ? (
                <table className="acc-fs-table cr-mini-table">
                  <thead><tr><th>{t('crProduct')}</th><th>{t('crContracts')}</th><th>{t('lnOutstanding')}</th><th>{t('lnOverdue')}</th></tr></thead>
                  <tbody>
                    {d.products.map((p) => (
                      <tr key={p.name}><td>{p.name}</td><td>{p.contracts}</td><td>{formatNumber(p.outstanding)}</td><td>{p.overdue ? formatNumber(p.overdue) : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="cr-muted">—</p>}
            </section>
            <section className="cr-card">
              <header><b>{t('crTopOverdue')}</b><small>{t('crTopOverdueHint')}</small></header>
              {d.top_overdue.length ? (
                <ul className="cr-top">
                  {d.top_overdue.map((c) => (
                    <li key={c._uuid}>
                      <button type="button" onClick={() => setViewing(c._uuid)}>
                        <span><b>{c.customer?.name ?? c.loan_code}</b><small>{[c.loan_code, c.customer?.phone].filter(Boolean).join(' · ')}</small></span>
                        <DaysLateChip days={c.days_overdue} />
                        <span className="cr-top-amount"><b>{formatNumber(c.overdue_amount)}</b>{c.penalty_due > 0 && <small>+ {t('crPenalty')} {formatNumber(c.penalty_due)}</small>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-circle-check" /><p>{t('crNoOverdue')}</p></div>}
            </section>
          </div>
        </>
      )}
      {viewing && <ContractDetail id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
};

export default CreditOverview;
