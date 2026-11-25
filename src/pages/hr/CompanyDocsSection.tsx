import { useCallback, useEffect, useRef, useState } from 'react';
import { DatePicker, Form, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { InputField } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { useT } from '../../context/LanguageContext';
import { AttachmentPicker, ChoiceTiles, FormStep, SettingModal } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { MAX_FILE, downloadWithAuth } from './hrApi';

/** ເອກະສານບໍລິສັດ (GET /company/document) — days_left null = ບໍ່ມີວັນໝົດອາຍຸ, ລົບ = ໝົດແລ້ວ */
type CompanyDoc = {
  _uuid: number;
  doc_type: number;
  title: string;
  doc_no: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  note: string | null;
  original_name: string | null;
  has_file: boolean;
  days_left: number | null;
};

const DOC_TYPES: { value: number; label: string; icon: string }[] = [
  { value: 1, label: 'cdType1', icon: 'fa-building-circle-check' },
  { value: 2, label: 'cdType2', icon: 'fa-receipt' },
  { value: 3, label: 'cdType3', icon: 'fa-certificate' },
  { value: 4, label: 'cdType4', icon: 'fa-file-lines' },
];
const iconOf = (type: number) => DOC_TYPES.find((d) => d.value === Number(type))?.icon ?? 'fa-file-lines';
const FILE_TYPES = /\.(jpe?g|png|webp|pdf)$/i;
const enc = (id: number) => btoa(String(id));
const dateValue = (value: string | null) => (value ? moment(value, 'YYYY-MM-DD').toDate() : null);
const apiDate = (value: Date | null) => (value ? moment(value).format('YYYY-MM-DD') : '');

/** ຟອມເອກະສານ 3 ຂັ້ນ: ປະເພດ + ເລກທີ, ວັນທີ, ໄຟລ໌ + ໝາຍເຫດ */
const CompanyDocForm = ({ data, onClose, onSaved }: { data: CompanyDoc | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<number>(data?.doc_type ?? 1);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [inputs, setInputs] = useState<any>({
    title: data?.title ?? t('cdType1'),
    doc_no: data?.doc_no ?? '',
    issued_by: data?.issued_by ?? '',
    issue_date: dateValue(data?.issue_date ?? null),
    expiry_date: dateValue(data?.expiry_date ?? null),
    note: data?.note ?? '',
  });
  const model = createModel<any>({ title: requiredField(t('inputRequired'), 'string') });
  const existingName = removeFile ? null : data?.original_name ?? null;

  /** ປ່ຽນປະເພດ — ຊື່ທີ່ຍັງເປັນຊື່ປະເພດເກົ່າ (ຫຼື ຫວ່າງ) ປ່ຽນຕາມ */
  const pickType = (next: number) => {
    const oldName = t(DOC_TYPES.find((d) => d.value === docType)?.label ?? '');
    setDocType(next);
    if (!String(inputs.title).trim() || inputs.title === oldName) setInputs({ ...inputs, title: t(DOC_TYPES.find((d) => d.value === next)!.label) });
  };

  const pickFile = (next: File) => {
    if (!FILE_TYPES.test(next.name)) return Notific.warning('cdFileType');
    if (next.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setFile(next);
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (inputs.issue_date && inputs.expiry_date && inputs.expiry_date < inputs.issue_date) return Notific.warning('cdDateOrder');
    const body = new FormData();
    body.append('doc_type', String(docType));
    body.append('title', String(inputs.title).trim());
    body.append('doc_no', String(inputs.doc_no ?? '').trim());
    body.append('issued_by', String(inputs.issued_by ?? '').trim());
    body.append('issue_date', apiDate(inputs.issue_date));
    body.append('expiry_date', apiDate(inputs.expiry_date));
    body.append('note', String(inputs.note ?? '').trim());
    if (file) body.append('file', file);
    if (removeFile && !file) body.append('remove_file', '1');
    if (await runSave(() => (data ? putApi(`/company/document/${enc(data._uuid)}`, body) : postApi('/company/document', body)), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'cdEdit' : 'cdAdd')} hint={t('cdHint')} icon="fa-folder-open" saving={saving} onClose={onClose} onSubmit={submit}
      className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done={!!String(inputs.title).trim()} title={t('cdStepType')} hint={t('cdStepTypeHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('cdType')} value={docType} onChange={pickType}
            options={DOC_TYPES.map((d) => ({ value: d.value, label: t(d.label), icon: d.icon }))}
          />
          <div className="is-wide">
            <InputField name="title" label={t('cdName')} icon={<i className="fa-solid fa-file-signature" />} />
          </div>
          <InputField name="doc_no" label={t('cdNo')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
          <InputField name="issued_by" label={t('cdIssuedBy')} required={false} icon={<i className="fa-solid fa-landmark" />} />
        </FormStep>

        <FormStep no={2} done={!!inputs.issue_date || !!inputs.expiry_date} title={t('cdStepDates')} hint={t('cdStepDatesHint')}>
          <InputField name="issue_date" label={t('cdIssueDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />
          <InputField name="expiry_date" label={t('cdExpiryDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false}
            placeholder={t('cdNoExpiry')}
          />
        </FormStep>

        <FormStep no={3} done={!!file || !!existingName} title={t('cdStepFile')} hint={t('cdStepFileHint')}>
          <div className="is-wide acc-jr-file">
            <AttachmentPicker file={file} existingName={existingName} hint="PDF, JPG, PNG · ≤ 5MB" icon="fa-folder-open"
              onOpenExisting={data ? () => downloadWithAuth(`/company/document/download/${enc(data._uuid)}`, data.original_name ?? 'document') : undefined}
              onPick={pickFile}
              onClear={() => { setFile(null); if (data?.original_name) setRemoveFile(true); }}
            />
          </div>
          <div className="is-wide">
            <InputField name="note" label={t('note')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ເອກະສານບໍລິສັດ (ໜ້າຂໍ້ມູນບໍລິສັດ) — ໃບທະບຽນວິສາຫະກິດ, ໃບທະບຽນອາກອນ, ໃບອະນຸຍາດ… ພ້ອມວັນໝົດອາຍຸ ແລະ ໄຟລ໌.
 * ໃກ້ໝົດ (≤ 60 ມື້) ຂຶ້ນໃນ "ຕ້ອງຕິດຕາມ" ຂອງ desktop ນຳ
 */
const CompanyDocsSection = () => {
  const t = useT();
  const [docs, setDocs] = useState<CompanyDoc[] | null>(null);
  const [editing, setEditing] = useState<CompanyDoc | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await getApi('/company/document');
      setDocs(res.data?.data ?? []);
    } catch (error) {
      console.error(error);
      setDocs([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = (doc: CompanyDoc) => Notific.confirm(`${t('cdDeleteConfirm')} ${doc.title}`, async () => {
    try {
      await deleteApi(`/company/document/${enc(doc._uuid)}`);
      Notific.success('acsDeleted');
      load();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  const dueText = (days: number) => (days < 0 ? t('expOverdue').replace('{n}', String(-days)) : days === 0 ? t('expToday') : t('expIn').replace('{n}', String(days)));

  return (
    <section className="acc-book-step hr-company-card hr-company-docs">
      <header>
        <span className="hr-company-card-icon"><i className="fa-solid fa-folder-open" /></span>
        <span className="acc-book-step-title"><b>{t('cdTitle')}</b><small>{t('cdHint')}</small></span>
        {canCreate && (
          <button type="button" className="acc-rp-btn is-primary" onClick={() => setEditing(null)}>
            <i className="fa-solid fa-plus" /> {t('cdAdd')}
          </button>
        )}
      </header>
      {!docs ? null : !docs.length ? (
        <p className="hr-company-docs-empty"><i className="fa-regular fa-folder-open" /> {t('cdEmpty')}</p>
      ) : (
        <ul className="hr-company-doc-list">
          {docs.map((doc) => (
            <li key={doc._uuid}>
              <span className="hr-company-doc-icon"><i className={`fa-solid ${iconOf(doc.doc_type)}`} /></span>
              <span className="hr-company-doc-text">
                <b>{doc.title}{doc.doc_no ? <small> · {doc.doc_no}</small> : null}</b>
                <small>
                  {[doc.issued_by, doc.issue_date && `${t('cdIssued')} ${moment(doc.issue_date).format('DD/MM/YYYY')}`,
                    doc.expiry_date ? `${t('cdExpires')} ${moment(doc.expiry_date).format('DD/MM/YYYY')}` : t('cdNoExpiry')].filter(Boolean).join(' · ')}
                </small>
                {doc.days_left !== null && doc.days_left <= 60 && (
                  <span className={`hr-expiry-chip${doc.days_left < 0 ? ' is-over' : doc.days_left <= 7 ? ' is-soon' : ''}`}>
                    <i className="fa-solid fa-hourglass-end" /> {dueText(doc.days_left)}
                  </span>
                )}
              </span>
              <span className="hr-company-doc-actions">
                {doc.has_file && (
                  <button type="button" className="acc-gl-act" title={t('cdOpen')} aria-label={t('cdOpen')}
                    onClick={() => downloadWithAuth(`/company/document/download/${enc(doc._uuid)}`, doc.original_name ?? doc.title)}
                  >
                    <i className="fa-solid fa-download" />
                  </button>
                )}
                <button type="button" className="acc-gl-act" disabled={!canEdit} title={t('edit')} onClick={() => setEditing(doc)}><i className="fa-solid fa-pen" /></button>
                <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')} onClick={() => remove(doc)}><i className="fa-solid fa-trash" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined && <CompanyDocForm data={editing} onClose={() => setEditing(undefined)} onSaved={load} />}
    </section>
  );
};

export default CompanyDocsSection;
