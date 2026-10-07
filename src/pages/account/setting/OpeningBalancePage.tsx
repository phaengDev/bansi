import { useEffect, useState } from 'react';
import { Loader, NumberInput, SelectPicker } from 'rsuite';
import numeral from 'numeral';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { useFiscalYears } from '../../../utils/selectOption';
import { ListState, SettingToolbar } from './settingKit';
import { runSave, useSettingList } from './settingApi';
import { toneOf } from './accountTone';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import { currencySymbol } from '../ledger/currency';

type OpeningRow = { account_id: number; balance_usable: string | number; balance_held: string | number };
type Amounts = { usable: number; held: number };

const fmt = (n: number) => numeral(n).format('0,0.[00]');
const same = (a?: Amounts, b?: Amounts) => (a?.usable ?? 0) === (b?.usable ?? 0) && (a?.held ?? 0) === (b?.held ?? 0);

/**
 * ຍອດຍົກມາ — ຍອດເງິນຕົ້ນປີການເງິນຂອງທຸກບັນຊີເງິນຄັງ ປ້ອນເປັນຕາຕະລາງ ແລ້ວບັນທຶກເທື່ອດຽວ.
 * "ດຶງຍອດປັດຈຸບັນ" ເອົາຍອດໃນບັນຊີຕອນນີ້ມາໃສ່ (ຍົກຍອດຈາກປີກ່ອນ). ປີທີ່ປິດບັນຊີແລ້ວເບິ່ງໄດ້ຢ່າງດຽວ
 */
