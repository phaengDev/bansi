import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DateRangePicker, Loader } from 'rsuite';
import moment from 'moment';
import AppPage from '../../../components/Elements/AppPage';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { useT } from '../../../context/LanguageContext';
import { STATEMENTS_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import type { Income } from '../journal/IncomeForm';
import type { Expense } from '../journal/ExpenseForm';
import { fromExpense, fromIncome, previousRange, rangeOf, type Entry, type Period, type Range } from '../journal/reportData';
import { currenciesOf, fromPartnerPayment, type Transfer } from './statementData';
import type { PartnerPayment } from '../arap/arapApi';
import ProfitLoss from './ProfitLoss';
import CashFlow from './CashFlow';
import BalanceSheet from './BalanceSheet';

/** ຂໍ້ມູນທີ່ທຸກໃບໃຊ້ຮ່ວມກັນ */
export type StatementData = {
  range: Range;
  prev: Range;
  incomes: Entry[];
  expenses: Entry[];
  accounts: TreasuryAccount[];
  transfers: Transfer[];
  /** ຮັບຊຳລະຈາກລູກໜີ້ / ຈ່າຍຊຳລະເຈົ້າໜີ້ — ໃຊ້ສະເພາະໃບກະແສເງິນສົດ */
  receipts: Entry[];
  payments: Entry[];
  currency: string | null;
  symbol: string;
};

/**
 * ໜ້າຕ່າງ ລາຍງານການເງິນ — ແຖບຊ້າຍເລືອກໃບ (ຜົນດຳເນີນງານ / ກະແສເງິນສົດ), ຊ່ວງເວລາ ແລະ ສະກຸນເງິນ ໃຊ້ຮ່ວມກັນທຸກໃບ.
 * ດຶງເທື່ອດຽວ: ລາຍຮັບ + ລາຍຈ່າຍ ຕັ້ງແຕ່ຕົ້ນຊ່ວງກ່ອນ ຮອດມື້ນີ້ (ຊ່ວງກ່ອນ = ທຽບ, ຫຼັງທ້າຍງວດ = ຄິດຍອດທ້າຍງວດຍ້ອນຫຼັງ),
 * ບັນຊີເງິນຄັງ (ຍອດປັດຈຸບັນ) ແລະ ການໂອນ. ບໍ່ມີ API ລາຍງານແຍກ
 */
const FinancialStatementsPage = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(STATEMENTS_MENU, t), [t]);
  const [activeKey, setActiveKey] = useState(firstRailKey(STATEMENTS_MENU));
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(() => rangeOf('month'));
  const [currency, setCurrency] = useState<string | null>(null);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [settlements, setSettlements] = useState<PartnerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const prev = previousRange(period, range);
  const startKey = range.start.format('YYYY-MM-DD');
  const endKey = range.end.format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    // ສົ່ງເປັນ string "YYYY-MM-DD" — ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date
    const to = moment.max(range.end.clone(), moment()).format('YYYY-MM-DD');
    const span = { start_date: prev.start.format('YYYY-MM-DD'), end_date: to };
    setLoading(true);
    setError('');
    Promise.all([
      postApi('/income/fetch', span),
      postApi('/expense/fetch', span),
      postApi('/treasury-account/fetch', {}),
      postApi('/transfer-money/fetch', { start_date: startKey, end_date: to }, { params: { limit: 100000 } }),
      // ລູກໜີ້-ເຈົ້າໜີ້ ຍັງບໍ່ເປີດໃຊ້ (503) = ບໍ່ມີລາຍການ
      postApi('/partner-payment/fetch', span).catch(() => ({ data: { data: [] } })),
    ])
      .then(([inc, exp, acc, tr, pay]) => {
        if (cancelled) return;
        setIncomes((inc.data?.data ?? []).map((r: Income) => fromIncome(r)));
        setExpenses((exp.data?.data ?? []).map((r: Expense) => fromExpense(r)));
        setAccounts(acc.data?.data ?? []);
        setTransfers(tr.data?.data ?? []);
        setSettlements(pay.data?.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startKey, endKey]);

  const pickPeriod = (value: Exclude<Period, 'custom'>) => {
    setPeriod(value);
    setRange(rangeOf(value));
  };

  const currencies = currenciesOf([...incomes, ...expenses], accounts);
  const curKey = currency && currencies.some((c) => c.key === currency) ? currency : currencies[0]?.key ?? null;
  const symbol = currencies.find((c) => c.key === curKey)?.symbol ?? '';

  const receipts = settlements.filter((p) => Number(p.pay_kind) === 1).map((p) => fromPartnerPayment(p, t('fsArCollections')));
  const payments = settlements.filter((p) => Number(p.pay_kind) === 2).map((p) => fromPartnerPayment(p, t('fsApSettlements')));
  const data: StatementData = { range, prev, incomes, expenses, accounts, transfers, receipts, payments, currency: curKey, symbol };
  const pages: Record<string, ReactNode> = {
    profitLoss: <ProfitLoss data={data} />,
    cashFlow: <CashFlow data={data} />,
    balanceSheet: <BalanceSheet data={data} />,
  };
  const periods: { key: Exclude<Period, 'custom'>; label: string }[] = [
    { key: 'month', label: t('mvThisMonth') },
    { key: 'lastMonth', label: t('mvLastMonth') },
    { key: 'quarter', label: t('rpThisQuarter') },
    { key: 'year', label: t('mvThisYear') },
  ];
  const active = railNav.find((item) => item.key === activeKey);

  return (
    <AppPage
      title={active?.label ?? t('accountAppFinancialStatements')}
      subtitle={t('accountAppFinancialStatements')}
      showHeader={false}
      railNav={railNav}
      railActiveKey={activeKey}
      onRailSelect={setActiveKey}
    >
      <div className="acc-rp acc-fs">
        {/* ---- ຊ່ວງເວລາ + ສະກຸນເງິນ (ໃຊ້ຮ່ວມກັນທຸກໃບ) ---- */}
        <div className="acc-rp-filters">
          <div className="acc-rp-filter-row">
            <div className="acc-type-segment" role="tablist">
              {periods.map((p) => (
                <button key={p.key} type="button" role="tab" aria-selected={period === p.key}
                  className={period === p.key ? 'is-active' : ''} onClick={() => pickPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {currencies.length > 1 && (
              <div className="acc-type-segment" role="tablist" aria-label={t('accountTypeCurrency')}>
                {currencies.map((c) => (
                  <button key={c.key} type="button" role="tab" aria-selected={curKey === c.key}
                    className={curKey === c.key ? 'is-active' : ''} onClick={() => setCurrency(c.key)}
                  >
                    {c.symbol && c.symbol !== c.key ? `${c.symbol} ` : ''}{c.key}
                  </button>
                ))}
              </div>
            )}
            <DateRangePicker
              className="acc-rp-range"
              format="dd/MM/yyyy"
              character=" – "
              cleanable={false}
              placement="bottomEnd"
              value={[range.start.toDate(), range.end.toDate()]}
              onChange={(value) => {
                if (!value) return;
                setPeriod('custom');
                setRange({ start: moment(value[0]).startOf('day'), end: moment(value[1]).endOf('day') });
              }}
            />
          </div>
        </div>

        {loading && !accounts.length ? (
          <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : error ? (
          <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
        ) : (
          <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>{pages[activeKey]}</div>
        )}
      </div>
    </AppPage>
  );
};

export default FinancialStatementsPage;
