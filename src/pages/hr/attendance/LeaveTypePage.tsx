import { useRef, useState } from 'react';
import { Form, NumberInput, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import {
  CardAction, ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar,
} from '../../account/setting/settingKit';
import { postfixProp, runSave, saveSetting, useSettingList, useStatusToggle } from '../../account/setting/settingApi';
import { leaveTone, type LeaveType } from './attendanceApi';

/** ລາໄດ້ສູງສຸດທີ່ຕັ້ງໄດ້ (ມື້) — ກົງກັບ leaveTypeController ຂອງ api-bansi */
const MAX_LIMIT = 366;

/**
 * ແບບຕົວຢ່າງໃນຟອມເພີ່ມ — ກົດແລ້ວເຕີມໃຫ້ (ແກ້ຕໍ່ໄດ້). ອີງກົດໝາຍແຮງງານລາວ: ພັກປະຈຳປີ 15 ມື້ເຮັດວຽກ,
 * ລາປ່ວຍມີໃບແພດ ໄດ້ເງິນເດືອນບໍ່ເກີນ 30 ມື້ຕໍ່ປີ
 */
const PRESETS = [
  { name: 'ລາພັກປະຈຳປີ', paid: 1, max_per_year: 15, max_per_request: 5, description: '' },
  { name: 'ລາປ່ວຍ', paid: 1, max_per_year: 30, max_per_request: null, description: 'ລາເກີນ 1 ມື້ ຕ້ອງມີໃບຢັ້ງຢືນແພດ' },
  { name: 'ລາກິດສ່ວນຕົວ', paid: 0, max_per_year: null, max_per_request: null, description: 'ຫັກເງິນເດືອນຕາມມື້ທີ່ລາ' },
];

type Inputs = { name: string; max_per_year: number | string | null; max_per_request: number | string | null; description: string };

/** NumberInput ຫວ່າງ / 0 = ບໍ່ຈຳກັດ (null) */
const limitValue = (value: unknown) => (value === null || value === undefined || value === '' || Number(value) === 0 ? null : Number(value));

const LeaveTypeForm = ({ data, existing, onClose, onSaved }: {
  data: LeaveType | null;
  existing: LeaveType[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState(data ? Number(data.paid) : 1);
  const [inputs, setInputs] = useState<Inputs>({
    name: data?.name ?? '',
    max_per_year: data?.max_per_year ?? null,
    max_per_request: data?.max_per_request ?? null,
    description: data?.description ?? '',
  });

  const taken = new Set(existing.map((r) => r.name.trim()));
  const presets = data ? [] : PRESETS.filter((p) => !taken.has(p.name));
  const perYear = limitValue(inputs.max_per_year);
  const perRequest = limitValue(inputs.max_per_request);
  const limitBad = (n: number | null) => n !== null && (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT);

  const model = createModel<any>({
    name: requiredField(t('inputRequired'), 'string'),
  });

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setPaid(preset.paid);
    setInputs((prev) => ({ ...prev, ...preset }));
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (limitBad(perYear) || limitBad(perRequest)) return Notific.warning('lvTypeLimitRange');
    if (perYear !== null && perRequest !== null && perRequest > perYear) return Notific.warning('lvTypeLimitOrder');
    const payload = {
      name: inputs.name.trim(),
      paid,
      max_per_year: perYear,
      max_per_request: perRequest,
      description: inputs.description.trim(),
    };
    if (await runSave(() => saveSetting('/leave-type', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'lvTypeEdit' : 'lvTypeAdd')} hint={t('lvTypeHint')} icon="fa-plane-departure" saving={saving} onClose={onClose} onSubmit={submit} wide>
      {presets.length > 0 && (
        <div className="lv-presets">
          <span><i className="fa-solid fa-wand-magic-sparkles" /> {t('lvTypePresets')}</span>
          {presets.map((p) => (
            <button key={p.name} type="button" onClick={() => applyPreset(p)}>
              <b>{p.name}</b>
              <small>{p.max_per_year ? `${p.max_per_year} ${t('lvTypePerYearShort')}` : t('lvTypeUnlimited')}{p.max_per_request ? ` · ${t('lvTypePerRequestShort')} ${p.max_per_request}` : ''}</small>
            </button>
          ))}
        </div>
      )}
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(v) => setInputs(v as Inputs)}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide">
            <InputField name="name" label={t('lvTypeName')} placeholder={t('lvTypeNamePlaceholder')} />
          </div>
          <ChoiceTiles
            className="is-wide"
            label={t('lvTypePay')}
            value={paid}
            onChange={setPaid}
            options={[1, 0].map((value) => {
              const meta = leaveTone(value);
              return { value, label: t(meta.label), icon: meta.icon, hint: t(meta.hint) };
            })}
          />
        </FormSection>
        <FormSection title={t('lvTypeLimits')} note={t('lvTypeLimitsNote')}>
          <InputField name="max_per_year" label={t('lvTypePerYear')} accepter={NumberInput} required={false}
            placeholder={t('lvTypeUnlimited')} {...postfixProp(t('leaveDayUnit'))}
          />
          <InputField name="max_per_request" label={t('lvTypePerRequest')} accepter={NumberInput} required={false}
            placeholder={t('lvTypeUnlimited')} {...postfixProp(t('leaveDayUnit'))}
          />
          <p className="is-wide lv-limit-summary">
            <i className="fa-solid fa-circle-info" />{' '}
            {perYear || perRequest
              ? [
                perYear && `${t('lvTypeSummaryYear')} ${perYear} ${t('leaveDayUnit')}`,
                perRequest && `${t('lvTypeSummaryRequest')} ${perRequest} ${t('leaveDayUnit')}`,
              ].filter(Boolean).join(' · ')
              : t('lvTypeSummaryNone')}
          </p>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} placeholder={t('lvTypeDescPlaceholder')} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ປະເພດການລາພັກ — HR ກຳນົດ (ເຊັ່ນ ລາພັກປະຈຳປີ ບໍ່ເກີນ 15 ມື້ຕໍ່ປີ ແລະ ຄັ້ງລະບໍ່ເກີນ 5 ມື້); ພະນັກງານເລືອກໃນ app ຕອນຂໍລາ.
 * ນັບເປັນມື້ເຮັດວຽກ (ບໍ່ລວມວັນພັກ). ປະເພດທີ່ມີຄຳຂໍແລ້ວລຶບບໍ່ໄດ້ — ປິດໃຊ້ງານແທນ
 */
const LeaveTypePage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<LeaveType>('/leave-type/fetch');
  const statusToggle = useStatusToggle('/leave-type', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<LeaveType | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q));

  const remove = (row: LeaveType) =>
    Notific.confirm(`${t('lvTypeDeleteConfirm')} ${row.name}`, async () => {
      try {
        await deleteApi(`/leave-type/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('lvTypes'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('lvTypeAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('lvTypeNote')}</p>

      <ListState loading={loading} empty={!shown.length} icon="fa-plane-departure">
        <div className="acs-grid">
          {shown.map((r) => {
            const meta = leaveTone(r.paid);
            const used = r.request_count ?? 0;
            return (
              <SettingCard
                key={r._uuid}
                tone={meta.card}
                badge={<i className={`fa-solid ${meta.icon}`} />}
                title={r.name}
                subtitle={r.description || t(meta.hint)}
                meta={
                  <>
                    <MetaChip icon="fa-sack-dollar" tone={Number(r.paid) === 1 ? undefined : 'gold'}>{t(meta.label)}</MetaChip>
                    <MetaChip icon="fa-calendar-days">
                      {r.max_per_year ? `${t('lvTypeSummaryYear')} ${r.max_per_year} ${t('leaveDayUnit')}` : t('lvTypeUnlimitedYear')}
                    </MetaChip>
                    {r.max_per_request && (
                      <MetaChip icon="fa-calendar-check">{`${t('lvTypeSummaryRequest')} ${r.max_per_request} ${t('leaveDayUnit')}`}</MetaChip>
                    )}
                    {used > 0 && <MetaChip icon="fa-file-lines">{used} {t('lvTypeRequests')}</MetaChip>}
                  </>
                }
                active={Number(r.status) === 1}
                onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                toggling={statusToggle.busyId === r._uuid}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
                actions={used === 0 && (
                  <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => remove(r)} />
                )}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && (
        <LeaveTypeForm data={editing} existing={rows.filter((r) => r._uuid !== editing?._uuid)} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default LeaveTypePage;
