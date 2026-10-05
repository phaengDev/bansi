import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import TreasuryAccountForm, { type TreasuryAccount, type TreasuryBank } from './TreasuryAccountForm';
import AccountStatement from './AccountStatement';
import AccountMovementLog from './AccountMovementLog';
import TransferMoneyForm from './TransferMoneyForm';
import { currencySymbol } from './currency';
import { toneOf } from '../setting/accountTone';
import { toneStyle, useLogoTones } from './logoTone';
import { CASH_CLASS_CODE } from '../journal/journalKit';

type StatusFilter = 'all' | 'active' | 'inactive';
type Currency = NonNullable<AccountType['currency']>;

/** key ຂອງ chip ທະນາຄານສຳລັບປຶ້ມບັນຊີທີ່ບໍ່ຜູກທະນາຄານ */
const NO_BANK = 0;

const isActive = (r: TreasuryAccount) => Number(r.status) === 1;
const currencyIdOf = (r: TreasuryAccount) => Number(r.treasury?.currencyId ?? 0);
const bankIdOf = (r: TreasuryAccount) => Number(r.bankId || NO_BANK);
const usableOf = (r: TreasuryAccount) => Number(r.balance_treasury ?? 0);
const heldOf = (r: TreasuryAccount) => Number(r.balance_unable ?? 0);
/** ຍອດລວມ = ໃຊ້ໄດ້ + ຄ້າງບັນຊີ */
const totalOf = (r: TreasuryAccount) => usableOf(r) + heldOf(r);
const sumTotal = (list: TreasuryAccount[]) => list.reduce((n, r) => n + totalOf(r), 0);

