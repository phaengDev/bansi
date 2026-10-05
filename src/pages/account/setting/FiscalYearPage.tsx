import { useRef, useState } from 'react';
import { DatePicker, Form, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { deleteApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { CardAction, FormSection, ListState, SettingCard, SettingModal, SettingToolbar, ToggleField } from './settingKit';
import { fromApiDate, runSave, saveSetting, toApiDate, useSettingList } from './settingApi';

type FiscalYear = {
  _uuid: number;
  fiscal_code: string;
  fiscal_name?: string;
  start_date: string;
  end_date: string;
  is_current: number;
  status: number; // 1 ເປີດ, 2 ປິດບັນຊີແລ້ວ
  closed_at?: string | null;
  description?: string;
};

const showDate = (value: string) => moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY');

/** ງວດບັນຊີ = ແຕ່ລະເດືອນໃນຊ່ວງປີ; ຄືນສະຖານະຂອງແຕ່ລະງວດທຽບກັບມື້ນີ້ */
const periodsOf = (row: FiscalYear) => {
  const start = moment(row.start_date, 'YYYY-MM-DD').startOf('month');
  const end = moment(row.end_date, 'YYYY-MM-DD').startOf('month');
  const now = moment().startOf('month');
  const list: { key: string; label: string; state: 'past' | 'now' | 'next' }[] = [];
  for (const m = start.clone(); m.isSameOrBefore(end) && list.length < 24; m.add(1, 'month')) {
    list.push({
      key: m.format('YYYY-MM'),
      label: m.format('MM'),
      state: m.isBefore(now) ? 'past' : m.isSame(now) ? 'now' : 'next',
    });
  }
  return list;
};

/** ເປີເຊັນຂອງປີທີ່ຜ່ານໄປແລ້ວ (0–100) */
const elapsedOf = (row: FiscalYear) => {
  const start = moment(row.start_date, 'YYYY-MM-DD');
  const end = moment(row.end_date, 'YYYY-MM-DD').endOf('day');
  const total = end.diff(start, 'days') + 1;
  const done = moment().diff(start, 'days') + 1;
  return Math.round((Math.min(Math.max(done, 0), total) / total) * 100);
};

const FiscalYearForm = ({ data, latest, onClose, onSaved }: {
  data: FiscalYear | null;
  latest?: FiscalYear;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [makeCurrent, setMakeCurrent] = useState(false);
  const closed = data?.status === 2;

  // ປີໃໝ່ເລີ່ມຕໍ່ຈາກປີຫຼ້າສຸດ, ບໍ່ມີກໍ່ເລີ່ມ 1 ມັງກອນ ປີນີ້
  const defaultStart = latest ? moment(latest.end_date, 'YYYY-MM-DD').add(1, 'day') : moment().startOf('year');
  const [inputs, setInputs] = useState<any>(() => data
    ? {
        fiscal_code: data.fiscal_code,
        fiscal_name: data.fiscal_name ?? '',
        start_date: fromApiDate(data.start_date),
        end_date: fromApiDate(data.end_date),
        description: data.description ?? '',
      }
    : {
        fiscal_code: defaultStart.format('YYYY'),
        fiscal_name: `${t('fyYearWord')} ${defaultStart.format('YYYY')}`,
        start_date: defaultStart.toDate(),
        end_date: defaultStart.clone().add(1, 'year').subtract(1, 'day').toDate(),
        description: '',
      });

  const model = createModel<any>({
    fiscal_code: requiredField(t('inputRequired'), 'string'),
    start_date: requiredField(t('selectRequired'), 'date'),
    end_date: requiredField(t('selectRequired'), 'date'),
  });

  /** ເລືອກວັນທີເລີ່ມຂອງປີໃໝ່ → ຕັ້ງວັນທີສິ້ນສຸດ (1 ປີ) ແລະ ລະຫັດປີໃຫ້ອັດຕະໂນມັດ */
  const handleChange = (next: any) => {
    const startChanged = next.start_date && String(next.start_date) !== String(inputs.start_date);
    if (!data && startChanged) {
      const start = moment(next.start_date);
      setInputs({
        ...next,
        end_date: start.clone().add(1, 'year').subtract(1, 'day').toDate(),
        fiscal_code: start.format('YYYY'),
      });
      return;
    }
    setInputs(next);
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      start_date: toApiDate(inputs.start_date),
      end_date: toApiDate(inputs.end_date),
      ...(data ? {} : { is_current: makeCurrent ? 1 : 0 }),
    };
    if (await runSave(() => saveSetting('/fiscal-year', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'fyEdit' : 'fyAdd')} hint={t('fyHint')} icon="fa-calendar-check" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange}>
        <FormSection title={t('acsInfo')} note={closed && <><i className="fa-solid fa-lock" /> {t('fyClosed')}</>}>
          <div className="is-wide acs-code-name">
            <InputField name="fiscal_code" label={t('fyCode')} disabled={closed} />
            <InputField name="fiscal_name" label={t('fyName')} required={false} />
          </div>
          <InputField name="start_date" label={t('fyStart')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} disabled={closed} />
          <InputField name="end_date" label={t('fyEnd')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} disabled={closed} />
          {!data && (
            <div className="is-wide">
              <ToggleField label={t('fyCurrent')} checked={makeCurrent} onChange={setMakeCurrent} onText={t('fyMakeCurrent')} offText={t('fyNotCurrent')} />
            </div>
          )}
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ປີການເງິນ ແລະ ງວດບັນຊີ — ກຳນົດຊ່ວງວັນທີຂອງແຕ່ລະປີບັນຊີ, ປີປັດຈຸບັນ (ມີປີດຽວ) ແລະ ການປິດບັນຊີ.
 * ງວດບັນຊີແມ່ນແຕ່ລະເດືອນໃນຊ່ວງປີ (ສະແດງເປັນແຖບໃນບັດ). ປີທີ່ປິດແລ້ວລັອກຍອດຍົກມາ
 */
const FiscalYearPage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<FiscalYear>('/fiscal-year/fetch');
  const [editing, setEditing] = useState<FiscalYear | null | undefined>(undefined);
  const current = rows.find((r) => Number(r.is_current) === 1);

  /** ເອີ້ນ API ຂອງປຸ່ມໃນບັດ ຫຼັງຢືນຢັນ */
  const act = (message: string, request: () => Promise<unknown>) =>
    Notific.confirm(message, async () => {
      try {
        await request();
        Notific.success('saveSuccessDone');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const idOf = (r: FiscalYear) => btoa(String(r._uuid));

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetFiscalYear'), value: rows.length },
          { label: t('fyCurrent'), value: current?.fiscal_code ?? '—', tone: 'green' },
          { label: t('fyClosed'), value: rows.filter((r) => Number(r.status) === 2).length, tone: 'violet' },
        ]}
        addLabel={t('fyAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!rows.length} icon="fa-calendar-check">
        <div className="acs-grid is-wide">
          {rows.map((r) => {
            const isCurrent = Number(r.is_current) === 1;
            const isClosed = Number(r.status) === 2;
            const days = moment(r.end_date).diff(moment(r.start_date), 'days') + 1;
            return (
              <SettingCard
                key={r._uuid}
                tone={isCurrent ? 'is-emerald' : isClosed ? 'is-violet' : 'is-blue'}
                badge={r.fiscal_code}
                title={r.fiscal_name || r.fiscal_code}
                subtitle={`${showDate(r.start_date)} → ${showDate(r.end_date)} · ${days} ${t('fyDays')}`}
                pill={
                  <span className={`acs-pill ${isCurrent ? 'is-green' : isClosed ? 'is-muted' : 'is-blue'}`}>
                    <i className={`fa-solid ${isCurrent ? 'fa-star' : isClosed ? 'fa-lock' : 'fa-lock-open'}`} />
                    {t(isCurrent ? 'fyCurrent' : isClosed ? 'fyClosed' : 'fyOpen')}
                  </span>
                }
                meta={
                  <div className="acs-periods" aria-label={t('fyPeriods')}>
                    {periodsOf(r).map((p) => (
                      <span key={p.key} className={`is-${p.state}`} title={p.key}>{p.label}</span>
                    ))}
                  </div>
                }
                aside={
                  <div className="acs-aside-figure">
                    <small>{t('fyElapsed')}</small>
                    <b>{elapsedOf(r)}%</b>
                  </div>
                }
                active={!isClosed}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
                actions={
                  <>
                    {!isCurrent && !isClosed && (
                      <CardAction text icon="fa-star" label={t('fyMakeCurrent')} tone="accent" disabled={!canEdit}
                        onClick={() => act('fyCurrentConfirm', () => putApi(`/fiscal-year/current/${idOf(r)}`))}
                      />
                    )}
                    {!isCurrent && !isClosed && (
                      <CardAction text icon="fa-lock" label={t('fyClose')} disabled={!canEdit}
                        onClick={() => act('fyCloseConfirm', () => putApi(`/fiscal-year/close/${idOf(r)}`))}
                      />
                    )}
                    {isClosed && (
                      <CardAction text icon="fa-lock-open" label={t('fyReopen')} disabled={!canEdit}
                        onClick={() => act('fyReopenConfirm', () => putApi(`/fiscal-year/reopen/${idOf(r)}`))}
                      />
                    )}
                    {!isCurrent && !isClosed && (
                      <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete}
                        onClick={() => act('fyDeleteConfirm', () => deleteApi(`/fiscal-year/${idOf(r)}`))}
                      />
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && (
        <FiscalYearForm data={editing} latest={rows[0]} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default FiscalYearPage;
