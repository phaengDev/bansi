import { useRef, useState } from 'react';
import { Form, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar } from './settingKit';
import { runSave, saveSetting, useSettingList, useStatusToggle } from './settingApi';

type JournalType = {
  _uuid: number;
  journal_code: string;
  name: string;
  journal_kind: number;
  description?: string;
  status: number;
};

type DocRef = { _uuid: number; doc_code: string; prefix: string; journal_id: number | null; status: number };

/** ລັກສະນະປຶ້ມ (journal_kind) — ສີ/ໄອຄອນໃຊ້ທັງບັດ ແລະ ຕົວເລືອກໃນຟອມ */
const KINDS = [
  { value: 1, label: 'jtKindGeneral', icon: 'fa-book', tone: 'is-blue' },
  { value: 2, label: 'jtKindReceipt', icon: 'fa-arrow-down', tone: 'is-emerald' },
  { value: 3, label: 'jtKindPayment', icon: 'fa-arrow-up', tone: 'is-coral' },
  { value: 4, label: 'jtKindCash', icon: 'fa-money-bill-wave', tone: 'is-gold' },
  { value: 5, label: 'jtKindBank', icon: 'fa-building-columns', tone: 'is-sky' },
  { value: 6, label: 'jtKindAdjust', icon: 'fa-scale-balanced', tone: 'is-violet' },
];
const kindOf = (value: number) => KINDS.find((k) => k.value === Number(value)) ?? KINDS[0];

const JournalTypeForm = ({ data, onClose, onSaved }: { data: JournalType | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<number>(data?.journal_kind ?? 1);
  const [inputs, setInputs] = useState<any>({
    journal_code: data?.journal_code ?? '',
    name: data?.name ?? '',
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    journal_code: requiredField(t('inputRequired'), 'string'),
    name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = { ...inputs, journal_code: String(inputs.journal_code).trim().toUpperCase(), journal_kind: kind, ...(data ? {} : { status: 1 }) };
    if (await runSave(() => saveSetting('/journal-type', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'jtEdit' : 'jtAdd')} hint={t('jtHint')} icon="fa-book-open" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="journal_code" label={t('code')} placeholder="GJ, RV, PV…" className="acc-book-upper" />
            <InputField name="name" label={t('name')} />
          </div>
          <ChoiceTiles
            className="is-wide"
            label={t('jtKind')}
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k.value, label: t(k.label), icon: k.icon }))}
          />
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ປະເພດປຶ້ມບັນຊີ (journal) — ປຶ້ມລາຍວັນທົ່ວໄປ, ລາຍຮັບ, ລາຍຈ່າຍ, ເງິນສົດ, ທະນາຄານ …
 * ເອກະສານແຕ່ລະໃບຖືກບັນທຶກລົງປຶ້ມໜຶ່ງ; ບັດສະແດງວ່າເອກະສານ (ເລກທີ) ໃດໃຊ້ປຶ້ມນີ້
 */
const JournalTypePage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<JournalType>('/journal-type/fetch');
  const statusToggle = useStatusToggle('/journal-type', reload);
  const { rows: docs } = useSettingList<DocRef>('/doc-numbering/fetch');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<JournalType | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.journal_code} ${r.name}`.toLowerCase().includes(q));

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetJournalType'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('jtAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-book-open">
        <div className="acs-grid">
          {shown.map((r) => {
            const kind = kindOf(r.journal_kind);
            const linked = docs.filter((d) => d.journal_id === r._uuid);
            return (
              <SettingCard
                key={r._uuid}
                tone={kind.tone}
                badge={r.journal_code}
                title={r.name}
                subtitle={r.description}
                meta={
                  <>
                    <MetaChip icon={kind.icon}>{t(kind.label)}</MetaChip>
                    {linked.map((d) => (
                      <MetaChip key={d._uuid} icon="fa-hashtag" tone="mono">{d.prefix || d.doc_code}</MetaChip>
                    ))}
                  </>
                }
                active={Number(r.status) === 1}
                onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                toggling={statusToggle.busyId === r._uuid}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && <JournalTypeForm data={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
};

export default JournalTypePage;