const countBy = (list: TreasuryAccount[], keyOf: (r: TreasuryAccount) => number) =>
  list.reduce<Record<number, number>>((m, r) => {
    const k = keyOf(r);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

/**
 * ແຖວບັດຂອງແຕ່ລະກຸ່ມ — ເຫັນ 3 ໃບຕໍ່ແຖວ, ຫຼາຍກວ່ານັ້ນເລື່ອນຊ້າຍ-ຂວາ (scroll-snap).
 * ປຸ່ມລູກສອນຂຶ້ນສະເພາະເມື່ອຍັງເລື່ອນໄປທາງນັ້ນໄດ້; ວັດຄືນເມື່ອໜ້າຕ່າງປ່ຽນຂະໜາດ (ResizeObserver).
 */
const CardRail = ({ count, labels, children }: {
  count: number;
  labels: { prev: string; next: string };
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="acc-book-rail-wrap">
      {!edge.start && (
        <button type="button" className="acc-book-rail-btn is-prev" aria-label={labels.prev} onClick={() => scrollBy(-1)}>
          <i className="fa-solid fa-chevron-left" />
        </button>
      )}
      <div ref={ref} className="acc-book-rail" onScroll={measure}>{children}</div>
      {!edge.end && (
        <button type="button" className="acc-book-rail-btn is-next" aria-label={labels.next} onClick={() => scrollBy(1)}>
          <i className="fa-solid fa-chevron-right" />
        </button>
      )}
    </div>
  );
};

/**
 * ເງິນສົດ ແລະ ທະນາຄານ (ໜ້າຕ່າງ cashBank ໃນ Shell.tsx) — ດຶງທັງໝົດເທື່ອດຽວຈາກ POST /treasury-account/fetch
 * (treasuryAcountController.getTreasuryAcount) ເຊິ່ງ include ປະເພດບັນຊີ (+ ໝວດ, ສະກຸນເງິນ) ແລະ ທະນາຄານມາໃຫ້ແລ້ວ.
 * ກັ່ນຕອງຢູ່ໜ້າ ແລະ ຈັດກຸ່ມຕາມປະເພດບັນຊີ ແບບດຽວກັບ setting/AccountTypePage.
 */
const TreasuryAccountPage = () => {
  const t = useT();
  const [rows, setRows] = useState<TreasuryAccount[]>([]);
  const [types, setTypes] = useState<AccountType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [bankId, setBankId] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  /** undefined = ປິດຟອມ, null = ເພີ່ມໃໝ່, ມີແຖວ = ແກ້ໄຂແຖວນັ້ນ */
  const [editing, setEditing] = useState<TreasuryAccount | null | undefined>(undefined);
  /** ບັນຊີທີ່ກຳລັງເບິ່ງປະຫວັດເງິນເຂົ້າ-ອອກ */
  const [viewing, setViewing] = useState<TreasuryAccount | null>(null);
  /** ບັນຊີທີ່ກຳລັງເບິ່ງປະຫວັດການເຄື່ອນໄຫວ (tbl_account_movement) */
  const [tracing, setTracing] = useState<TreasuryAccount | null>(null);
  /** ຟອມໂອນຍ້າຍເງິນ: undefined = ປິດ, null = ເປີດຈາກຫົວໜ້າ, ຕົວເລກ = ເປີດຈາກບັດ (ບັນຊີໂອນອອກ) */
  const [transferFrom, setTransferFrom] = useState<number | null | undefined>(undefined);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await postApi('/treasury-account/fetch', {});
      setRows(res.data?.data || []);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  /** ປະເພດບັນຊີທັງໝົດ — ໃຊ້ໃນຟອມ ແລະ ເປັນຫົວກຸ່ມເມື່ອແຖວບໍ່ມີ treasury include ມາ */
  const fetchTypes = async () => {
    try {
      const res = await postApi('/type-treasury/fetch', {}, { params: { limit: 1000 } });
      setTypes(res.data?.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchData();
  }, []);

  const typeOf = (r: TreasuryAccount) => r.treasury ?? types.find((x) => x._uuid === r.type_treasuryid);
  /** ສີຈາກໂລໂກ້ທະນາຄານ — ບັດທີ່ຜູກທະນາຄານໃຊ້ສີນີ້ແທນສີໝວດ; ບັນຊີເງິນສົດ (ບໍ່ມີໂລໂກ້) ຄົງສີໝວດຄືເດີມ */
  const logoTones = useLogoTones(rows.map((r) => r.banks?.url));
  const bankName = (b: TreasuryBank) => b.abbr || b.name_la || '';

  // ສະກຸນເງິນ ແລະ ທະນາຄານ ທີ່ມີປຶ້ມບັນຊີໃຊ້ຢູ່ — ເອົາມາຈາກແຖວເລີຍ ບໍ່ຕ້ອງດຶງລາຍການແຍກ
  const currencyMap = new Map<number, Currency>();
  const bankMap = new Map<number, TreasuryBank | null>();
  rows.forEach((r) => {
    const cur = typeOf(r)?.currency;
    if (cur) currencyMap.set(currencyIdOf(r), cur);
    bankMap.set(bankIdOf(r), r.banks ?? null);
  });

  // ---- ກັ່ນຕອງ: ຄຳຄົ້ນ + ສະຖານະ ເປັນພື້ນ, ແລ້ວນັບ chip ຂອງແຕ່ລະມິຕິໂດຍບໍ່ນັບຕົວກັ່ນຕອງຂອງມິຕິນັ້ນເອງ ----
  const q = keyword.trim().toLowerCase();
  const base = rows.filter((r) => {
    const type = typeOf(r);
    const text = [r.acountName, r.acount_number, type?.treasury_code, type?.treasury_name, r.banks?.abbr, r.banks?.name_la];
    return (status === 'all' || (status === 'active') === isActive(r))
      && (!q || text.join(' ').toLowerCase().includes(q));
  });
  const byCurrency = base.filter((r) => currencyId == null || currencyIdOf(r) === currencyId);
  const byBank = base.filter((r) => bankId == null || bankIdOf(r) === bankId);
  const shown = byCurrency.filter((r) => bankId == null || bankIdOf(r) === bankId);

  const currencyCounts = countBy(byBank, currencyIdOf);
  const bankCounts = countBy(byCurrency, bankIdOf);

  const activeCount = rows.filter(isActive).length;
  /** ຍອດເງິນລວມແຍກຕາມສະກຸນເງິນ — ບວກຂ້າມສະກຸນບໍ່ໄດ້ */
  const balanceKpis = [...currencyMap.entries()].map(([id, cur]) => ({
    id,
    cur,
    total: sumTotal(rows.filter((r) => currencyIdOf(r) === id)),
  }));

  const hasFilter = !!q || currencyId != null || bankId != null || status !== 'all';
  const clearFilters = () => {
    setKeyword('');
    setCurrencyId(null);
    setBankId(null);
    setStatus('all');
  };

  /** ຈັດກຸ່ມຕາມປະເພດບັນຊີ — ລຽງຕາມລະຫັດປະເພດ */
  const groupMap = new Map<number, { type?: AccountType; items: TreasuryAccount[] }>();
  shown.forEach((r) => {
    const g = groupMap.get(r.type_treasuryid) ?? { type: typeOf(r), items: [] };
    g.items.push(r);
    groupMap.set(r.type_treasuryid, g);
  });
  const groups = [...groupMap.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => String(a.type?.treasury_code ?? '').localeCompare(String(b.type?.treasury_code ?? '')));

  const toggleGroup = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: rows.length },
    { key: 'active', label: t('active'), count: activeCount },
    { key: 'inactive', label: t('inactive'), count: rows.length - activeCount },
  ];

  return (
    <div className="acc-type">
      {/* ---- ຫົວໜ້າ: ສະຫຼຸບ + ປຸ່ມເພີ່ມ ---- */}
      <div className="acc-type-head">
        {/* --kpi-n: ຈຳນວນກ່ອງ — ແຖວບໍ່ພໍວາງກ່ອງທັງໝົດ ປຸ່ມຈະລົງແຖວໃໝ່ແທນທີ່ຈະໃຫ້ກ່ອງສຸດທ້າຍຕົກແຖວ */}
        <div className="acc-type-kpis acc-book-kpis" style={{ '--kpi-n': 2 + balanceKpis.length } as CSSProperties}>
          <div className="acc-type-kpi">
            <i className="fa-solid fa-book" />
            <span><small>{t('total')}</small><b>{rows.length}</b></span>
          </div>
          <div className="acc-type-kpi is-green">
            <i className="fa-solid fa-circle-check" />
            <span><small>{t('active')}</small><b>{activeCount}</b></span>
          </div>
          {balanceKpis.map(({ id, cur, total }) => (
            <div key={id} className="acc-type-kpi is-violet">
              <i className="acc-book-kpi-cur">{currencySymbol(cur)}</i>
              <span>
                <small>{t('treasuryBalanceTotal')} · {cur.name}</small>
                <b className={total < 0 ? 'text-danger' : ''}>{formatNumber(total)}</b>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="acc-xfer-btn" disabled={!canCreate || rows.filter(isActive).length < 2}
          onClick={() => setTransferFrom(null)}
        >
          <i className="fa-solid fa-right-left" /> {t('xferTitle')}
        </button>
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setEditing(null)}>
          <i className="fa-solid fa-plus" /> {t('treasuryAdd')}
        </button>
      </div>

      {/* ---- ແຜງກັ່ນຕອງ ---- */}
      <div className="acc-type-filters">
        <div className="acc-type-filter-top">
          <InputGroup inside className="acc-type-search">
            <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
            <Input placeholder={t('treasurySearch')} value={keyword} onChange={setKeyword} />
            {keyword && (
              <InputGroup.Button onClick={() => setKeyword('')} aria-label={t('cancel')}>
                <i className="fa-solid fa-xmark" />
              </InputGroup.Button>
            )}
          </InputGroup>
          <div className="acc-type-segment" role="tablist">
            {statusTabs.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={status === s.key}
                className={status === s.key ? 'is-active' : ''} onClick={() => setStatus(s.key)}
              >
                {s.label} <em>{s.count}</em>
              </button>
            ))}
          </div>
          {hasFilter && (
            <button type="button" className="acc-type-clear" onClick={clearFilters}>
              <i className="fa-solid fa-filter-circle-xmark" /> {t('accountTypeClearFilter')}
            </button>
          )}
        </div>

        <div className="acc-type-filter-row">
          <span className="acc-type-filter-label"><i className="fa-solid fa-coins" /> {t('accountTypeCurrency')}</span>
          <div className="acc-type-chips">
            <button type="button" className={`acc-type-chip${currencyId == null ? ' is-active' : ''}`} onClick={() => setCurrencyId(null)}>
              {t('all')} <em>{byBank.length}</em>
            </button>
            {[...currencyMap.entries()].map(([id, cur]) => (
              <button key={id} type="button"
                className={`acc-type-chip${currencyId === id ? ' is-active' : ''}${currencyCounts[id] ? '' : ' is-empty'}`}
                onClick={() => setCurrencyId(currencyId === id ? null : id)}
              >
                {cur.genus && <span className="acc-type-cur-icon">{cur.genus}</span>} {cur.name} <em>{currencyCounts[id] ?? 0}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="acc-type-filter-row">
          <span className="acc-type-filter-label"><i className="fa-solid fa-building-columns" /> {t('bank')}</span>
          <div className="acc-type-chips">
            <button type="button" className={`acc-type-chip${bankId == null ? ' is-active' : ''}`} onClick={() => setBankId(null)}>
              {t('all')} <em>{byCurrency.length}</em>
            </button>
            {[...bankMap.entries()].map(([id, bank]) => (
              <button key={id} type="button"
                className={`acc-type-chip${bankId === id ? ' is-active' : ''}${bankCounts[id] ? '' : ' is-empty'}`}
                onClick={() => setBankId(bankId === id ? null : id)}
                title={bank?.name_la}
              >
                {bank ? bankName(bank) : t('treasuryNoBank')} <em>{bankCounts[id] ?? 0}</em>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- ລາຍການ ---- */}
      {isLoading ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : groups.length ? (
        groups.map(({ id, type, items }) => {
          const open = !collapsed.has(id);
          const cur = type?.currency;
          const groupTotal = sumTotal(items);
          return (
            <section key={id} className={`acc-type-group acc-tone ${toneOf(type?.types?.type_code ?? type?.treasury_code ?? '')}`}>
              <button type="button" className="acc-type-group-head" aria-expanded={open} onClick={() => toggleGroup(id)}>
                <span className="acc-type-group-code">{type?.treasury_code ?? '—'}</span>
                <span className="acc-type-group-name">{type?.treasury_name ?? t('notSpecified')}</span>
                <span className="acc-type-group-count">{items.length}</span>
                {/* ຍອດລວມຂອງກຸ່ມ — ກ່ອງຂາວຂອບສີໝວດ ໃຫ້ເດັ່ນກວ່າຫົວກຸ່ມ */}
                <span className={`acc-book-group-sum${groupTotal < 0 ? ' is-negative' : ''}`}>
                  <small>{t('treasuryBalanceTotal')}</small>
                  <b><em>{currencySymbol(cur)}</em>{formatNumber(groupTotal)}</b>
                </span>
                <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} />
              </button>

              {open && (
                <CardRail count={items.length} labels={{ prev: t('previous'), next: t('next') }}>
                  {items.map((item) => {
                    const active = isActive(item);
                    const bank = item.banks;
                    const usable = usableOf(item);
                    const held = heldOf(item);
                    const total = usable + held;
                    /** ຕົວຫຍໍ້ທະນາຄານ / (ສະກຸນເງິນ) ເຊັ່ນ LDB/(LAK) — ບໍ່ຜູກທະນາຄານກໍ່ເຫຼືອ (LAK) */
                    const tag = [bank?.abbr, cur?.name && `(${cur.name})`].filter(Boolean).join('/');
                    return (
                      // ບັດແບບປຶ້ມບັນຊີທະນາຄານ: ສັນປຶ້ມ + ປົກ (ທະນາຄານ) + ໜ້າເຈ້ຍມີເສັ້ນ (ຊື່/ເລກບັນຊີ + ຍອດເງິນແບບບັນຊີ)
                      <article key={item._uuid} className={`acc-pb${active ? '' : ' is-off'}`}
                        style={toneStyle(bank?.url ? logoTones[bank.url] : null)}
                      >
                        <span className="acc-pb-spine" aria-hidden="true" />
                        <div className="acc-pb-body">
                          <header className="acc-pb-cover">
                            <span className="acc-pb-logo">
                              {bank?.url ? <img src={bank.url} alt={bankName(bank)} /> : <i className="fa-solid fa-wallet" />}
                            </span>
                            {/* ແຖວເທິງ = ຊື່ທະນາຄານ (ບໍ່ມີກໍ່ໃຊ້ຕົວຫຍໍ້; ໝວດເງິນສົດ = "ເງິນສົດ"), ແຖວລຸ່ມ = ປະເພດບັນຊີ */}
                            <span className="acc-pb-bank">
                              <b title={bank?.name_la}>
                                {bank ? bank.name_la || bank.abbr : t(type?.types?.type_code === CASH_CLASS_CODE ? 'incomeReceiveCash' : 'treasuryNoBank')}
                              </b>
                              <small title={type?.treasury_name}>{type?.treasury_name}</small>
                            </span>
                            <span className={`acc-pb-status${active ? ' is-active' : ''}`}>
                              <i className="fa-solid fa-circle" /> {active ? t('active') : t('inactive')}
                            </span>
                            <button type="button" className="acc-pb-edit" disabled={!canCreate || !active}
                              aria-label={t('xferOut')} title={t('xferOut')}
                              onClick={() => setTransferFrom(item._uuid)}
                            >
                              <i className="fa-solid fa-right-left" />
                            </button>
                            <button type="button" className="acc-pb-edit" disabled={!canEdit}
                              aria-label={t('edit')} title={t('edit')}
                              onClick={() => setEditing(item)}
                            >
                              <i className="fa-solid fa-pen" />
                            </button>
                          </header>

                          <div className="acc-pb-page">
                            <dl className="acc-pb-holder">
                              <dt>{t('accountName')}</dt>
                              <dd className="acc-pb-name">
                                <b title={item.acountName}>{item.acountName}</b>
                                {tag && <em className="acc-pb-tag">{tag}</em>}
                              </dd>
                              <dt>{t('accountNumber')}</dt>
                              <dd className="acc-pb-number" title={item.acount_number}>{item.acount_number || '—'}</dd>
                            </dl>

                            <dl className="acc-pb-ledger">
                              <div className="is-usable">
                                <dt>{t('treasuryBalanceUsable')}</dt>
                                <dd className={usable < 0 ? 'is-negative' : ''}>{formatNumber(usable)}</dd>
                              </div>
                              <div className="is-held">
                                <dt>{t('treasuryBalanceHeld')}</dt>
                                <dd className={held < 0 ? 'is-negative' : ''}>{formatNumber(held)}</dd>
                              </div>
                              <div className="is-total">
                                <dt>{t('treasuryBalanceTotal')}</dt>
                                <dd className={total < 0 ? 'is-negative' : ''}>
                                  <small>{currencySymbol(cur)}</small> {formatNumber(total)}
                                </dd>
                              </div>
                            </dl>

                            <div className="acc-pb-actions">
                              <button type="button" className="acc-pb-history" onClick={() => setViewing(item)}>
                                <i className="fa-solid fa-clock-rotate-left" /> {t('stmtOpen')}
                                <i className="fa-solid fa-chevron-right" />
                              </button>
                              <button type="button" className="acc-pb-history" onClick={() => setTracing(item)}>
                                <i className="fa-solid fa-timeline" /> {t('mvOpen')}
                                <i className="fa-solid fa-chevron-right" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </CardRail>
              )}
            </section>
          );
        })
      ) : (
        <div className="acc-class-empty">
          <i className={`fa-solid ${hasFilter ? 'fa-filter-circle-xmark' : 'fa-book'}`} />
          <p>{hasFilter ? t('treasuryNoMatch') : t('noData')}</p>
          {hasFilter && (
            <button type="button" className="acc-type-clear mt-2" onClick={clearFilters}>
              {t('accountTypeClearFilter')}
            </button>
          )}
        </div>
      )}

      {transferFrom !== undefined && (
        <TransferMoneyForm
          accounts={rows}
          types={types}
          defaultFrom={transferFrom ?? undefined}
          onClose={() => setTransferFrom(undefined)}
          onSaved={fetchData}
        />
      )}

      {viewing && <AccountStatement account={viewing} type={typeOf(viewing)} onClose={() => setViewing(null)} />}
      {tracing && <AccountMovementLog account={tracing} type={typeOf(tracing)} onClose={() => setTracing(null)} />}

      {editing !== undefined && (
        <TreasuryAccountForm
          data={editing}
          types={types}
          onClose={() => setEditing(undefined)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default TreasuryAccountPage;
