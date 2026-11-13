import { formatNumber } from '../../../utils/configApi';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import type { TreasuryAccount } from './TreasuryAccountForm';
import { currencySymbol, currencyTone, kipFirst } from './currency';
import { CASH_CLASS_CODE } from '../journal/journalKit';
import { useLogoTones } from './logoTone';

type Currency = NonNullable<AccountType['currency']>;

/** ຂໍ້ມູນທີ່ສອງມຸມມອງໃຊ້ຮ່ວມກັນ — ສົ່ງມາຈາກ TreasuryAccountPage (ແຖວທີ່ກັ່ນແລ້ວ, ລຽງຕາມທີ່ຈັດໄວ້) */
type Shared = {
  rows: TreasuryAccount[];
  typeOf: (r: TreasuryAccount) => AccountType | undefined;
};

const usableOf = (r: TreasuryAccount) => Number(r.balance_treasury ?? 0);
const heldOf = (r: TreasuryAccount) => Number(r.balance_unable ?? 0);
const totalOf = (r: TreasuryAccount) => usableOf(r) + heldOf(r);
const isActive = (r: TreasuryAccount) => Number(r.status) === 1;
const money = (cur: Currency | undefined, value: number) => `${currencySymbol(cur)} ${formatNumber(value)}`;

/** ທະນາຄານຂອງບັນຊີ — ບໍ່ຜູກ = ເງິນສົດ (ໝວດເງິນສົດ) / ບໍ່ຜູກທະນາຄານ; key 0 */
const useBankOf = (typeOf: Shared['typeOf']) => {
  const t = useT();
  return (r: TreasuryAccount) => ({
    key: Number(r.bankId || 0),
    name: r.banks ? r.banks.abbr || r.banks.name_la || '' : t(typeOf(r)?.types?.type_code === CASH_CLASS_CODE ? 'incomeReceiveCash' : 'treasuryNoBank'),
    full: r.banks?.name_la ?? '',
    logo: r.banks?.url ?? null,
  });
};

/** ສະກຸນເງິນ: ກີບກ່ອນ ແລ້ວຕາມລຳດັບທີ່ພົບ (ລຽງຕາມລຳດັບບັດ) */
const currenciesOf = (rows: TreasuryAccount[], typeOf: Shared['typeOf']) => {
  const map = new Map<number, Currency>();
  rows.forEach((r) => {
    const cur = typeOf(r)?.currency;
    if (cur) map.set(Number(typeOf(r)?.currencyId ?? 0), cur);
  });
  return kipFirst([...map.entries()].map(([id, cur]) => ({ id, cur })), (x) => x.cur);
};

const curIdOf = (r: TreasuryAccount, typeOf: Shared['typeOf']) => Number(typeOf(r)?.currencyId ?? 0);

/** ປ້າຍສະກຸນເງິນ ₭ LAK / $ USD / ฿ THB — ສີຕາມສະກຸນ */
export const CurrencyPill = ({ cur }: { cur?: Currency | null }) =>
  cur ? <span className={`acc-cur-pill ${currencyTone(cur)}`}>{currencySymbol(cur)} {cur.name}</span> : null;

const Logo = ({ url, name }: { url: string | null; name: string }) => (
  <span className="acc-ov-logo">{url ? <img src={url} alt={name} /> : <i className="fa-solid fa-wallet" />}</span>
);

/**
 * ມຸມມອງ "ພາບລວມ" — ເຫັນທຸກຢ່າງໃນໜ້າດຽວ:
 * 1) ຕາຕະລາງ ທະນາຄານ × ສະກຸນເງິນ (ແຕ່ລະທະນາຄານມີເງິນເທົ່າໃດ ແຕ່ລະສະກຸນ, ແຖວລຸ່ມ = ລວມ)
 * 2) ລາຍການບັນຊີທັງໝົດ ຈັດກຸ່ມຕາມປະເພດບັນຊີ (ລຳດັບດຽວກັບບັດ) ພ້ອມຍອດໃຊ້ໄດ້ / ຄ້າງ / ລວມ ແລະ ປຸ່ມປະຫວັດ
 */
