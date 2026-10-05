import { useRef, useState } from 'react';
import { Form, NumberInput, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar, ToggleField } from './settingKit';
import { runSave, saveSetting, useSettingList, useStatusToggle } from './settingApi';
import { toneOf } from './accountTone';

type NumberFormat = {
  prefix: string;
  sep: string;
  year_format: number;
  with_month: number;
  digits: number;
};

type DocNumbering = NumberFormat & {
  _uuid: number;
  doc_code: string;
  name: string;
  journal_id: number | null;
  reset_period: number;
  next_number: number;
  period_key: string | null;
  description?: string;
  status: number;
  journal?: { _uuid: number; journal_code: string; name: string } | null;
};

type JournalOption = { _uuid: number; journal_code: string; name: string };

const RESETS = [
  { value: 0, label: 'dnResetNever', icon: 'fa-infinity' },
  { value: 1, label: 'dnResetYearly', icon: 'fa-calendar' },
  { value: 2, label: 'dnResetMonthly', icon: 'fa-calendar-days' },
];

/** ງວດຂອງເລກລຳດັບ — ຕ້ອງກົງກັບ periodKeyOf ໃນ docNumberingController (backend) */
const periodKey = (reset: number, date = moment()) =>
  reset === 2 ? date.format('YYYY-MM') : reset === 1 ? date.format('YYYY') : 'ALL';

/** ເລກລຳດັບທີ່ໃບຕໍ່ໄປຈະໄດ້ — ຂ້າມງວດແລ້ວເລີ່ມ 1 ໃໝ່ (period_key ວ່າງ = ໃຊ້ next_number ຕາມທີ່ຕັ້ງ) */
const nextSequence = (r: DocNumbering) =>
  !r.period_key || r.period_key === periodKey(Number(r.reset_period)) ? Number(r.next_number) || 1 : 1;

/** ສ່ວນຂອງເລກທີ [ຄຳນຳໜ້າ, ວັນທີ, ເລກລຳດັບ] — ສູດດຽວກັບ formatDocNumber ຂອງ backend */
const numberParts = (f: NumberFormat, seq: number, date = moment()) => {
  const year = Number(f.year_format) === 2 ? date.format('YY') : Number(f.year_format) === 4 ? date.format('YYYY') : '';
  const datePart = year ? `${year}${Number(f.with_month) === 1 ? date.format('MM') : ''}` : '';
  return { prefix: f.prefix ?? '', date: datePart, seq: String(seq).padStart(Number(f.digits) || 1, '0') };
};

const formatNumberText = (f: NumberFormat, seq: number) => {
  const p = numberParts(f, seq);
  return [p.prefix, p.date, p.seq].filter(Boolean).join(f.sep ?? '');
};

/** ເລກທີຕົວຢ່າງ ແຍກສີແຕ່ລະສ່ວນ ໃຫ້ເຫັນວ່າສ່ວນໃດມາຈາກການຕັ້ງຄ່າໃດ */
const NumberPreview = ({ format, seq }: { format: NumberFormat; seq: number }) => {
  const p = numberParts(format, seq);
  const parts = [
    p.prefix && <span key="p" className="is-prefix">{p.prefix}</span>,
    p.date && <span key="d" className="is-date">{p.date}</span>,
    <span key="s" className="is-seq">{p.seq}</span>,
  ].filter(Boolean);
  return (
    <code className="acs-docno">
      {parts.map((part, i) => (
        <span key={i}>{i > 0 && format.sep && <em>{format.sep}</em>}{part}</span>
      ))}
    </code>
  );
};

