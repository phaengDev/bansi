import { useCallback, useEffect, useRef, useState } from 'react';
import { Form, NumberInput } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { useT } from '../../../context/LanguageContext';
import { SettingModal, ToggleField } from '../setting/settingKit';
import { runSave } from '../setting/settingApi';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import ExpenseForm, { type RecurringExpense } from './ExpenseForm';

const enc = (id: number) => btoa(String(id));

/**
 * ຕັ້ງ / ແກ້ ລາຍຈ່າຍປະຈຳ — ຊື່ ແລະ ວັນທີຄົບກຳນົດແຕ່ລະເດືອນ (1–28). ສ້າງ = ຈາກລາຍຈ່າຍທີ່ບັນທຶກແລ້ວ (expenseId),
 * ແກ້ = ແມ່ແບບເດີມ (data) + ສະວິດໃຊ້ຢູ່/ຢຸດ
 */
export const RecurringForm = ({ data, expenseId, defaults, onClose, onSaved }: {
  data?: RecurringExpense;
  expenseId?: number;
  defaults?: { title: string; day: number };
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(data ? Number(data.status) === 1 : true);
  const [inputs, setInputs] = useState<any>({
    title: data?.title ?? defaults?.title ?? '',
    day_of_month: data?.day_of_month ?? Math.min(28, defaults?.day ?? 1),
  });
  const model = createModel<any>({ title: requiredField(t('inputRequired'), 'string') });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const day = Math.min(28, Math.max(1, Math.round(Number(inputs.day_of_month) || 1)));
    const body = { title: String(inputs.title).trim(), day_of_month: day, status: active ? 1 : 0 };
    const saved = await runSave(() => (data
      ? putApi(`/expense-recurring/${enc(data._uuid)}`, body)
      : postApi(`/expense-recurring/from-expense/${enc(expenseId!)}`, body)), setSaving);
    if (saved) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'recurEdit' : 'recurMake')} hint={t('recurFormHint')} icon="fa-repeat" saving={saving} onClose={onClose} onSubmit={submit} compact>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <InputField name="title" label={t('recurName')} icon={<i className="fa-solid fa-tag" />} />
        <InputField name="day_of_month" label={t('recurDay')} accepter={NumberInput} required={false}
          controls={false} prefix={t('recurDayPrefix')}
        />
        {data && <ToggleField label={t('status')} checked={active} onChange={setActive} onText={t('recurActive')} offText={t('recurPaused')} />}
      </Form>
    </SettingModal>
  );
};

/**
 * ລາຍຈ່າຍປະຈຳເດືອນ (ໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ) — ແມ່ແບບທີ່ສ້າງຈາກລາຍຈ່າຍ (ຄ່າເຊົ່າ, ຄ່າໄຟ, ອິນເຕີເນັດ…).
 * ແຕ່ລະແຖວບອກສະຖານະເດືອນນີ້ (ບັນທຶກແລ້ວ / ຄົບກຳນົດ / ອີກ N ມື້ / ຢຸດ) ແລະ ປຸ່ມ "ບັນທຶກເດືອນນີ້" ເປີດຟອມລາຍຈ່າຍທີ່ເຕີມໃຫ້ແລ້ວ.
 * ລະບົບບໍ່ບັນທຶກເງິນອອກເອງ — ຈຳນວນປ່ຽນໄດ້ທຸກເດືອນ (ຄ່າໄຟ)
 */
const RecurringExpensePage = () => {
  const t = useT();
  const [rows, setRows] = useState<RecurringExpense[] | null>(null);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [recording, setRecording] = useState<RecurringExpense | null>(null);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, acc] = await Promise.all([getApi('/expense-recurring'), postApi('/treasury-account/fetch', {})]);
      setRows(list.data?.data ?? []);
      setAccounts(acc.data?.data ?? []);
    } catch (error) {
      Notific.error(getErrorMessage(error));
      setRows([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = (row: RecurringExpense) => Notific.confirm(`${t('recurDeleteConfirm')} ${row.title}`, async () => {
    try {
      await deleteApi(`/expense-recurring/${enc(row._uuid)}`);
      Notific.success('acsDeleted');
      load();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  const today = moment().date();
  const list = rows ?? [];
  const due = list.filter((r) => r.due).length;
  const done = list.filter((r) => r.this_month).length;

  const statusOf = (row: RecurringExpense) => {
    if (row.this_month) {
      return <span className="recur-status is-done"><i className="fa-solid fa-circle-check" /> {t('recurDone')} · {row.this_month.number} · {formatNumber(row.this_month.total)}</span>;
    }
    if (Number(row.status) !== 1) return <span className="recur-status is-paused"><i className="fa-solid fa-pause" /> {t('recurPaused')}</span>;
    if (row.due) return <span className="recur-status is-due"><i className="fa-solid fa-bell" /> {t('recurDue')}</span>;
    return <span className="recur-status"><i className="fa-regular fa-clock" /> {t('expIn').replace('{n}', String(row.day_of_month - today))}</span>;
  };

  return (
    <div className="acc-rp recur-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="recur-counts">
            <span><b>{list.length}</b> {t('recurCount')}</span>
            <span className={due ? 'is-due' : ''}><b>{due}</b> {t('recurDue')}</span>
            <span className="is-done"><b>{done}</b> {t('recurDoneMonth')}</span>
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={load} aria-label={t('reload')}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
        <p className="recur-note"><i className="fa-solid fa-circle-info" /> {t('recurHowTo')}</p>
      </div>

      {rows && !list.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-repeat" /><p>{t('recurEmpty')}</p></div>
      ) : (
        <div className="acc-gl-group">
          <div className="acc-rp-scroll">
            <table className="acc-gl-table recur-table">
              <thead>
                <tr>
                  <th>{t('recurName')}</th>
                  <th>{t('recurAccount')}</th>
                  <th className="is-num">{t('recurLastAmount')}</th>
                  <th>{t('recurDay')}</th>
                  <th>{t('recurThisMonth')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row._uuid} className={row.due ? 'is-due' : Number(row.status) !== 1 ? 'is-reversed' : ''}>
                    <td>
                      <b>{row.title}</b>
                      <small className="acc-gl-ref d-block">{row.sub?.name ?? '—'}{row.payee_name ? ` · ${row.payee_name}` : ''}</small>
                    </td>
                    <td>{row.account?.acountName ?? '—'}{row.account?.acount_number ? <small className="acc-gl-ref d-block">{row.account.acount_number}</small> : null}</td>
                    <td className="is-num">{formatNumber(row.amount)}</td>
                    <td>{t('recurDayPrefix')} {row.day_of_month}</td>
                    <td>{statusOf(row)}</td>
                    <td className="acc-gl-tree-actions recur-actions">
                      <button type="button" className="acc-rp-btn is-primary" disabled={!canCreate || !!row.this_month || Number(row.status) !== 1}
                        onClick={() => setRecording(row)}
                      >
                        <i className="fa-solid fa-plus" /> {t('recurRecord')}
                      </button>
                      <button type="button" className="acc-gl-act" disabled={!canEdit} title={t('edit')} onClick={() => setEditing(row)}><i className="fa-solid fa-pen" /></button>
                      <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')} onClick={() => remove(row)}><i className="fa-solid fa-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recording && (
        <ExpenseForm data={null} template={recording} accounts={accounts} onClose={() => setRecording(null)} onSaved={load} />
      )}
      {editing && <RecurringForm data={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
};

export default RecurringExpensePage;
