import { useRef, useState, type KeyboardEvent } from 'react';
import { Form, Input, NumberInput, Textarea, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { deleteApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import {
  CardAction, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar,
} from '../account/setting/settingKit';
import { nextCode, runSave, saveSetting, useStatusToggle } from '../account/setting/settingApi';
import { useHrList, type Department } from './hrApi';

/** ແຖວຕຳແໜ່ງໃນຟອມ — key ໃຊ້ພາຍໃນຟອມ, _uuid = ຕຳແໜ່ງທີ່ບັນທຶກແລ້ວ */
type PositionLine = { key: number; _uuid?: number; position_name: string; status: number; employees: number };

let lineSeq = 0;
const newLine = (): PositionLine => ({ key: ++lineSeq, position_name: '', status: 1, employees: 0 });

const DepartmentForm = ({ data, codes, onClose, onSaved }: {
  data: Department | null;
  codes: string[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    depart_code: data?.depart_code ?? nextCode('DP-', codes, 2),
    depart_name: data?.depart_name ?? '',
    sort: data?.sort ?? codes.length + 1,
    description: data?.description ?? '',
  });
  const [lines, setLines] = useState<PositionLine[]>(() => {
    const saved = (data?.positions ?? []).map((p) => ({
      key: ++lineSeq, _uuid: p._uuid, position_name: p.position_name, status: Number(p.status), employees: p.employees ?? 0,
    }));
    return saved.length ? saved : [newLine()];
  });
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const model = createModel<any>({
    depart_code: requiredField(t('inputRequired'), 'string'),
    depart_name: requiredField(t('inputRequired'), 'string'),
  });

  const update = (key: number, patch: Partial<PositionLine>) =>
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => {
    const line = newLine();
    setLines((list) => [...list, line]);
    setFocusKey(line.key);
  };
  /** Enter ໃນແຖວສຸດທ້າຍ = ເພີ່ມແຖວໃໝ່ */
  const onLineKey = (e: KeyboardEvent, index: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (index === lines.length - 1) addLine();
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const named = lines.filter((l) => l.position_name.trim());
    const names = named.map((l) => l.position_name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return Notific.warning('hrPositionDuplicate');
    const payload = {
      ...inputs,
      depart_code: String(inputs.depart_code).trim().toUpperCase(),
      sort: Number(inputs.sort) || 0,
      positions: named.map((l) => ({ ...(l._uuid ? { _uuid: l._uuid } : {}), position_name: l.position_name.trim(), status: l.status })),
      ...(data ? {} : { status: 1 }),
    };
    if (await runSave(() => saveSetting('/department', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'hrDepartmentEdit' : 'hrDepartmentAdd')} hint={t('hrDepartmentHint')} icon="fa-sitemap" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name has-sort">
            <InputField name="depart_code" label={t('code')} className="acc-book-upper" />
            <InputField name="depart_name" label={t('hrDepartmentName')} />
            <InputField name="sort" label={t('pmSort')} accepter={NumberInput} required={false} />
          </div>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
        <FormSection title={t('hrPositions')} note={<><i className="fa-solid fa-circle-info" /> {t('hrPositionNote')}</>}>
          <div className="is-wide hr-positions">
            {lines.map((line, index) => (
              <div key={line.key} className={`hr-position-row${line.status ? '' : ' is-off'}`}>
                <span className="hr-position-no">{index + 1}</span>
                <Input value={line.position_name} placeholder={t('hrPositionPlaceholder')} autoFocus={focusKey === line.key}
                  aria-label={`${t('hrPosition')} ${index + 1}`}
                  onChange={(value) => update(line.key, { position_name: value })}
                  onKeyDown={(e) => onLineKey(e, index)}
                />
                {line.employees > 0 && <span className="acs-chip" title={t('hrHeadcount')}><i className="fa-solid fa-users" /> {line.employees}</span>}
                <Toggle size="sm" checked={line.status === 1} onChange={(on) => update(line.key, { status: on ? 1 : 0 })}
                  title={t(line.status ? 'statusTurnOff' : 'statusTurnOn')}
                />
                <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')}
                  onClick={() => setLines((list) => (list.length > 1 ? list.filter((l) => l.key !== line.key) : [newLine()]))}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
            <button type="button" className="acc-rp-btn hr-position-add" onClick={addLine}>
              <i className="fa-solid fa-plus" /> {t('hrPositionAdd')}
            </button>
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ພະແນກ ແລະ ຕຳແໜ່ງ — ແຕ່ລະພະແນກມີລາຍການຕຳແໜ່ງຂອງຕົນ (ຟອມພະນັກງານເລືອກ ພະແນກ → ຕຳແໜ່ງ).
 * ເປີດ/ປິດໃຊ້ງານຈາກບັດ; ລຶບໄດ້ສະເພາະພະແນກທີ່ບໍ່ເຄີຍມີພະນັກງານ
 */
const DepartmentPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<Department>('/department/fetch');
  const statusToggle = useStatusToggle('/department', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    !q || `${r.depart_code} ${r.depart_name} ${r.positions.map((p) => p.position_name).join(' ')}`.toLowerCase().includes(q));

  const remove = (row: Department) =>
    Notific.confirm(`${t('hrDepartmentDeleteConfirm')} ${row.depart_name}`, async () => {
      try {
        await deleteApi(`/department/${btoa(String(row._uuid))}`);
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
          { label: t('hrDepartments'), value: rows.length },
          { label: t('hrPositions'), value: rows.reduce((n, r) => n + r.positions.filter((p) => Number(p.status) === 1).length, 0), tone: 'violet' },
          { label: t('hrEmployees'), value: rows.reduce((n, r) => n + (r.employees ?? 0), 0), tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('hrDepartmentAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-sitemap">
        <div className="acs-grid">
          {shown.map((r) => {
            const active = r.positions.filter((p) => Number(p.status) === 1);
            return (
              <SettingCard
                key={r._uuid}
                tone="is-violet"
                badge={r.depart_code}
                title={r.depart_name}
                subtitle={r.description || undefined}
                meta={
                  <>
                    <MetaChip icon="fa-users" tone="green">{r.employees ?? 0} {t('hrPeople')}</MetaChip>
                    {active.map((p) => (
                      <MetaChip key={p._uuid} icon="fa-id-badge">{p.position_name}{p.employees ? ` · ${p.employees}` : ''}</MetaChip>
                    ))}
                    {!active.length && <MetaChip icon="fa-circle-info">{t('hrNoPositions')}</MetaChip>}
                  </>
                }
                active={Number(r.status) === 1}
                onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                toggling={statusToggle.busyId === r._uuid}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
                actions={!r.employees && (
                  <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => remove(r)} />
                )}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && (
        <DepartmentForm data={editing} codes={rows.map((r) => r.depart_code)} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default DepartmentPage;