const DocNumberingForm = ({ data, journals, onClose, onSaved }: {
  data: DocNumbering | null;
  journals: JournalOption[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [withMonth, setWithMonth] = useState(data ? Number(data.with_month) === 1 : false);
  const [sep, setSep] = useState<string>(data?.sep ?? '-');
  const [yearFormat, setYearFormat] = useState<number>(data?.year_format ?? 4);
  const [reset, setReset] = useState<number>(data?.reset_period ?? 1);
  const [inputs, setInputs] = useState<any>({
    doc_code: data?.doc_code ?? '',
    journal_id: data?.journal_id ?? null,
    name: data?.name ?? '',
    prefix: data?.prefix ?? '',
    digits: data?.digits ?? 5,
    next_number: data ? nextSequence(data) : 1,
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    doc_code: requiredField(t('inputRequired'), 'string'),
    name: requiredField(t('inputRequired'), 'string'),
  });

  const format: NumberFormat = {
    prefix: String(inputs.prefix ?? '').trim().toUpperCase(),
    sep,
    year_format: yearFormat,
    with_month: withMonth ? 1 : 0,
    digits: Math.min(10, Math.max(1, Number(inputs.digits) || 1)),
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      ...format,
      doc_code: String(inputs.doc_code).trim().toUpperCase(),
      journal_id: inputs.journal_id || null,
      reset_period: reset,
      next_number: Math.max(1, Number(inputs.next_number) || 1),
      ...(data ? {} : { status: 1 }),
    };
    if (await runSave(() => saveSetting('/doc-numbering', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'dnEdit' : 'dnAdd')} hint={t('dnHint')} icon="fa-hashtag" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <div className="acs-docno-hero">
        <small>{t('dnPreview')}</small>
        <NumberPreview format={format} seq={Math.max(1, Number(inputs.next_number) || 1)} />
      </div>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="doc_code" label={t('dnDocCode')} placeholder="RECEIPT" className="acc-book-upper" />
            <InputField name="name" label={t('name')} />
          </div>
          <div className="is-wide">
            <InputField name="journal_id" label={t('dnJournal')} accepter={SelectPicker} block required={false}
              placeholder={t('select')}
              data={journals.map((j) => ({ label: `${j.journal_code} · ${j.name}`, value: j._uuid }))}
            />
          </div>
        </FormSection>

        <FormSection title={t('dnFormat')}>
          <InputField name="prefix" label={t('dnPrefix')} placeholder="RV" className="acc-book-upper" required={false} />
          <ChoiceTiles
            label={t('dnSep')}
            value={sep}
            onChange={setSep}
            options={[
              { value: '-', label: '-' },
              { value: '/', label: '/' },
              { value: '.', label: '.' },
              { value: '', label: t('dnNone') },
            ]}
          />
          <ChoiceTiles
            label={t('dnYear')}
            value={yearFormat}
            onChange={setYearFormat}
            options={[
              { value: 0, label: t('dnNone') },
              { value: 2, label: moment().format('YY') },
              { value: 4, label: moment().format('YYYY') },
            ]}
          />
          <ToggleField label={t('dnMonth')} checked={withMonth} onChange={setWithMonth} onText={t('dnWithMonth')} offText={t('dnNoMonth')} />
          <InputField name="digits" label={t('dnDigits')} accepter={NumberInput} required={false} />
          <InputField name="next_number" label={t('dnNext')} accepter={NumberInput} required={false} />
          <ChoiceTiles
            className="is-wide"
            label={t('dnReset')}
            value={reset}
            onChange={setReset}
            options={RESETS.map((r) => ({ value: r.value, label: t(r.label), icon: r.icon }))}
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
 * ເລກທີເອກະສານ — ຮູບແບບເລກທີຂອງແຕ່ລະເອກະສານ (ໃບຮັບເງິນ, ໃບຈ່າຍເງິນ …) ແລະ ເລກທີໃບຕໍ່ໄປ.
 * ໂມດູນອື່ນຂໍເລກທີຜ່ານ POST /doc-numbering/next/:doc_code ເຊິ່ງເລື່ອນເລກໃຫ້ເອງ
 */
const DocNumberingPage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<DocNumbering>('/doc-numbering/fetch');
  const statusToggle = useStatusToggle('/doc-numbering', reload);
  const { rows: journals } = useSettingList<JournalOption>('/journal-type/option');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<DocNumbering | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.doc_code} ${r.prefix} ${r.name}`.toLowerCase().includes(q));

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetDocNumbering'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('dnAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-hashtag">
        <div className="acs-grid is-wide">
          {shown.map((r) => {
            const reset = RESETS.find((x) => x.value === Number(r.reset_period)) ?? RESETS[1];
            return (
              <SettingCard
                key={r._uuid}
                tone={toneOf(r.doc_code)}
                badge={r.prefix || '#'}
                title={r.name}
                subtitle={[r.doc_code, r.journal && `${r.journal.journal_code} · ${r.journal.name}`].filter(Boolean).join(' · ')}
                meta={
                  <>
                    <MetaChip icon={reset.icon}>{t(reset.label)}</MetaChip>
                    <MetaChip icon="fa-list-ol">{r.digits} {t('dnDigitsUnit')}</MetaChip>
                  </>
                }
                aside={
                  <div className="acs-aside-figure is-mono" title={formatNumberText(r, nextSequence(r))}>
                    <small>{t('dnPreview')}</small>
                    <NumberPreview format={r} seq={nextSequence(r)} />
                  </div>
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

      {editing !== undefined && (
        <DocNumberingForm data={editing} journals={journals} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default DocNumberingPage;
