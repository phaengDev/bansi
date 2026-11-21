import type { ReactNode } from 'react';
import { NumberInput } from 'rsuite';
import { useT } from '../../../context/LanguageContext';
import { kip, kipFormatter } from './payrollApi';
import { ADVANCE_STATUSES, ADV_PENDING, type SalaryAdvance } from './advanceApi';

/** ເງິນເບີກລ່ວງໜ້າ — ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າ HR (AdvancePage) ແລະ ພື້ນທີ່ຂອງຂ້ອຍ (ພະນັກງານຂໍເອງ) */

export const AdvanceStatusPill = ({ status }: { status: number }) => {
  const t = useT();
  const state = ADVANCE_STATUSES[status] ?? ADVANCE_STATUSES[ADV_PENDING];
  return <span className={`att-state ${state.tone}`}><i className={`fa-solid ${state.icon}`} /> {t(state.label)}</span>;
};

/** ຊ່ອງໃນຟອມ: ປ້າຍ (+ *), ເນື້ອໃນ, ຄຳແນະນຳລຸ່ມຊ່ອງ */
export const AdvanceField = ({ label, required, hint, wide, children }: { label: string; required?: boolean; hint?: ReactNode; wide?: boolean; children: ReactNode }) => (
  <div className={`rs-form-group${wide ? ' is-wide' : ''}`}>
    <label className="form-label">{label}{required && <span className="text-danger">*</span>}</label>
    {children}
    {hint && <small className="pay-field-hint">{hint}</small>}
  </div>
);

export const MoneyField = ({ value, onChange, max }: { value: number; onChange: (value: number) => void; max?: number | null }) => (
  <NumberInput value={value} onChange={(v) => onChange(Math.max(0, Math.min(max ?? Infinity, Number(v) || 0)))} formatter={kipFormatter} controls={false} prefix="₭" min={0} />
);

/** ຍອດເບີກ / ຄືນແລ້ວ / ຄ້າງ + ແຖບຄວາມຄືບໜ້າການຄືນ */
export const AdvanceProgress = ({ row }: { row: Pick<SalaryAdvance, 'amount' | 'repaid' | 'balance'> }) => {
  const t = useT();
  const percent = row.amount > 0 ? Math.min(100, Math.round((row.repaid / row.amount) * 100)) : 0;
  return (
    <>
      <div className="adv-sum">
        <span><small>{t('advAmount')}</small><b>₭ {kip(row.amount)}</b></span>
        <span><small>{t('advRepaid')}</small><b>₭ {kip(row.repaid)}</b></span>
        <span className={row.balance > 0 ? 'is-due' : ''}><small>{t('advBalance')}</small><b>₭ {kip(row.balance)}</b></span>
      </div>
      <div className="adv-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div>
    </>
  );
};
