import { useEffect, useMemo, useState } from 'react';
import { DateRangePicker, Drawer, Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import type { TreasuryAccount } from './TreasuryAccountForm';
import { currencySymbol } from './currency';

const MOVE_IN = 1;
const KIND_USABLE = 1;
const KIND_HELD = 2;
type Kind = typeof KIND_USABLE | typeof KIND_HELD;

/** ແຖວຈາກ POST /account-movement/fetch (tbl_account_movement) — ລຽງໃໝ່ສຸດກ່ອນຕາມລຳດັບທີ່ບັນທຶກ */
type MovementRow = {
  _uuid: number;
  movement_date: string;
  createdAt: string;
  direction: number;
  balance_kind: number;
  amount: number;
  balance_before: number;
  balance_after: number;
  source_type: string;
  doc_number: string | null;
  description: string | null;
  created_by_name: string | null;
  counterpart: {
    _uuid: number;
    acountName: string;
    acount_number?: string;
    banks?: { abbr?: string; name_la?: string; url?: string | null } | null;
  } | null;
};

type KindSummary = { kind: Kind; opening: number; in: number; out: number; closing: number; count: number };

type Period = 'month' | 'lastMonth' | 'year' | 'all' | 'custom';
type Range = [Date, Date];

/** ປ້າຍ + icon + ສີ ຂອງແຕ່ລະທີ່ມາ — ທີ່ມາໃໝ່ທີ່ຍັງບໍ່ຮູ້ຈັກ ສະແດງລະຫັດດິບ */
const SOURCES: Record<string, { icon: string; tone: string }> = {
  OPENING: { icon: 'fa-flag', tone: 'is-neutral' },
  INCOME: { icon: 'fa-hand-holding-dollar', tone: 'is-in' },
  INCOME_CANCEL: { icon: 'fa-ban', tone: 'is-cancel' },
  EXPENSE: { icon: 'fa-file-invoice-dollar', tone: 'is-out' },
  EXPENSE_CANCEL: { icon: 'fa-ban', tone: 'is-cancel' },
  TRANSFER_IN: { icon: 'fa-arrow-right-to-bracket', tone: 'is-xfer' },
  TRANSFER_OUT: { icon: 'fa-arrow-right-from-bracket', tone: 'is-xfer' },
  AR_RECEIPT: { icon: 'fa-hand-holding-dollar', tone: 'is-in' },
  AR_RECEIPT_CANCEL: { icon: 'fa-ban', tone: 'is-cancel' },
  AP_PAYMENT: { icon: 'fa-money-bill-transfer', tone: 'is-out' },
  AP_PAYMENT_CANCEL: { icon: 'fa-ban', tone: 'is-cancel' },
};

const rangeOf = (period: Period): Range | null => {
  const now = moment();
  if (period === 'month') return [now.clone().startOf('month').toDate(), now.clone().endOf('month').toDate()];
  if (period === 'lastMonth') {
    const last = now.clone().subtract(1, 'month');
    return [last.clone().startOf('month').toDate(), last.clone().endOf('month').toDate()];
  }
  if (period === 'year') return [now.clone().startOf('year').toDate(), now.clone().endOf('year').toDate()];
  return null;
};

/**
 * ປະຫວັດການເຄື່ອນໄຫວ ຂອງບັນຊີເງິນຄັງດຽວ (ເປີດຈາກບັດໃນປຶ້ມບັນຊີໃຫຍ່) — ຂໍ້ມູນຈາກ tbl_account_movement ເຊິ່ງ
 * moveBalance() ຂຽນທຸກຄັ້ງທີ່ຍອດປ່ຽນ (ລາຍຮັບ, ຍົກເລີກ, ໂອນເຂົ້າ/ອອກ, ຍອດເລີ່ມຕົ້ນ ...). ສະແດງແບບປຶ້ມບັນຊີ:
 * ຍອດເກົ່າ → ເຂົ້າ / ອອກ → ຍອດເຫຼືອ ແຍກ ຍອດໃຊ້ໄດ້ / ຍອດຄ້າງ (ແຕ່ລະອັນມີຍອດຕໍ່ເນື່ອງຂອງມັນເອງ).
 * ຍອດຍົກມາ / ຍອດທ້າຍງວດ ຄິດຢູ່ backend ຕາມວັນທີທຸລະກິດ (movement_date)
 */
const AccountMovementLog = ({ account, type, onClose }: {
  account: TreasuryAccount;
  type?: AccountType;
  onClose: () => void;
}) => {
  const t = useT();
  const symbol = currencySymbol(type?.currency);
  const bank = account.banks;
  const balance = Number(account.balance_treasury ?? 0) + Number(account.balance_unable ?? 0);

  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range | null>(() => rangeOf('month'));
  const [kind, setKind] = useState<Kind>(KIND_USABLE);
  /** ກັ່ນຕາມທີ່ມາ — null = ທັງໝົດ */
  const [source, setSource] = useState<string | null>(null);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [summary, setSummary] = useState<KindSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    postApi('/account-movement/fetch', {
      account_id: account._uuid,
      start_date: range?.[0],
      end_date: range?.[1],
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data?.data ?? []);
        setSummary(res.data?.summary ?? []);
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
  }, [account._uuid, range]);

  const pickPeriod = (value: Period) => {
    setPeriod(value);
    setRange(rangeOf(value));
    setSource(null);
  };

  const ofKind = useMemo(() => rows.filter((r) => Number(r.balance_kind) === kind), [rows, kind]);
  const sourceCounts = useMemo(
    () =>
      ofKind.reduce<Record<string, number>>((m, r) => {
        m[r.source_type] = (m[r.source_type] ?? 0) + 1;
        return m;
      }, {}),
    [ofKind]
  );
  const listed = source ? ofKind.filter((r) => r.source_type === source) : ofKind;
  const sum = summary.find((s) => Number(s.kind) === kind);
  const countIn = ofKind.filter((r) => r.direction === MOVE_IN).length;
  const countOut = ofKind.length - countIn;
  const listedIn = listed.filter((r) => r.direction === MOVE_IN).reduce((n, r) => n + r.amount, 0);
  const listedOut = listed.filter((r) => r.direction !== MOVE_IN).reduce((n, r) => n + r.amount, 0);
  const heldCount = rows.filter((r) => Number(r.balance_kind) === KIND_HELD).length;

  /** ຈັດກຸ່ມຕາມວັນທີລາຍການ ໃໝ່ສຸດກ່ອນ — ພາຍໃນມື້ລຽງຕາມລຳດັບທີ່ບັນທຶກ (ຍອດກ່ອນ → ຍອດຫຼັງ ຕໍ່ກັນ) */
  const dayMap = new Map<string, MovementRow[]>();
  listed.forEach((r) => dayMap.set(r.movement_date, [...(dayMap.get(r.movement_date) ?? []), r]));
  const days = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const todayKey = moment().format('YYYY-MM-DD');
  const yesterdayKey = moment().subtract(1, 'day').format('YYYY-MM-DD');
  const signedOf = (r: MovementRow) => (r.direction === MOVE_IN ? r.amount : -r.amount);
  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;

  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();
  const sourceLabel = (code: string) => {
    const label = t(`mvSrc${code}`);
    return label === `mvSrc${code}` ? code : label;
  };

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: t('mvThisMonth') },
    { key: 'lastMonth', label: t('mvLastMonth') },
    { key: 'year', label: t('mvThisYear') },
    { key: 'all', label: t('all') },
  ];
  const kinds: { key: Kind; label: string; count: number }[] = [
    { key: KIND_USABLE, label: t('treasuryBalanceUsable'), count: rows.length - heldCount },
    { key: KIND_HELD, label: t('treasuryBalanceHeld'), count: heldCount },
  ];

  return (
    <Drawer open onClose={onClose} size="lg" placement="right" className="acc-stmt-drawer acc-mv-drawer">
      <Drawer.Header>
        <div className="acc-stmt-head">
          <span className="acc-stmt-logo">
            {bank?.url ? <img src={bank.url} alt={bank.abbr ?? ''} /> : <i className="fa-solid fa-wallet" />}
          </span>
          <span className="acc-stmt-title">
            <em className="acc-mv-eyebrow"><i className="fa-solid fa-timeline" /> {t('mvOpen')}</em>
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
        {/* ---- ຊ່ວງວັນທີ: ປຸ່ມລັດ + ເລືອກເອງ ---- */}
        <div className="acc-stmt-filters">
          <div className="acc-type-segment" role="tablist">
            {periods.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={period === p.key}
                className={period === p.key ? 'is-active' : ''} onClick={() => pickPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            className="acc-mv-range"
            format="dd/MM/yyyy"
            character=" – "
            placement="bottomEnd"
            value={range}
            onChange={(value) => {
              setRange(value as Range | null);
              setPeriod(value ? 'custom' : 'all');
              setSource(null);
            }}
          />
        </div>

        {/* ---- ຍອດໃຊ້ໄດ້ / ຍອດຄ້າງ — ແຕ່ລະອັນມີຍອດຕໍ່ເນື່ອງຂອງມັນເອງ ---- */}
        <div className="acc-stmt-tabs" role="tablist">
          {kinds.map((k) => (
            <button key={k.key} type="button" role="tab" aria-selected={kind === k.key}
              className={kind === k.key ? 'is-active' : ''}
              onClick={() => {
                setKind(k.key);
                setSource(null);
              }}
            >
              <i className={`fa-solid ${k.key === KIND_HELD ? 'fa-lock' : 'fa-wallet'}`} /> {k.label} <em>{k.count}</em>
            </button>
          ))}
        </div>

        {/* ---- ສະຫຼຸບຊ່ວງເປັນສົມຜົນ: ຍົກມາ + ເຂົ້າ − ອອກ = ທ້າຍງວດ ---- */}
        <div className="acc-mv-kpis">
          <div className="acc-mv-kpi">
            <small>{t('mvOpening')}</small>
            <b className={(sum?.opening ?? 0) < 0 ? 'is-negative' : ''}>{formatNumber(sum?.opening ?? 0)}</b>
          </div>
          <span className="acc-mv-op" aria-hidden="true">+</span>
          <div className="acc-mv-kpi is-in">
            <small>{t('stmtIn')} <em>{countIn}</em></small>
            <b>{formatNumber(sum?.in ?? 0)}</b>
          </div>
          <span className="acc-mv-op" aria-hidden="true">−</span>
          <div className="acc-mv-kpi is-out">
            <small>{t('stmtOut')} <em>{countOut}</em></small>
            <b>{formatNumber(sum?.out ?? 0)}</b>
          </div>
          <span className="acc-mv-op" aria-hidden="true">=</span>
          <div className="acc-mv-kpi is-closing">
            <small>{t('mvClosing')}</small>
            <b className={(sum?.closing ?? 0) < 0 ? 'is-negative' : ''}>
              <span className="acc-mv-cur">{symbol}</span>{formatNumber(sum?.closing ?? 0)}
            </b>
          </div>
        </div>

        {/* ---- ກັ່ນຕາມທີ່ມາ — ສະເພາະທີ່ມີໃນຊ່ວງນີ້ ---- */}
        {Object.keys(sourceCounts).length > 1 && (
          <div className="acc-type-chips acc-mv-sources">
            <button type="button" className={`acc-type-chip${source == null ? ' is-active' : ''}`} onClick={() => setSource(null)}>
              {t('all')} <em>{ofKind.length}</em>
            </button>
            {Object.entries(sourceCounts).map(([code, count]) => (
              <button key={code} type="button" className={`acc-type-chip${source === code ? ' is-active' : ''}`}
                onClick={() => setSource(source === code ? null : code)}
              >
                <i className={`fa-solid ${SOURCES[code]?.icon ?? 'fa-circle-dot'}`} /> {sourceLabel(code)} <em>{count}</em>
              </button>
            ))}
          </div>
        )}
        {source && (
          <p className="acc-mv-filtered">
            {sourceLabel(source)} · {listed.length} {t('mvItem')}
            {listedIn > 0 && <span className="is-in"> · +{formatNumber(listedIn)}</span>}
            {listedOut > 0 && <span className="is-out"> · −{formatNumber(listedOut)}</span>}
          </p>
        )}

        {loading && !rows.length ? (
          <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : error ? (
          <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
        ) : days.length ? (
          <div className={`acc-stmt-content${loading ? ' is-refreshing' : ''}`}>
            {days.map(([day, items]) => {
              const dayNet = items.reduce((n, r) => n + signedOf(r), 0);
              const relative = day === todayKey ? t('today') : day === yesterdayKey ? t('yesterday') : null;
              return (
                <section key={day} className="acc-mv-day">
                  <header>
                    <b>{moment(day).format('DD/MM/YYYY')}</b>
                    {relative && <em>{relative}</em>}
                    <span className={`acc-mv-day-net${dayNet < 0 ? ' is-out' : dayNet > 0 ? ' is-in' : ''}`}>
                      {signed(dayNet)}
                    </span>
                  </header>
                  <ul>
                    {items.map((r) => {
                      const isIn = r.direction === MOVE_IN;
                      const meta = SOURCES[r.source_type];
                      const other = r.counterpart;
                      const isTransfer = r.source_type.startsWith('TRANSFER');
                      const recorded = moment(r.createdAt);
                      /** ບັນທຶກຍ້ອນຫຼັງ — ວັນທີລາຍການ ≠ ມື້ທີ່ບັນທຶກ */
                      const backdated = recorded.format('YYYY-MM-DD') !== r.movement_date;
                      // ໂອນ = ບອກບັນຊີຄູ່ໂອນ; ລາຍຮັບ/ລາຍຈ່າຍ = ຫົວຂໍ້ຂອງເອກະສານ (description); ອື່ນໆ = ປ້າຍທີ່ມາ
                      const title = isTransfer
                        ? `${t(isIn ? 'stmtFrom' : 'stmtTo')} ${other ? other.acountName : t('stmtDeletedAccount')}`
                        : r.description || sourceLabel(r.source_type);
                      const note = isTransfer ? r.description : null;
                      return (
                        <li key={r._uuid} className="acc-mv-entry">
                          <span className={`acc-mv-icon ${meta?.tone ?? 'is-neutral'}`} aria-hidden="true">
                            <i className={`fa-solid ${meta?.icon ?? 'fa-circle-dot'}`} />
                          </span>

                          <div className="acc-mv-body">
                            <div className="acc-mv-line">
                              <b className="acc-mv-title" title={title}>{title}</b>
                              <span className={`acc-mv-amount ${isIn ? 'is-in' : 'is-out'}`}>
                                {isIn ? '+' : '−'}{formatNumber(r.amount)}
                              </span>
                            </div>

                            <div className="acc-mv-meta">
                              <span className={`acc-mv-src ${meta?.tone ?? 'is-neutral'}`}>{sourceLabel(r.source_type)}</span>
                              {r.doc_number && <code className="acc-mv-doc">{r.doc_number}</code>}
                              {isTransfer && other && (
                                <span className="acc-mv-bank" title={other.banks?.name_la}>
                                  {other.banks?.url ? <img src={other.banks.url} alt={other.banks.abbr ?? ''} /> : <i className="fa-solid fa-wallet" />}
                                  {other.acount_number || other.banks?.abbr}
                                </span>
                              )}
                              <span>
                                <i className="fa-regular fa-clock" />{' '}
                                {backdated ? `${t('mvRecorded')} ${recorded.format('DD/MM HH:mm')}` : recorded.format('HH:mm')}
                              </span>
                              {r.created_by_name && <span><i className="fa-regular fa-user" /> {r.created_by_name}</span>}
                            </div>

                            {note && <p className="acc-mv-note">{note}</p>}

                            {/* ຍອດກ່ອນ → ຍອດຫຼັງ ຂອງລາຍການນີ້ */}
                            <div className="acc-mv-flow">
                              <span><small>{t('mvBefore')}</small>{formatNumber(r.balance_before)}</span>
                              <i className="fa-solid fa-arrow-right-long" aria-hidden="true" />
                              <span className={`is-after${r.balance_after < 0 ? ' is-negative' : ''}`}>
                                <small>{t('mvAfter')}</small>{formatNumber(r.balance_after)}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="acc-class-empty"><i className="fa-solid fa-timeline" /><p>{t('mvEmpty')}</p></div>
        )}
      </Drawer.Body>
    </Drawer>
  );
};

export default AccountMovementLog;
