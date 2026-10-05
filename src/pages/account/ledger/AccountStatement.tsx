import { useEffect, useMemo, useState } from 'react';
import { Drawer, Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import type { TreasuryAccount } from './TreasuryAccountForm';
import { currencySymbol } from './currency';

type Direction = 'in' | 'out';

/** ແຖວຈາກ POST /transfer-money/statement — balance_before/after ເປັນ null ສຳລັບລາຍການເກົ່າທີ່ບໍ່ໄດ້ເກັບຍອດກ່ອນໂອນ */
type StatementRow = {
  _uuid: string;
  createdAt: string;
  direction: Direction;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
  createby: string | null;
  counterpart: {
    _uuid: number;
    acountName: string;
    acount_number?: string;
    /** ຕົວຫຍໍ້ທະນາຄານ (ບໍ່ມີກໍ່ເປັນຊື່) */
    bank?: string | null;
    bank_name?: string | null;
    /** URL ເຕັມຂອງໂລໂກ້ທະນາຄານຂອງບັນຊີຄູ່ໂອນ — ບັນຊີເງິນສົດ (ບໍ່ຜູກທະນາຄານ) ເປັນ null */
    bank_logo?: string | null;
    type_name?: string | null;
  } | null;
};

type MonthSummary = { month: number; in: number; out: number; inCount: number; outCount: number };

/** history = ທຸກລາຍການ, in / out = ສະເພາະເງິນເຂົ້າ / ສະເພາະເງິນອອກ, monthly = ກຣາຟ + ຕາຕະລາງລາຍເດືອນ */
type Tab = 'history' | 'monthly' | Direction;

/** 4,535,000 → 4.5M — ສະເພາະປ້າຍແກນຂອງກຣາຟ, ຕົວເລກອື່ນສະແດງເຕັມ */
const compact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * ປະຫວັດເງິນເຂົ້າ-ອອກ ຂອງບັນຊີເງິນຄັງດຽວ (ເປີດຈາກບັດໃນປຶ້ມບັນຊີໃຫຍ່) — ຂໍ້ມູນຈາກ tbl_transfer_money
 * ທີ່ບັນຊີນີ້ເປັນຝ່າຍໂອນອອກ ຫຼື ຝ່າຍຮັບ. ເລືອກປີ → ສະຫຼຸບ (ເຂົ້າ/ອອກ/ສຸດທິ), ແທັບ ປະຫວັດ (ຈັດກຸ່ມຕາມມື້)
 * ແລະ ສະຫຼຸບລາຍເດືອນ (ກຣາຟເງິນເຂົ້າຂຶ້ນ / ເງິນອອກລົງ + ຕາຕະລາງ). ກົດເດືອນ = ກັ່ນປະຫວັດສະເພາະເດືອນນັ້ນ.
 * ຈັດກຸ່ມເດືອນ/ມື້ ຕາມເວລາຂອງ browser — ກົງກັບເວລາທີ່ສະແດງ
 */
const AccountStatement = ({ account, type, onClose }: {
  account: TreasuryAccount;
  type?: AccountType;
  onClose: () => void;
}) => {
  const t = useT();
  const cur = type?.currency;
  const symbol = currencySymbol(cur);
  const bank = account.banks;
  const balance = Number(account.balance_treasury ?? 0) + Number(account.balance_unable ?? 0);

  /** ປີທີ່ຂໍ — undefined = ໃຫ້ backend ເລືອກປີລ່າສຸດທີ່ມີການເຄື່ອນໄຫວ */
  const [requestedYear, setRequestedYear] = useState<number | undefined>();
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('history');
  /** ເດືອນທີ່ກັ່ນ (1–12) — null = ທັງປີ */
  const [month, setMonth] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    postApi('/transfer-money/statement', { account_id: account._uuid, year: requestedYear })
      .then((res) => {
        if (cancelled) return;
        setYear(res.data?.year ?? null);
        setYears(res.data?.years ?? []);
        setRows(res.data?.data ?? []);
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
  }, [account._uuid, requestedYear]);

  const months = useMemo(() => {
    const list: MonthSummary[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, in: 0, out: 0, inCount: 0, outCount: 0 }));
    rows.forEach((r) => {
      const m = list[moment(r.createdAt).month()];
      if (r.direction === 'in') {
        m.in += r.amount;
        m.inCount += 1;
      } else {
        m.out += r.amount;
        m.outCount += 1;
      }
    });
    return list;
  }, [rows]);

  const scoped = month == null ? rows : rows.filter((r) => moment(r.createdAt).month() + 1 === month);
  const totalIn = scoped.filter((r) => r.direction === 'in').reduce((n, r) => n + r.amount, 0);
  const totalOut = scoped.filter((r) => r.direction === 'out').reduce((n, r) => n + r.amount, 0);
  const countIn = scoped.filter((r) => r.direction === 'in').length;
  const countOut = scoped.length - countIn;
  /** ລາຍການທີ່ສະແດງໃນແທັບປະຫວັດ — ແທັບ ເງິນເຂົ້າ/ເງິນອອກ ກັ່ນຕາມທິດທາງ */
  const listed = tab === 'in' || tab === 'out' ? scoped.filter((r) => r.direction === tab) : scoped;
  const net = totalIn - totalOut;
  const scopeLabel = month == null ? `${t('stmtYear')} ${year ?? ''}` : `${t('stmtMonth')} ${pad2(month)}/${year}`;

  /** ປະຫວັດຈັດກຸ່ມຕາມມື້ (rows ມາໃໝ່ສຸດກ່ອນແລ້ວ) */
  const days = useMemo(() => {
    const map = new Map<string, StatementRow[]>();
    listed.forEach((r) => {
      const key = moment(r.createdAt).format('DD/MM/YYYY');
      map.set(key, [...(map.get(key) ?? []), r]);
    });
    return [...map.entries()];
  }, [listed]);

  const max = Math.max(1, ...months.map((m) => Math.max(m.in, m.out)));
  const activeMonths = months.filter((m) => m.inCount + m.outCount > 0);

  const pickYear = (value: number) => {
    setMonth(null);
    setRequestedYear(value);
  };
  /** ກົດເດືອນໃນກຣາຟ/ຕາຕະລາງ → ໄປແທັບປະຫວັດ ກັ່ນສະເພາະເດືອນນັ້ນ (ກົດຊ້ຳ = ຍົກເລີກ) */
  const pickMonth = (value: number) => {
    setMonth((current) => (current === value ? null : value));
    setTab('history');
  };

  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();

  return (
    <Drawer open onClose={onClose} size="md" placement="right" className="acc-stmt-drawer">
      <Drawer.Header>
        <div className="acc-stmt-head">
          <span className="acc-stmt-logo">
            {bank?.url ? <img src={bank.url} alt={bank.abbr ?? ''} /> : <i className="fa-solid fa-wallet" />}
          </span>
          <span className="acc-stmt-title">
            <Drawer.Title>{account.acountName}</Drawer.Title>
            <small>
              {[account.acount_number, bank?.abbr, type?.treasury_name].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className="acc-stmt-balance">
            <small>{t('stmtBalanceNow')}</small>
            <b className={balance < 0 ? 'is-negative' : ''}>{money(balance)}</b>
          </span>
        </div>
      </Drawer.Header>

      <Drawer.Body className="acc-stmt-body">
        {/* ---- ຕົວກັ່ນຕອງ: ປີ + ເດືອນທີ່ເລືອກ ---- */}
        <div className="acc-stmt-filters">
          <div className="acc-type-segment" role="tablist" aria-label={t('stmtYear')}>
            {years.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === year}
                className={y === year ? 'is-active' : ''} onClick={() => pickYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          {month != null && (
            <button type="button" className="acc-stmt-chip" onClick={() => setMonth(null)}>
              {t('stmtMonth')} {pad2(month)}/{year} <i className="fa-solid fa-xmark" />
            </button>
          )}
          <span className="acc-stmt-scope">{scopeLabel}</span>
        </div>

        {/* ---- ສະຫຼຸບ ---- */}
        <div className="acc-stmt-kpis">
          <div className="acc-stmt-kpi is-in">
            <small><i /> {t('stmtIn')}</small>
            <b>{money(totalIn)}</b>
            <em>{countIn} {t('stmtItems')}</em>
          </div>
          <div className="acc-stmt-kpi is-out">
            <small><i /> {t('stmtOut')}</small>
            <b>{money(totalOut)}</b>
            <em>{countOut} {t('stmtItems')}</em>
          </div>
          <div className="acc-stmt-kpi is-net">
            <small>
              <span className={net < 0 ? 'is-down' : 'is-up'}>
                <i className={`fa-solid ${net < 0 ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up'}`} />
              </span>
              {t('stmtNet')}
            </small>
            <b>{net > 0 ? '+' : net < 0 ? '−' : ''}{money(Math.abs(net))}</b>
            <em>{scoped.length} {t('stmtItems')}</em>
          </div>
        </div>

        <div className="acc-stmt-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'is-active' : ''}
            onClick={() => setTab('history')}
          >
            <i className="fa-solid fa-clock-rotate-left" /> {t('stmtHistory')} <em>{scoped.length}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'monthly'} className={tab === 'monthly' ? 'is-active' : ''}
            onClick={() => setTab('monthly')}
          >
            <i className="fa-solid fa-chart-column" /> {t('stmtMonthly')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'in'} className={`is-in${tab === 'in' ? ' is-active' : ''}`}
            onClick={() => setTab('in')}
          >
            <i className="fa-solid fa-arrow-down" /> {t('stmtOnlyIn')} <em>{countIn}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'out'} className={`is-out${tab === 'out' ? ' is-active' : ''}`}
            onClick={() => setTab('out')}
          >
            <i className="fa-solid fa-arrow-up" /> {t('stmtOnlyOut')} <em>{countOut}</em>
          </button>
        </div>

        {loading && !rows.length ? (
          <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : error ? (
          <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
        ) : (
          // ໂຫຼດປີໃໝ່ — ຄ້າງຂໍ້ມູນເກົ່າໄວ້ແບບຈາງ ບໍ່ກະພິບ
          <div className={`acc-stmt-content${loading ? ' is-refreshing' : ''}`}>
            {tab !== 'monthly' ? (
              days.length ? (
                days.map(([day, items]) => (
                  <section key={day} className="acc-stmt-day">
                    <h5>{day}</h5>
                    <ul>
                      {items.map((r) => {
                        const isIn = r.direction === 'in';
                        const other = r.counterpart;
                        return (
                          <li key={r._uuid} className={`acc-stmt-row is-${r.direction}`}>
                            {/* ໂລໂກ້ທະນາຄານຂອງບັນຊີຄູ່ໂອນ (ອາດເປັນຕ່າງທະນາຄານ) + ປ້າຍລູກສອນ ເຂົ້າ/ອອກ ຢູ່ມຸມ */}
                            <span className="acc-stmt-party" title={other?.bank_name ?? t('treasuryNoBank')}>
                              {other?.bank_logo
                                ? <img src={other.bank_logo} alt={other.bank ?? ''} />
                                : <i className="fa-solid fa-wallet" aria-hidden="true" />}
                              <em className="acc-stmt-dir" aria-hidden="true">
                                <i className={`fa-solid ${isIn ? 'fa-arrow-down' : 'fa-arrow-up'}`} />
                              </em>
                            </span>
                            <span className="acc-stmt-main">
                              <b>
                                <em>{t(isIn ? 'stmtFrom' : 'stmtTo')}</em>{' '}
                                {other ? other.acountName : t('stmtDeletedAccount')}
                              </b>
                              <small>
                                {[other ? other.bank ?? t('treasuryNoBank') : null, other?.acount_number, moment(r.createdAt).format('HH:mm')].filter(Boolean).join(' · ')}
                                {r.createby && ` · ${t('stmtBy')} ${r.createby}`}
                              </small>
                              {r.description && <p>{r.description}</p>}
                            </span>
                            <span className="acc-stmt-amount">
                              <b>{isIn ? '+' : '−'}{formatNumber(r.amount)}</b>
                              {r.balance_after != null && (
                                <small>{t('stmtBalanceAfter')} {formatNumber(r.balance_after)}</small>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              ) : (
                <div className="acc-class-empty"><i className="fa-solid fa-money-bill-transfer" /><p>{t('stmtEmpty')}</p></div>
              )
            ) : (
              <>
                {/* ກຣາຟ: ເງິນເຂົ້າຂຶ້ນຈາກເສັ້ນ 0, ເງິນອອກລົງ — ຄ່າທຸກເດືອນຢູ່ tooltip ແລະ ຕາຕະລາງລຸ່ມ */}
                <figure className="acc-stmt-chart">
                  <figcaption>
                    <span>{t('stmtChartLabel')} · {year}</span>
                    <span className="acc-stmt-legend">
                      <span><i className="is-in" /> {t('stmtIn')}</span>
                      <span><i className="is-out" /> {t('stmtOut')}</span>
                    </span>
                  </figcaption>
                  <div className="acc-stmt-plot">
                    <span className="acc-stmt-tick is-top">{compact(max)}</span>
                    <span className="acc-stmt-tick is-zero">0</span>
                    <span className="acc-stmt-tick is-bottom">{compact(max)}</span>
                    <div className="acc-stmt-cols">
                      {months.map((m) => {
                        const label = `${pad2(m.month)}/${year}`;
                        return (
                          <button key={m.month} type="button"
                            className={`acc-stmt-col${month === m.month ? ' is-selected' : ''}${m.inCount + m.outCount ? '' : ' is-empty'}`}
                            aria-label={`${label}: ${t('stmtIn')} ${formatNumber(m.in)}, ${t('stmtOut')} ${formatNumber(m.out)}`}
                            onClick={() => pickMonth(m.month)}
                          >
                            <span className="acc-stmt-half is-in">
                              {m.in > 0 && <i style={{ height: `max(2px, ${(m.in / max) * 100}%)` }} />}
                            </span>
                            <span className="acc-stmt-half is-out">
                              {m.out > 0 && <i style={{ height: `max(2px, ${(m.out / max) * 100}%)` }} />}
                            </span>
                            <small>{m.month}</small>
                            <span className="acc-stmt-tip" role="tooltip">
                              <strong>{label}</strong>
                              <span><i className="is-in" /><b>+{formatNumber(m.in)}</b> {t('stmtIn')}</span>
                              <span><i className="is-out" /><b>−{formatNumber(m.out)}</b> {t('stmtOut')}</span>
                              <span className="is-net"><b>{formatNumber(m.in - m.out)}</b> {t('stmtNet')}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </figure>

                {activeMonths.length ? (
                  <table className="acc-stmt-table">
                    <thead>
                      <tr>
                        <th>{t('stmtMonth')}</th>
                        <th>{t('stmtIn')}</th>
                        <th>{t('stmtOut')}</th>
                        <th>{t('stmtNet')}</th>
                        <th>{t('stmtItems')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMonths.map((m) => (
                        <tr key={m.month} className={month === m.month ? 'is-selected' : ''} onClick={() => pickMonth(m.month)}>
                          <td>{pad2(m.month)}/{year}</td>
                          <td>{formatNumber(m.in)}</td>
                          <td>{formatNumber(m.out)}</td>
                          <td className={m.in - m.out < 0 ? 'is-negative' : ''}>{formatNumber(m.in - m.out)}</td>
                          <td>{m.inCount + m.outCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>{t('total')}</td>
                        <td>{formatNumber(activeMonths.reduce((n, m) => n + m.in, 0))}</td>
                        <td>{formatNumber(activeMonths.reduce((n, m) => n + m.out, 0))}</td>
                        <td>{formatNumber(activeMonths.reduce((n, m) => n + m.in - m.out, 0))}</td>
                        <td>{rows.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="acc-class-empty"><i className="fa-solid fa-chart-column" /><p>{t('stmtEmpty')}</p></div>
                )}
              </>
            )}
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
};

export default AccountStatement;
