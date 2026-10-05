import { useEffect, useState } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import { currencySymbol } from '../ledger/currency';
import IncomeForm, { TRANSFER, incomeDateOf, type Income } from './IncomeForm';
import IncomeDetail from './IncomeDetail';
import { DailyChart, DayHead, MonthSwitch } from './JournalParts';

type StatusFilter = 'all' | 'active' | 'cancelled';
type Summary = { currency: string; genus: string | null; total: number; tax: number; count: number };

const ACTIVE = 1;

/**
 * ລາຍຮັບ (ໃນໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ) — ລາຍການຂອງເດືອນທີ່ເລືອກ ຈາກ POST /income/fetch, ໃໝ່ສຸດກ່ອນ ຈັດກຸ່ມຕາມມື້.
 * ຫົວໜ້າ: ຍອດລວມເດືອນ (ແຍກສະກຸນ — ບວກຂ້າມສະກຸນບໍ່ໄດ້) + ກຣາຟລາຍວັນ (ກົດແທ່ງ = ກັ່ນມື້ນັ້ນ).
 * ບັນທຶກ/ແກ້ໄຂ ຜ່ານ IncomeForm; ຍົກເລີກ = ຫັກເງິນອອກຈາກບັນຊີຄືນ
 */
const IncomePage = () => {
  const t = useT();
  const [month, setMonth] = useState(() => moment().startOf('month'));
  const [rows, setRows] = useState<Income[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  /** ມື້ທີ່ກັ່ນຈາກກຣາຟ (YYYY-MM-DD) — null = ທັງເດືອນ */
  const [day, setDay] = useState<string | null>(null);
  /** undefined = ປິດຟອມ, null = ບັນທຶກໃໝ່, ມີແຖວ = ແກ້ໄຂ */
  const [editing, setEditing] = useState<Income | null | undefined>(undefined);
  /** ລາຍຮັບທີ່ກຳລັງເບິ່ງລາຍລະອຽດ */
  const [viewing, setViewing] = useState<Income | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // ສົ່ງເປັນ string "YYYY-MM-DD" — ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date
      const res = await postApi('/income/fetch', {
        start_date: month.clone().startOf('month').format('YYYY-MM-DD'),
        end_date: month.clone().endOf('month').format('YYYY-MM-DD'),
      });
      setRows(res.data?.data ?? []);
      setSummary(res.data?.summary ?? []);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  /** ບັນຊີເງິນຄັງ (ຍອດປັດຈຸບັນ) ສຳລັບຟອມ — ໂຫຼດຄືນຫຼັງບັນທຶກ/ຍົກເລີກ ເພາະຍອດປ່ຽນ */
  const fetchAccounts = async () => {
    try {
      const res = await postApi('/treasury-account/fetch', {});
      setAccounts(res.data?.data ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month.format('YYYY-MM')]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const reload = () => {
    fetchData();
    fetchAccounts();
  };

  const cancelIncome = (row: Income) =>
    Notific.confirm(`${t('incomeCancelConfirm')} (${row.number})`, async () => {
      try {
        await putApi(`/income/cancel/${btoa(String(row._uuid))}`, {});
        Notific.success('saveSuccessDone');
        setViewing(null);
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  // ປ່ຽນເດືອນ = ລ້າງມື້ທີ່ກັ່ນໄວ້
  useEffect(() => {
    setDay(null);
  }, [month.format('YYYY-MM')]);

  const isActive = (r: Income) => Number(r.status) === ACTIVE;
  const dayKeyOf = (r: Income) => incomeDateOf(r).format('YYYY-MM-DD');
  const curOf = (r: Income) => r.acount?.treasury?.currency;
  const activeRows = rows.filter(isActive);
  const activeCount = activeRows.length;

  /** ສະກຸນເງິນຫຼັກ (ມີລາຍການຫຼາຍສຸດ) — ຍອດໃຫຍ່ ແລະ ກຣາຟລາຍວັນໃຊ້ສະກຸນນີ້, ສະກຸນອື່ນສະແດງນ້ອຍລົງ (ບວກຂ້າມສະກຸນບໍ່ໄດ້) */
  const ranked = [...summary].sort((a, b) => b.count - a.count);
  const main = ranked[0];
  const others = ranked.slice(1);
  const symbolOf = (s: Summary) => currencySymbol({ genus: s.genus ?? undefined, name: s.currency });
  const mainSymbol = main ? symbolOf(main) : '';
  const inMain = (r: Income) => !main || (curOf(r)?.name ?? '') === main.currency;
  const cashCount = activeRows.filter((r) => Number(r.receive_type) !== TRANSFER).length;

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    (status === 'all' || (status === 'active') === isActive(r))
    && (!day || dayKeyOf(r) === day)
    && (!q || [r.number, r.incom_title, r.typein?.type_name, r.typein?.type_code, r.acount?.acountName, r.description, r.payer_account_name,
      r.payer_name, r.partner?.name, r.partner?.partner_code, r.partner?.phone]
      .join(' ').toLowerCase().includes(q)));

  /** ຈັດກຸ່ມຕາມວັນທີຮັບເງິນ ໃໝ່ສຸດກ່ອນ */
  const groupMap = new Map<string, Income[]>();
  shown.forEach((r) => groupMap.set(dayKeyOf(r), [...(groupMap.get(dayKeyOf(r)) ?? []), r]));
  const groups = [...groupMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  /** ຍອດຂອງກຸ່ມມື້ ແຍກຕາມສະກຸນ (ສະເພາະທີ່ໃຊ້ງານ) */
  const sumByCurrency = (list: Income[]) => {
    const map = new Map<string, { symbol: string; total: number }>();
    list.filter(isActive).forEach((r) => {
      const cur = curOf(r);
      const key = cur?.name ?? '';
      const entry = map.get(key) ?? { symbol: currencySymbol(cur), total: 0 };
      entry.total += Number(r.balance_income) || 0;
      map.set(key, entry);
    });
    return [...map.values()];
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: rows.length },
    { key: 'active', label: t('active'), count: activeCount },
    { key: 'cancelled', label: t('incomeCancelled'), count: rows.length - activeCount },
  ];

  return (
    <div className="acc-jr">
      {/* ---- ຫົວ: ເດືອນ + ປຸ່ມບັນທຶກ / ຍອດລວມ + ສະຖິຕິ / ກຣາຟລາຍວັນ ---- */}
      <header className="acc-jr-hero">
        <div className="acc-jr-hero-top">
          <MonthSwitch month={month} onChange={setMonth} />
          <button type="button" className="acc-fc-add acc-tone is-emerald" disabled={!canCreate} onClick={() => setEditing(null)}>
            <i className="fa-solid fa-plus" /> {t('incomeAdd')}
          </button>
        </div>

        <div className="acc-jr-hero-body">
          <div className="acc-jr-hero-total">
            <small>{t('incomeMonthSum')} {month.format('MM/YYYY')}</small>
            <b>
              <span className="acc-jr-cur">{mainSymbol}</span>
              {formatNumber(main?.total ?? 0)}
            </b>
            {others.map((s) => (
              <span key={s.currency} className="acc-jr-hero-alt">+ {symbolOf(s)} {formatNumber(s.total)}</span>
            ))}
            <div className="acc-jr-stats">
              <span><i className="fa-solid fa-receipt" /> {activeCount} {t('incomeItems')}</span>
              <span><i className="fa-solid fa-money-bill-wave" /> {t('incomeReceiveCash')} {cashCount}</span>
              <span><i className="fa-solid fa-building-columns" /> {t('incomeReceiveTransfer')} {activeCount - cashCount}</span>
              {Number(main?.tax) > 0 && (
                <span><i className="fa-solid fa-percent" /> {t('incomeTaxField')} {formatNumber(main!.tax)}</span>
              )}
            </div>
          </div>

          <DailyChart month={month} label={t('incomeDaily')} symbol={mainSymbol} sign="+" day={day} onDay={setDay}
            entries={activeRows.filter(inMain).map((r) => ({ date: incomeDateOf(r), amount: Number(r.balance_income) || 0 }))}
          />
        </div>
      </header>

      {/* ---- ຄົ້ນຫາ + ສະຖານະ + ມື້ທີ່ກັ່ນ ---- */}
      <div className="acc-fc-toolbar acc-tone is-emerald">
        <InputGroup inside className="acc-type-search">
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input placeholder={t('incomeSearch')} value={keyword} onChange={setKeyword} />
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
        {day && (
          <button type="button" className="acc-stmt-chip acc-jr-day-chip" onClick={() => setDay(null)}>
            <i className="fa-regular fa-calendar" /> {moment(day).format('DD/MM/YYYY')} <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* ---- ລາຍການຈັດກຸ່ມຕາມມື້ — ໂຫຼດຄືນບໍ່ລ້າງລາຍການເກົ່າອອກກ່ອນ (ບໍ່ກະພິບ) ---- */}
      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : groups.length ? (
        <div className={`acc-jr-list${loading ? ' is-refreshing' : ''}`}>
          {groups.map(([key, items]) => {
            const sums = sumByCurrency(items);
            return (
              <section key={key} className="acc-jr-day">
                <DayHead day={key} count={items.length}
                  total={sums.length ? sums.map((x) => `+${x.symbol} ${formatNumber(x.total)}`).join(' · ') : '—'}
                />

                <ul>
                  {items.map((r) => {
                    const active = isActive(r);
                    const acc = r.acount;
                    const symbol = currencySymbol(curOf(r));
                    const recorded = moment(r.createdAt);
                    const backdated = !incomeDateOf(r).isSame(recorded, 'day');
                    const isTransfer = Number(r.receive_type) === TRANSFER;
                    const open = () => setViewing(r);
                    return (
                      <li key={r._uuid} className={`acc-jr-row${active ? '' : ' is-cancelled'}`}
                        role="button" tabIndex={0} onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            open();
                          }
                        }}
                      >
                        {/* ວິທີຮັບເງິນ: ເງິນສົດ (ຄຳ) / ເງິນໂອນ (ຟ້າ) */}
                        <span className={`acc-jr-avatar acc-tone ${isTransfer ? 'is-sky' : 'is-gold'}`}
                          title={t(isTransfer ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}
                        >
                          <i className={`fa-solid ${isTransfer ? 'fa-building-columns' : 'fa-money-bill-wave'}`} />
                        </span>

                        <div className="acc-jr-main">
                          <b className="acc-jr-title" title={r.incom_title}>{r.incom_title}</b>
                          <div className="acc-jr-meta">
                            <span className="acc-jr-no">{r.number}</span>
                            {r.typein && <span className="acc-jr-cat">{r.typein.type_code} · {r.typein.type_name}</span>}
                            {(r.partner || r.payer_name) && (
                              <span className={`acc-jr-cust${r.partner ? '' : ' is-manual'}`} title={t('incomeCustomer')}>
                                <i className={`fa-solid ${r.partner ? 'fa-user' : 'fa-pen'}`} /> {r.partner?.name ?? r.payer_name}
                              </span>
                            )}
                            {!active && <span className="acc-jr-pill">{t('incomeCancelled')}</span>}
                            {backdated && (
                              <span className="acc-jr-backdated" title={recorded.format('DD/MM/YYYY HH:mm')}>
                                <i className="fa-solid fa-clock-rotate-left" /> {t('incomeBackdated')}
                              </span>
                            )}
                            <span className="acc-jr-dim"><i className="fa-regular fa-clock" /> {recorded.format('HH:mm')}</span>
                            {r.user?.user_name && <span className="acc-jr-dim"><i className="fa-regular fa-user" /> {r.user.user_name}</span>}
                            {r.file_url && <span className="acc-jr-clip" title={t('incomeStepFile')}><i className="fa-solid fa-paperclip" /></span>}
                          </div>
                          {r.description && <p title={r.description}>{r.description}</p>}
                        </div>

                        {/* ເຂົ້າບັນຊີໃດ + ມາຈາກໃສ */}
                        <div className="acc-jr-dest">
                          <span className="acc-jr-dest-logo" title={acc?.banks?.name_la ?? t('treasuryNoBank')}>
                            {acc?.banks?.url ? <img src={acc.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                          </span>
                          <span className="acc-jr-dest-text">
                            <small>{t('incomeInto')}</small>
                            <b title={acc?.acountName}>{acc?.acountName ?? '—'}</b>
                            {isTransfer ? (
                              <em>
                                {r.payerBank?.url && <img src={r.payerBank.url} alt="" />}
                                {[t('incomeTransferFrom'), r.payerBank?.abbr ?? r.payerBank?.name_la, r.payer_account_name].filter(Boolean).join(' · ')}
                              </em>
                            ) : (
                              <em>{t('incomeReceiveCash')}</em>
                            )}
                          </span>
                        </div>

                        <div className="acc-jr-amount">
                          <b>+{symbol} {formatNumber(r.balance_income)}</b>
                          {Number(r.tax) > 0 && <small>{t('incomeTaxField')} {formatNumber(r.tax)}</small>}
                        </div>

                        {/* ປຸ່ມ — ບໍ່ໃຫ້ກົດທະລຸໄປເປີດລາຍລະອຽດ */}
                        <div className="acc-jr-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          {active && (
                            <>
                              <button type="button" className="acc-jr-act" disabled={!canEdit}
                                title={t('edit')} aria-label={t('edit')} onClick={() => setEditing(r)}
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button type="button" className="acc-jr-act is-danger" disabled={!canDelete}
                                title={t('incomeCancel')} aria-label={t('incomeCancel')} onClick={() => cancelIncome(r)}
                              >
                                <i className="fa-solid fa-ban" />
                              </button>
                            </>
                          )}
                          <i className="fa-solid fa-chevron-right acc-jr-chevron" aria-hidden="true" />
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
        <div className="acc-class-empty">
          <i className="fa-solid fa-arrow-trend-up" />
          <p>{rows.length ? t('incomeNoMatch') : t('incomeEmpty')}</p>
          {!rows.length && (
            <button type="button" className="acc-fc-add acc-tone is-emerald mt-2" disabled={!canCreate} onClick={() => setEditing(null)}>
              <i className="fa-solid fa-plus" /> {t('incomeAdd')}
            </button>
          )}
        </div>
      )}

      {viewing && (
        <IncomeDetail
          income={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onCancel={() => cancelIncome(viewing)}
        />
      )}

      {editing !== undefined && (
        <IncomeForm data={editing} accounts={accounts} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default IncomePage;
