import { useEffect, useState } from 'react';
import { Form, Input, Loader, NumberInput } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { periodLabel, useGetData } from '../hr/attendance/attendanceApi';
import { kip } from '../hr/payroll/payrollApi';
import { ADV_ACTIVE, ADV_PENDING, ADV_SETTLED } from '../hr/payroll/advanceApi';
import { AdvanceField, AdvanceProgress, AdvanceStatusPill, MoneyField } from '../hr/payroll/advanceKit';
import { FormStep, SettingModal } from '../account/setting/settingKit';
import { idOf, type MyAdvanceData, type MyIntent } from './meApi';

/**
 * ຂໍເບີກເງິນລ່ວງໜ້າ — ຍອດ (ບໍ່ເກີນທີ່ຍັງເບີກໄດ້), ຈຳນວນງວດຫັກຄືນ (ບໍ່ເກີນທີ່ບໍລິສັດກຳນົດ) + ຫັກຕໍ່ເດືອນ, ເຫດຜົນ
 * → POST /advance/me (HR ອະນຸມັດ ແລະ ຈ່າຍ; ເລີ່ມຫັກຈາກເງິນເດືອນຕາມເດືອນທີ່ບໍລິສັດກຳນົດ)
 */
const AdvanceForm = ({ rules, onClose, onSaved }: { rules: MyAdvanceData['rules']; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [amount, setAmount] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const maxInstallments = Math.max(1, rules.max_installments || 1);
  const monthly = Math.ceil(amount / Math.max(1, installments));

  const submit = async () => {
    if (amount <= 0) return Notific.warning('advAmountRequired');
    if (!reason.trim()) return Notific.warning('advReasonRequired');
    try {
      setSaving(true);
      await postApi('/advance/me', { amount, installments, reason: reason.trim() });
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingModal title={t('myAdvNew')} hint={t('myAdvNewHint')} icon="fa-hand-holding-dollar" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
      submit={{ label: t('mySend'), icon: 'fa-paper-plane' }}
    >
      <Form fluid>
        <FormStep no={1} done={amount > 0} title={t('advAmount')}
          hint={rules.max_amount === null ? t('lvTypeUnlimited') : `${t('myAdvLimit')} ₭ ${kip(rules.max_amount)}${rules.max_percent ? ` (${rules.max_percent}% ${t('advOfSalary')})` : ''}`}
        >
          <AdvanceField label={t('advAmount')} required wide>
            <MoneyField value={amount} onChange={setAmount} max={rules.max_amount} />
          </AdvanceField>
        </FormStep>

        <FormStep no={2} done={amount > 0} title={t('advSchedule')} hint={`${t('advStartPeriod')} ${periodLabel(rules.start_period)}`}
          note={amount > 0 ? <><i className="fa-solid fa-money-check-dollar" /> {t('advMonthly')} ₭ {kip(monthly)}</> : undefined}
        >
          <AdvanceField label={t('advInstallments')} required hint={`1–${maxInstallments} ${t('advMonths')}`}>
            <NumberInput value={installments} min={1} max={maxInstallments} postfix={t('advMonths')}
              onChange={(v) => setInstallments(Math.min(maxInstallments, Math.max(1, Math.round(Number(v) || 1))))}
            />
          </AdvanceField>
          <AdvanceField label={t('advMonthly')}>
            <div className="my-readonly">₭ {kip(monthly)}</div>
          </AdvanceField>
        </FormStep>

        <FormStep no={3} done={!!reason.trim()} title={t('advReason')}>
          <AdvanceField label={t('advReason')} required wide>
            <Input as="textarea" rows={2} value={reason} onChange={setReason} maxLength={255} />
          </AdvanceField>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ເງິນເບີກລ່ວງໜ້າຂອງຂ້ອຍ — ຍອດຄ້າງ, ເງື່ອນໄຂ (ເປີດໃຫ້ເບີກ / ຍັງເບີກໄດ້ເທົ່າໃດ / ມີຄຳຂໍລໍຖ້າ), ທຸກລາຍການ ພ້ອມການຫັກຄືນ;
 * ຂໍໃໝ່ ແລະ ຍົກເລີກຄຳຂໍທີ່ຍັງລໍຖ້າ
 */
const MyAdvances = ({ intent, onIntentDone }: { intent?: MyIntent | null; onIntentDone: () => void }) => {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useGetData<MyAdvanceData>('/advance/me');
  const rules = data?.rules;
  const blocked = !rules ? null : !rules.enabled ? 'myAdvOff' : rules.pending ? 'myAdvPendingExists' : rules.max_amount !== null && rules.max_amount <= 0 ? 'myAdvNoLimitLeft' : null;

  useEffect(() => {
    if (intent?.action !== 'new' || !rules) return;
    if (blocked) Notific.warning(blocked);
    else setCreating(true);
    onIntentDone();
  }, [intent, rules, blocked, onIntentDone]);

  const cancel = (id: number) => Notific.confirm(t('myCancelConfirm'), async () => {
    try {
      await putApi(`/advance/me/cancel/${idOf({ _uuid: id })}`, {});
      Notific.success('saveSuccessDone');
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" disabled={!rules || !!blocked} onClick={() => setCreating(true)}>
              <i className="fa-solid fa-plus" /> {t('myAdvNew')}
            </button>
          </div>
        </div>
      </div>

      {!data || !rules ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="my-grid">
            <section className="my-card">
              <header><h3><i className="fa-solid fa-scale-unbalanced" /> {t('advBalance')}</h3></header>
              <b className={`my-big-amount${data.balance > 0 ? ' is-due' : ''}`}>₭ {kip(data.balance)}</b>
            </section>
            <section className="my-card">
              <header><h3><i className="fa-solid fa-list-check" /> {t('myAdvRules')}</h3></header>
              {blocked ? (
                <p className="my-form-warn"><i className="fa-solid fa-circle-info" /> {t(blocked)}</p>
              ) : (
                <ul className="my-facts">
                  <li><span>{t('myAdvLimit')}</span><b>{rules.max_amount === null ? t('lvTypeUnlimited') : `₭ ${kip(rules.max_amount)}`}</b></li>
                  <li><span>{t('advMaxInstallments')}</span><b>{rules.max_installments} {t('advMonths')}</b></li>
                  <li><span>{t('advStartPeriod')}</span><b>{periodLabel(rules.start_period)}</b></li>
                </ul>
              )}
            </section>
          </div>

          {!data.data.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-hand-holding-dollar" /><p>{t('myNoAdvances')}</p></div>
          ) : (
            <div className="my-advances">
              {data.data.map((row) => {
                const repaying = row.status === ADV_ACTIVE || row.status === ADV_SETTLED;
                return (
                  <article key={row._uuid} className="my-card my-advance">
                    <header>
                      <h3>
                        <i className="fa-solid fa-hand-holding-dollar" /> ₭ {kip(row.amount || row.requested_amount)}
                        {row.number && <small>{row.number}</small>}
                      </h3>
                      <AdvanceStatusPill status={row.status} />
                    </header>
                    {repaying && <AdvanceProgress row={row} />}
                    <ul className="my-facts">
                      <li><span>{t('advMonthly')}</span><b>₭ {kip(row.monthly_deduction)} · {row.installments} {t('advMonths')}</b></li>
                      <li><span>{t('advStartPeriod')}</span><b>{periodLabel(row.start_period)}</b></li>
                      <li className="is-wide"><span>{t('advReason')}</span><b>{row.reason}</b></li>
                      {row.review_note && <li className="is-wide"><span>{t('leaveReviewNote')}</span><b>{row.review_note}</b></li>}
                    </ul>
                    {!!row.repayments?.length && (
                      <ul className="adv-repayments">
                        {row.repayments.map((r, i) => (
                          <li key={r._uuid ?? i}>
                            <i className="fa-solid fa-money-check-dollar" />
                            <span>{r.period ? periodLabel(r.period) : moment(r.repay_date).format('DD/MM/YYYY')}</span>
                            <b>₭ {kip(r.amount)}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                    {row.status === ADV_PENDING && (
                      <footer>
                        <button type="button" className="lv-act is-reject" onClick={() => cancel(row._uuid)}>
                          <i className="fa-solid fa-ban" /> {t('myCancelRequest')}
                        </button>
                      </footer>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {creating && rules && <AdvanceForm rules={rules} onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
};

export default MyAdvances;
