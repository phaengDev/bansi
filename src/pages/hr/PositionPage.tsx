import { useRef, useState } from 'react';
import { Form, NumberInput } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { deleteApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { CardAction, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar } from '../account/setting/settingKit';
import { runSave, saveSetting, useStatusToggle } from '../account/setting/settingApi';
import { useHrList, type Position } from './hrApi';
import { LevelTag } from './org/OrgBits';

/**
 * ຟອມຕຳແໜ່ງ — ຊື່ (ບໍ່ຊ້ຳ) + Level (1 = ສູງສຸດ, ຕົວເລກໃດກໍ່ໄດ້ — ອົງກອນມີຂັ້ນບໍ່ເທົ່າກັນ) + ລຳດັບ
 */
const PositionForm = ({ data, levels, onClose, onSaved }: {
  data: Position | null;
  /** Level ທີ່ມີຢູ່ແລ້ວ — ປຸ່ມເລືອກໄວ */
  levels: number[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    position_name: data?.position_name ?? '',
    level: data?.level ?? null,
    sort: data?.sort ?? 0,
  });
  const model = createModel<any>({ position_name: requiredField(t('inputRequired'), 'string') });
  const quick = [...new Set([...levels, (Math.max(0, ...levels) || 0) + 1])].sort((a, b) => a - b);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const level = Number(inputs.level);
    const payload = {
      position_name: String(inputs.position_name).trim(),
      level: Number.isInteger(level) && level >= 1 ? level : null,
      sort: Number(inputs.sort) || 0,
      ...(data ? {} : { status: 1 }),
    };
    if (await runSave(() => saveSetting('/position', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'hrPositionEdit' : 'hrPositionAdd')} hint={t('hrPositionHint')} icon="fa-id-badge" saving={saving}
      onClose={onClose} onSubmit={submit}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide">
            <InputField name="position_name" label={t('hrPositionName')} placeholder={t('hrPositionPlaceholder')} />
          </div>
          <InputField name="level" label="Level" accepter={NumberInput} required={false} placeholder={t('hrLevelUnset')} />
          <InputField name="sort" label={t('pmSort')} accepter={NumberInput} required={false} />
          <div className="is-wide hr-level-quick">
            {quick.map((n) => (
              <button key={n} type="button" className={Number(inputs.level) === n ? 'is-active' : ''} onClick={() => setInputs({ ...inputs, level: n })}>
                Level {n}
              </button>
            ))}
            <small>{t('hrLevelNote')}</small>
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ຕຳແໜ່ງ — ລາຍຊື່ກາງຂອງບໍລິສັດ (ພິມເທື່ອດຽວ ໃຊ້ໄດ້ທຸກພະແນກ) ຈັດກຸ່ມຕາມ Level.
 * Level ໃຊ້ແນະນຳ "ຫົວໜ້າສາຍງານ" ໃນຟອມພະນັກງານ ແລະ ລຽງໂຄງຮ່າງ. ລຶບໄດ້ສະເພາະຕຳແໜ່ງທີ່ບໍ່ເຄີຍມີຄົນ
 */
const PositionPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<Position>('/position/fetch');
  const statusToggle = useStatusToggle('/position', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Position | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || r.position_name.toLowerCase().includes(q));
  const levels = [...new Set(rows.map((r) => r.level).filter((l): l is number => !!l))].sort((a, b) => a - b);
  const groups = [...levels.map((l) => ({ level: l as number | null, items: shown.filter((r) => r.level === l) })), { level: null, items: shown.filter((r) => !r.level) }]
    .filter((g) => g.items.length);

  const remove = (row: Position) =>
    Notific.confirm(`${t('hrPositionDeleteConfirm')} ${row.position_name}`, async () => {
      try {
        await deleteApi(`/position/${btoa(String(row._uuid))}`);
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
          { label: t('hrPositions'), value: rows.length },
          { label: 'Level', value: levels.length, tone: 'violet' },
          { label: t('hrEmployees'), value: rows.reduce((n, r) => n + (r.employees ?? 0), 0), tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('hrPositionAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-id-badge">
        {groups.map((g) => (
          <section key={g.level ?? 'none'} className="hr-level-group">
            <header><LevelTag level={g.level} /> <em>{g.items.length}</em>{!g.level && <small>{t('hrLevelUnsetHint')}</small>}</header>
            <div className="acs-grid">
              {g.items.map((r) => (
                <SettingCard
                  key={r._uuid}
                  tone="is-violet"
                  badge={r.level ?? '—'}
                  title={r.position_name}
                  meta={<MetaChip icon="fa-users" tone="green">{r.employees ?? 0} {t('hrPeople')}</MetaChip>}
                  active={Number(r.status) === 1}
                  onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                  toggling={statusToggle.busyId === r._uuid}
                  canEdit={canEdit}
                  onEdit={() => setEditing(r)}
                  actions={!r.employees && (
                    <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => remove(r)} />
                  )}
                />
              ))}
            </div>
          </section>
        ))}
      </ListState>

      {editing !== undefined && <PositionForm data={editing} levels={levels} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
};

export default PositionPage;