export const TreasuryTable = ({ rows, typeOf, onStatement, onMovements, onTransfer, onEdit }: Shared & {
  onStatement: (r: TreasuryAccount) => void;
  onMovements: (r: TreasuryAccount) => void;
  onTransfer: (r: TreasuryAccount) => void;
  onEdit: (r: TreasuryAccount) => void;
}) => {
  const t = useT();
  const bankOf = useBankOf(typeOf);
  const currencies = currenciesOf(rows, typeOf);

  // ທະນາຄານ × ສະກຸນເງິນ
  const banks = new Map<number, { name: string; full: string; logo: string | null; count: number; sums: Map<number, number> }>();
  rows.forEach((r) => {
    const b = bankOf(r);
    const row = banks.get(b.key) ?? { ...b, count: 0, sums: new Map<number, number>() };
    const cur = curIdOf(r, typeOf);
    row.count += 1;
    row.sums.set(cur, (row.sums.get(cur) ?? 0) + totalOf(r));
    banks.set(b.key, row);
  });
  const totalIn = (curId: number) => rows.filter((r) => curIdOf(r, typeOf) === curId).reduce((n, r) => n + totalOf(r), 0);

  // ກຸ່ມຕາມປະເພດບັນຊີ — ລຽງຕາມລະຫັດປະເພດ ຄືມຸມມອງບັດ
  const groups = new Map<number, { type?: AccountType; items: TreasuryAccount[] }>();
  rows.forEach((r) => {
    const g = groups.get(r.type_treasuryid) ?? { type: typeOf(r), items: [] };
    g.items.push(r);
    groups.set(r.type_treasuryid, g);
  });
  const ordered = [...groups.values()].sort((a, b) => String(a.type?.treasury_code ?? '').localeCompare(String(b.type?.treasury_code ?? '')));

  return (
    <div className="acc-ov">
      <section className="acc-ov-card">
        <h6 className="acc-ov-title"><i className="fa-solid fa-building-columns" /> {t('treasuryByBank')}</h6>
        <div className="acc-rp-scroll">
          <table className="acc-gl-table acc-ov-matrix">
            <thead>
              <tr>
                <th>{t('bank')}</th>
                {currencies.map(({ id, cur }) => <th key={id} className="is-num">{cur.name}</th>)}
                <th className="is-num">{t('treasuryAccounts')}</th>
              </tr>
            </thead>
            <tbody>
              {[...banks.entries()].map(([key, b]) => (
                <tr key={key}>
                  <td>
                    <span className="acc-ov-bank"><Logo url={b.logo} name={b.name} /><span><b>{b.name}</b>{b.full && b.full !== b.name && <small>{b.full}</small>}</span></span>
                  </td>
                  {currencies.map(({ id, cur }) => {
                    const sum = b.sums.get(id);
                    return (
                      <td key={id} className={`is-num${sum !== undefined && sum < 0 ? ' is-negative' : ''}`}>
                        {sum === undefined ? <span className="acc-gl-ref">—</span> : money(cur, sum)}
                      </td>
                    );
                  })}
                  <td className="is-num">{b.count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('total')}</td>
                {currencies.map(({ id, cur }) => <td key={id} className="is-num">{money(cur, totalIn(id))}</td>)}
                <td className="is-num">{rows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="acc-ov-card">
        <h6 className="acc-ov-title"><i className="fa-solid fa-list" /> {t('treasuryAllAccounts')}</h6>
        <div className="acc-rp-scroll">
          <table className="acc-gl-table acc-ov-table">
            <thead>
              <tr>
                <th>{t('accountName')}</th>
                <th>{t('bank')}</th>
                <th>{t('accountNumber')}</th>
                <th className="is-num">{t('treasuryBalanceUsable')}</th>
                <th className="is-num">{t('treasuryBalanceHeld')}</th>
                <th className="is-num">{t('treasuryBalanceTotal')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordered.map(({ type, items }) => {
                const cur = type?.currency;
                const sum = items.reduce((n, r) => n + totalOf(r), 0);
                return [
                  <tr key={`g-${type?._uuid ?? items[0]._uuid}`} className="acc-ov-group">
                    <td colSpan={5}>
                      <span className="acc-ov-code">{type?.treasury_code ?? '—'}</span> {type?.treasury_name ?? t('notSpecified')}
                      <em>{items.length}</em>
                      <CurrencyPill cur={cur} />
                    </td>
                    <td className={`is-num${sum < 0 ? ' is-negative' : ''}`}>{money(cur, sum)}</td>
                    <td />
                  </tr>,
                  ...items.map((r) => {
                    const b = bankOf(r);
                    const total = totalOf(r);
                    return (
                      <tr key={r._uuid} className={isActive(r) ? '' : 'is-off'}>
                        <td>
                          <b className="acc-ov-name">{r.acountName}</b>
                          {!isActive(r) && <span className="acs-chip">{t('inactive')}</span>}
                        </td>
                        <td><span className="acc-ov-bank is-small"><Logo url={b.logo} name={b.name} /><span>{b.name}</span></span></td>
                        <td className="acc-ov-number">{r.acount_number || '—'}</td>
                        <td className={`is-num${usableOf(r) < 0 ? ' is-negative' : ''}`}>{formatNumber(usableOf(r))}</td>
                        <td className={`is-num${heldOf(r) < 0 ? ' is-negative' : ''}`}>{formatNumber(heldOf(r))}</td>
                        <td className={`is-num acc-ov-total${total < 0 ? ' is-negative' : ''}`}>{money(cur, total)}</td>
                        <td className="acc-gl-tree-actions">
                          <button type="button" className="acc-gl-act" title={t('stmtOpen')} aria-label={t('stmtOpen')} onClick={() => onStatement(r)}>
                            <i className="fa-solid fa-clock-rotate-left" />
                          </button>
                          <button type="button" className="acc-gl-act" title={t('mvOpen')} aria-label={t('mvOpen')} onClick={() => onMovements(r)}>
                            <i className="fa-solid fa-timeline" />
                          </button>
                          <button type="button" className="acc-gl-act" title={t('xferOut')} aria-label={t('xferOut')} disabled={!canCreate || !isActive(r)} onClick={() => onTransfer(r)}>
                            <i className="fa-solid fa-right-left" />
                          </button>
                          <button type="button" className="acc-gl-act" title={t('edit')} aria-label={t('edit')} disabled={!canEdit} onClick={() => onEdit(r)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

/**
 * ມຸມມອງ "ກຣາບ" — ບັດລະສະກຸນເງິນ (ບວກຂ້າມສະກຸນບໍ່ໄດ້): ຍອດລວມ + ແທ່ງລຽງຈາກຫຼາຍໄປໜ້ອຍ ແຕ່ລະທະນາຄານ
 * (ແທ່ງຍາວສຸດ = ທະນາຄານທີ່ມີຫຼາຍສຸດ), ຍອດ + % ຂອງສະກຸນຢູ່ປາຍແທ່ງ. ສີແທ່ງ = ສີໂລໂກ້ທະນາຄານ (ທະນາຄານດຽວກັນ ສີດຽວກັນທຸກສະກຸນ;
 * ເງິນສົດ / ໂລໂກ້ບໍ່ມີສີ = ສີຟ້າ). ຕົວໜັງສືບໍ່ໃຊ້ສີທະນາຄານ. ຊີ້ / tab ໃສ່ແຖວ = ບັນຊີໃນທະນາຄານນັ້ນ
 */
export const TreasuryCharts = ({ rows, typeOf }: Shared) => {
  const t = useT();
  const bankOf = useBankOf(typeOf);
  const tones = useLogoTones(rows.map((r) => r.banks?.url));
  const currencies = currenciesOf(rows, typeOf);

  return (
    <div className="acc-chart-grid">
      {currencies.map(({ id, cur }) => {
        const list = rows.filter((r) => curIdOf(r, typeOf) === id);
        const total = list.reduce((n, r) => n + totalOf(r), 0);
        const banks = new Map<number, { name: string; logo: string | null; total: number; accounts: TreasuryAccount[] }>();
        list.forEach((r) => {
          const b = bankOf(r);
          const row = banks.get(b.key) ?? { name: b.name, logo: b.logo, total: 0, accounts: [] };
          row.total += totalOf(r);
          row.accounts.push(r);
          banks.set(b.key, row);
        });
        const ranked = [...banks.entries()].sort((a, b) => b[1].total - a[1].total);
        const max = Math.max(1, ...ranked.map(([, b]) => b.total));
        return (
          <section key={id} className="acc-chart-card">
            <header>
              <span className="acc-chart-cur">{currencySymbol(cur)}</span>
              <span className="acc-chart-head">
                <small>{t('treasuryBalanceTotal')} · {cur.name}</small>
                <b className={total < 0 ? 'is-negative' : ''}>{formatNumber(total)}</b>
              </span>
              <em>{ranked.length} {t('bank')} · {list.length} {t('treasuryAccounts')}</em>
            </header>
            <ul className="acc-chart-bars">
              {ranked.map(([key, b]) => {
                const share = total > 0 && b.total > 0 ? (b.total / total) * 100 : 0;
                const width = b.total > 0 ? Math.max(1.5, (b.total / max) * 100) : 0;
                return (
                  <li key={key} tabIndex={0} aria-label={`${b.name}: ${money(cur, b.total)} (${share.toFixed(1)}%)`}>
                    <span className="acc-chart-label"><Logo url={b.logo} name={b.name} /><b>{b.name}</b></span>
                    <span className="acc-chart-track">
                      <i style={{ width: `${width}%`, ...(b.logo && tones[b.logo] ? { background: tones[b.logo]!.b } : {}) }} />
                    </span>
                    <span className={`acc-chart-value${b.total < 0 ? ' is-negative' : ''}`}>
                      <b>{formatNumber(b.total)}</b>
                      <small>{share >= 0.1 ? `${share.toFixed(1)}%` : '—'}</small>
                    </span>
                    {/* ບັນຊີໃນທະນາຄານນີ້ (ຊີ້ / focus) */}
                    <div className="acc-chart-tip" role="tooltip">
                      <b>{b.name} · {cur.name}</b>
                      {b.accounts.map((r) => (
                        <span key={r._uuid}><span>{r.acountName}{r.acount_number ? ` · ${r.acount_number}` : ''}</span><em>{formatNumber(totalOf(r))}</em></span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