const OpeningBalancePage = () => {
  const t = useT();
  const years = useFiscalYears();
  const yearsLoading = years.loading;
  const { rows: accounts, loading: accountsLoading } = useSettingList<TreasuryAccount>('/treasury-account/fetch', 'post');
  const [fiscalId, setFiscalId] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, Amounts>>({});
  const [values, setValues] = useState<Record<number, Amounts>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ເລືອກປີປັດຈຸບັນໃຫ້ກ່ອນ
  useEffect(() => {
    if (fiscalId == null && years.length) setFiscalId((years.find((y) => Number(y.is_current) === 1) ?? years[0])._uuid);
  }, [years, fiscalId]);

  const load = async (id: number) => {
    try {
      setLoading(true);
      const res = await postApi('/opening-balance/fetch', { fiscal_id: id });
      const map: Record<number, Amounts> = {};
      (res.data?.data as OpeningRow[] | undefined ?? []).forEach((r) => {
        map[r.account_id] = { usable: Number(r.balance_usable) || 0, held: Number(r.balance_held) || 0 };
      });
      setSaved(map);
      setValues(map);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fiscalId) load(fiscalId);
  }, [fiscalId]);

  const fiscal = years.find((y) => y._uuid === fiscalId);
  const closed = Number(fiscal?.status) === 2;
  const readOnly = closed || !canEdit;
  const valueOf = (id: number): Amounts => values[id] ?? { usable: 0, held: 0 };
  const setValue = (id: number, key: keyof Amounts, raw: unknown) =>
    setValues((prev) => ({ ...prev, [id]: { ...valueOf(id), ...prev[id], [key]: Number(raw) || 0 } }));

  const dirtyCount = accounts.filter((a) => !same(values[a._uuid], saved[a._uuid])).length;

  // ຈັດກຸ່ມຕາມປະເພດບັນຊີ ຄືກັບໜ້າປຶ້ມບັນຊີໃຫຍ່
  const groups = [...accounts.reduce((map, a) => {
    const g = map.get(a.type_treasuryid) ?? { type: a.treasury, items: [] as TreasuryAccount[] };
    g.items.push(a);
    return map.set(a.type_treasuryid, g);
  }, new Map<number, { type?: TreasuryAccount['treasury']; items: TreasuryAccount[] }>()).entries()]
    .sort(([, a], [, b]) => String(a.type?.treasury_code ?? '').localeCompare(String(b.type?.treasury_code ?? '')));

  // ລວມຕາມສະກຸນເງິນ (ບວກຂ້າມສະກຸນບໍ່ໄດ້)
  const byCurrency = accounts.reduce((map, a) => {
    const cur = a.treasury?.currency;
    const key = cur?.name ?? '—';
    const v = valueOf(a._uuid);
    const row = map.get(key) ?? { symbol: currencySymbol(cur), total: 0 };
    row.total += v.usable + v.held;
    return map.set(key, row);
  }, new Map<string, { symbol: string; total: number }>());

  const pullCurrent = () =>
    Notific.confirm('obPullConfirm', () =>
      setValues(Object.fromEntries(accounts.map((a) => [a._uuid, { usable: Number(a.balance_treasury) || 0, held: Number(a.balance_unable) || 0 }]))),
    );

  const save = async () => {
    if (!fiscalId) return;
    const items = accounts.map((a) => ({ account_id: a._uuid, balance_usable: valueOf(a._uuid).usable, balance_held: valueOf(a._uuid).held }));
    if (await runSave(() => postApi('/opening-balance/save', { fiscal_id: fiscalId, items }), setSaving)) load(fiscalId);
  };

  const sum = (list: TreasuryAccount[], pick: (a: TreasuryAccount) => number) => list.reduce((n, a) => n + pick(a), 0);
  const currentOf = (a: TreasuryAccount) => (Number(a.balance_treasury) || 0) + (Number(a.balance_unable) || 0);

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('obAccount'), value: accounts.length },
          { label: t('obSaved'), value: Object.keys(saved).length, tone: 'green' },
        ]}
      >
        <SelectPicker
          className="acs-toolbar-select"
          size="sm"
          cleanable={false}
          searchable={false}
          loading={yearsLoading}
          placeholder={t('accountSetFiscalYear')}
          value={fiscalId}
          onChange={setFiscalId}
          data={years.map((y) => ({
            value: y._uuid,
            label: `${y.fiscal_code}${y.fiscal_name ? ` · ${y.fiscal_name}` : ''}${Number(y.status) === 2 ? ` (${t('fyClosed')})` : ''}`,
          }))}
        />
        <button type="button" className="acs-btn-ghost" disabled={readOnly || !accounts.length} onClick={pullCurrent}>
          <i className="fa-solid fa-arrow-rotate-left" /> {t('obPullCurrent')}
        </button>
        <button type="button" className="acc-class-add" disabled={readOnly || !fiscalId || saving || !dirtyCount} onClick={save}>
          {saving ? <Loader size="xs" /> : <i className="fa-solid fa-floppy-disk" />} {t('save')}
        </button>
      </SettingToolbar>

      {!yearsLoading && !years.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-calendar-xmark" /><p>{t('obNoFiscal')}</p></div>
      ) : (
        <>
          {closed && <div className="acs-banner is-muted"><i className="fa-solid fa-lock" /> {t('obClosedNotice')}</div>}
          {!closed && dirtyCount > 0 && (
            <div className="acs-banner is-warn"><i className="fa-solid fa-pen-to-square" /> {t('obUnsaved')} ({dirtyCount})</div>
          )}

          <ListState loading={accountsLoading || loading} empty={!accounts.length} icon="fa-vault">
            <div className="acs-table-wrap">
              <table className="acs-table acs-ob-table">
                <thead>
                  <tr>
                    <th>{t('obAccount')}</th>
                    <th className="text-end">{t('obCurrentBalance')}</th>
                    <th>{t('treasuryBalanceUsable')}</th>
                    <th>{t('treasuryBalanceHeld')}</th>
                    <th className="text-end">{t('obOpening')} · {t('total')}</th>
                  </tr>
                </thead>
                {groups.map(([id, g]) => {
                  const symbol = currencySymbol(g.type?.currency);
                  return (
                    <tbody key={id} className={`acc-tone ${toneOf(g.type?.types?.type_code ?? g.type?.treasury_code ?? '')}`}>
                      <tr className="acs-group-row">
                        <td colSpan={5}>
                          <span className="acc-type-group-code">{g.type?.treasury_code ?? '—'}</span>
                          <b>{g.type?.treasury_name ?? t('notSpecified')}</b>
                          {g.type?.currency && <em>{symbol} {g.type.currency.name}</em>}
                        </td>
                      </tr>
                      {g.items.map((a) => {
                        const v = valueOf(a._uuid);
                        const dirty = !same(values[a._uuid], saved[a._uuid]);
                        return (
                          <tr key={a._uuid} className={`${dirty ? 'is-dirty' : ''}${Number(a.status) === 1 ? '' : ' is-off'}`}>
                            <td>
                              <div className="acs-ob-account">
                                <span className="acs-ob-logo">
                                  {a.banks?.url ? <img src={a.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                                </span>
                                <span>
                                  <b title={a.acountName}>{a.acountName}</b>
                                  <small>{[a.banks?.abbr, a.acount_number].filter(Boolean).join(' · ') || '—'}</small>
                                </span>
                              </div>
                            </td>
                            <td className="text-end acs-num acs-muted">{fmt(currentOf(a))}</td>
                            <td>
                              <NumberInput size="sm" value={v.usable} disabled={readOnly} min={0} prefix={symbol || undefined}
                                formatter={(x) => fmt(Number(x) || 0)} onChange={(x) => setValue(a._uuid, 'usable', x)}
                              />
                            </td>
                            <td>
                              <NumberInput size="sm" value={v.held} disabled={readOnly} min={0} prefix={symbol || undefined}
                                formatter={(x) => fmt(Number(x) || 0)} onChange={(x) => setValue(a._uuid, 'held', x)}
                              />
                            </td>
                            <td className="text-end acs-num"><b>{symbol} {fmt(v.usable + v.held)}</b></td>
                          </tr>
                        );
                      })}
                      <tr className="acs-subtotal">
                        <td>{t('total')}</td>
                        <td className="text-end acs-num">{fmt(sum(g.items, currentOf))}</td>
                        <td className="acs-num">{symbol} {fmt(sum(g.items, (a) => valueOf(a._uuid).usable))}</td>
                        <td className="acs-num">{symbol} {fmt(sum(g.items, (a) => valueOf(a._uuid).held))}</td>
                        <td className="text-end acs-num"><b>{symbol} {fmt(sum(g.items, (a) => valueOf(a._uuid).usable + valueOf(a._uuid).held))}</b></td>
                      </tr>
                    </tbody>
                  );
                })}
              </table>
            </div>

            <div className="acs-totals">
              {[...byCurrency.entries()].map(([code, row]) => (
                <span key={code}>
                  <small>{t('obOpening')} · {code}</small>
                  <b>{row.symbol} {fmt(row.total)}</b>
                </span>
              ))}
            </div>
          </ListState>
        </>
      )}
    </div>
  );
};

export default OpeningBalancePage;
