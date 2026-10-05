import { useEffect, useRef, useState } from 'react';
import { DatePicker, Form, Loader, NumberInput, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import numeral from 'numeral';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { deleteApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { CardAction, FormSection, ListState, SettingModal, SettingToolbar } from './settingKit';
import { postfixProp, runSave, toApiDate, useSettingList } from './settingApi';

type Currency = { _id: number; name: string; laos?: string; icon?: string; genus?: string; reate?: string | number; updatedAt?: string };

type RateRow = { _uuid: number; currencyId: number; rate: string | number; rate_date: string; description?: string; createby?: string };

const fmtRate = (value: unknown) => numeral(Number(value) || 0).format('0,0.[0000]');

/** ສະກຸນເງິນຫຼັກ (ກີບ) — ອັດຕາຂອງສະກຸນອື່ນທຽບໃສ່ອັນນີ້ */
const isBase = (c: Currency) => c.name === 'LAK' || Number(c.reate) === 1;
const symbolOf = (c?: Currency) => c?.genus || c?.name || '';

const RateForm = ({ currency, baseSymbol, onClose, onSaved }: {
  currency: Currency;
  baseSymbol: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({ rate_date: new Date(), rate: Number(currency.reate) || 0, description: '' });
  const model = createModel<any>({
    rate_date: requiredField(t('selectRequired'), 'date'),
    rate: requiredField(t('inputRequired'), 'number', { min: 0.0001 }),
  });

  const current = Number(currency.reate) || 0;
  const next = Number(inputs.rate) || 0;
  const change = current ? ((next - current) / current) * 100 : 0;

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = { currencyId: currency._id, rate: next, rate_date: toApiDate(inputs.rate_date), description: inputs.description };
    if (await runSave(() => postApi('/exchange-rate/create', payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={`${t('curUpdateRate')} · ${currency.name}`} hint={t('curRateHint')} icon="fa-arrow-right-arrow-left" saving={saving} onClose={onClose} onSubmit={submit}>
      <div className="acs-docno-hero">
        <small>{t('curRate')}</small>
        <code className="acs-docno">
          <span className="is-prefix">1 {symbolOf(currency)}</span> <em>=</em> <span className="is-seq">{fmtRate(next)} {baseSymbol}</span>
        </code>
        {current > 0 && next > 0 && next !== current && (
          <span className={`acs-change ${change > 0 ? 'is-up' : 'is-down'}`}>
            <i className={`fa-solid fa-arrow-${change > 0 ? 'up' : 'down'}`} /> {Math.abs(change).toFixed(2)}% · {fmtRate(current)}
          </span>
        )}
      </div>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <InputField name="rate_date" label={t('curRateDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
          <InputField name="rate" label={t('curRate')} accepter={NumberInput} prefix={`1 ${symbolOf(currency)} =`} {...postfixProp(baseSymbol)} />
          <div className="is-wide">
            <InputField name="description" label={t('note')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

const CurrencyForm = ({ currency, onClose, onSaved }: { currency: Currency; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({ name: currency.name, laos: currency.laos ?? '', genus: currency.genus ?? '' });
  const model = createModel<any>({
    name: requiredField(t('inputRequired'), 'string'),
    genus: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = { name: String(inputs.name).trim().toUpperCase(), laos: inputs.laos, genus: String(inputs.genus).trim() };
    if (await runSave(() => putApi(`/currency/${btoa(String(currency._id))}`, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('curEdit')} hint={t('curEditHint')} icon="fa-coins" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <InputField name="name" label={t('curCode')} placeholder="USD" className="acc-book-upper" />
          <InputField name="genus" label={t('curSymbol')} placeholder="$" />
          <div className="is-wide"><InputField name="laos" label={t('curLaoName')} required={false} /></div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ສະກຸນເງິນ ແລະ ອັດຕາແລກປ່ຽນ — ອັດຕາປັດຈຸບັນຂອງແຕ່ລະສະກຸນທຽບກີບ + ປະຫວັດການປ່ຽນອັດຕາ.
 * ບັນທຶກອັດຕາໃໝ່ຜ່ານ /exchange-rate/create ເຊິ່ງອັບເດດ tbl_currency.reate ໃຫ້ໜ້າອື່ນໃຊ້ຕໍ່
 */
const CurrencyRatePage = () => {
  const t = useT();
  const { rows: currencies, loading, reload } = useSettingList<Currency>('/currency');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<RateRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rateFor, setRateFor] = useState<Currency | null>(null);
  const [editFor, setEditFor] = useState<Currency | null>(null);

  const base = currencies.find(isBase);
  const baseSymbol = symbolOf(base) || '₭';
  const foreign = currencies.filter((c) => !isBase(c));
  const selected = currencies.find((c) => c._id === selectedId) ?? foreign[0];

  const loadHistory = async (currencyId?: number) => {
    if (!currencyId) return;
    try {
      setHistoryLoading(true);
      const res = await postApi('/exchange-rate/fetch', { currencyId });
      setHistory(res.data?.data || []);
    } catch (error) {
      console.error(error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(selected?._id);
  }, [selected?._id]);

  const afterRate = () => {
    reload();
    loadHistory(selected?._id);
  };

  const removeRate = (row: RateRow) =>
    Notific.confirm('curDeleteRateConfirm', async () => {
      try {
        await deleteApi(`/exchange-rate/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        afterRate();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetCurrency'), value: currencies.length },
          { label: t('curBase'), value: base?.name ?? '—', tone: 'green' },
        ]}
      />

      <ListState loading={loading} empty={!currencies.length} icon="fa-coins">
        <div className="acs-cur-grid">
          {currencies.map((c) => {
            const baseRow = isBase(c);
            const active = !baseRow && selected?._id === c._id;
            return (
              <div key={c._id} role="button" tabIndex={0}
                className={`acs-cur-card${active ? ' is-active' : ''}${baseRow ? ' is-base' : ''}`}
                onClick={() => !baseRow && setSelectedId(c._id)}
                onKeyDown={(e) => e.key === 'Enter' && !baseRow && setSelectedId(c._id)}
              >
                <span className="acs-cur-symbol">{symbolOf(c)}</span>
                <span className="acs-cur-name">
                  <b>{c.name}</b>
                  <small>{c.laos}</small>
                </span>
                <span className="acs-cur-rate">
                  {baseRow ? (
                    <em><i className="fa-solid fa-anchor" /> {t('curBase')}</em>
                  ) : (
                    <>
                      <small>1 {symbolOf(c)} =</small>
                      <b>{fmtRate(c.reate)} <i>{baseSymbol}</i></b>
                    </>
                  )}
                </span>
                <span className="acs-cur-actions" onClick={(e) => e.stopPropagation()}>
                  {!baseRow && (
                    <CardAction icon="fa-arrow-right-arrow-left" label={t('curUpdateRate')} tone="accent" disabled={!canEdit} onClick={() => setRateFor(c)} />
                  )}
                  <CardAction icon="fa-pen" label={t('curEdit')} disabled={!canEdit} onClick={() => setEditFor(c)} />
                </span>
              </div>
            );
          })}
        </div>

        {selected && (
          <section className="acs-panel">
            <header>
              <span className="acs-cur-symbol is-sm">{symbolOf(selected)}</span>
              <b>{t('curHistory')} · {selected.name}</b>
              <button type="button" className="acc-class-add" disabled={!canEdit} onClick={() => setRateFor(selected)}>
                <i className="fa-solid fa-plus" /> {t('curUpdateRate')}
              </button>
            </header>
            {historyLoading ? (
              <div className="text-center py-4"><Loader size="sm" content={t('loadingDots')} /></div>
            ) : history.length ? (
              <table className="acs-table">
                <thead>
                  <tr>
                    <th>{t('curRateDate')}</th>
                    <th className="text-end">{t('curRate')}</th>
                    <th className="text-end">{t('change')}</th>
                    <th>{t('note')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => {
                    const prev = history[i + 1];
                    const diff = prev ? ((Number(row.rate) - Number(prev.rate)) / Number(prev.rate)) * 100 : 0;
                    return (
                      <tr key={row._uuid} className={i === 0 ? 'is-latest' : ''}>
                        <td>{moment(row.rate_date, 'YYYY-MM-DD').format('DD/MM/YYYY')}</td>
                        <td className="text-end acs-num">{fmtRate(row.rate)} {baseSymbol}</td>
                        <td className="text-end">
                          {prev && diff !== 0 ? (
                            <span className={`acs-change ${diff > 0 ? 'is-up' : 'is-down'}`}>
                              <i className={`fa-solid fa-arrow-${diff > 0 ? 'up' : 'down'}`} /> {Math.abs(diff).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="acs-muted">{row.description || '—'}</td>
                        <td className="text-end">
                          <CardAction icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => removeRate(row)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="acs-panel-empty">{t('curNoHistory')}</p>
            )}
          </section>
        )}
      </ListState>

      {rateFor && <RateForm currency={rateFor} baseSymbol={baseSymbol} onClose={() => setRateFor(null)} onSaved={afterRate} />}
      {editFor && <CurrencyForm currency={editFor} onClose={() => setEditFor(null)} onSaved={reload} />}
    </div>
  );
};

export default CurrencyRatePage;
