import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { DatePicker, Input, Loader, SelectPicker, Textarea } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { SettingModal, SwitchRow } from '../account/setting/settingKit';
import {
  DOCUMENT_ACCEPT, DOCUMENT_FILE, DOC_TYPES, MARITAL_STATUSES, MAX_DOCUMENTS, MAX_FILE, RESUME_KINDS, WAGE_TYPES,
  docIcon, downloadWithAuth, fileSizeText, type Employee, type EmployeeDocument, type ResumeLine, type SkillType,
} from './hrApi';

const enc = (id: number) => btoa(String(id));
const showDate = (value: string | null | undefined) => (value ? moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY') : null);
const apiDate = (value: Date | null | undefined) => (value ? moment(value).format('YYYY-MM-DD') : '');
const toDate = (value: string | null | undefined) => (value ? moment(value, 'YYYY-MM-DD').toDate() : null);

/** ວັນໝົດອາຍຸ — ກາຍແລ້ວ = ແດງ, ຍັງເຫຼືອ ≤ 60 ມື້ = ເຫຼືອງ */
const ExpiryDate = ({ value }: { value: string | null }) => {
  const t = useT();
  if (!value) return null;
  const days = moment(value, 'YYYY-MM-DD').diff(moment().startOf('day'), 'days');
  return (
    <>
      {showDate(value)}
      {days < 0 && <em className="hr-expiry is-bad">{t('hrExpired')}</em>}
      {days >= 0 && days <= 60 && <em className="hr-expiry is-warn">{t('hrExpiresIn').replace('{n}', String(days))}</em>}
    </>
  );
};

/**
 * ຂໍ້ມູນເພີ່ມເຕີມ (ສັນຍາ, ບັດ/ເອກະສານ, ຄອບຄົວ, ການສຶກສາ, ຕິດຕໍ່ສຸກເສີນ) —
 * ສະແດງສະເພາະກຸ່ມທີ່ມີຂໍ້ມູນ (ບໍລິສັດທີ່ບໍ່ໃຊ້ ຈະບໍ່ເຫັນຫຍັງເກີນ)
 */
export const ExtraInfo = ({ employee: e }: { employee: Employee }) => {
  const t = useT();
  const marital = MARITAL_STATUSES.find((m) => m.value === Number(e.marital_status));
  const age = (d: string | null) => (d ? ` (${moment().diff(moment(d), 'years')} ${t('hrYears')})` : '');
  const groups: { title: string; icon: string; rows: [string, ReactNode][] }[] = [
    {
      title: 'hrContract',
      icon: 'fa-file-signature',
      rows: [
        ['hrEmployeeType', e.employeeType?.name],
        ['hrContractNo', e.contract_no],
        ['hrContractTerm', Number(e.contract_fixed_term) === 1 ? <>{t('hrFixedTerm')}{e.contract_end && <> → <ExpiryDate value={e.contract_end} /></>}</> : null],
        ['hrProbationEnd', showDate(e.probation_end)],
        ['hrWageType', Number(e.wage_type) === 2 ? t(WAGE_TYPES[1].label) : null],
      ],
    },
    {
      title: 'hrIdentity',
      icon: 'fa-id-card',
      rows: [
        ['hrIdCardNo', e.id_card_no && <>{e.id_card_no} {e.id_card_expiry && <small>· <ExpiryDate value={e.id_card_expiry} /></small>}</>],
        ['hrPassportNo', e.passport_no && <>{e.passport_no} {e.passport_expiry && <small>· <ExpiryDate value={e.passport_expiry} /></small>}</>],
        ['hrSsoNo', e.sso_no],
        ['hrNationality', [e.nationality, e.ethnicity].filter(Boolean).join(' · ') || null],
        ['hrReligion', e.religion],
        ['hrBirthPlace', e.birth_place],
        ['hrBloodType', e.blood_type],
      ],
    },
    {
      title: 'hrFamily',
      icon: 'fa-people-roof',
      rows: [
        ['hrMaritalStatus', marital ? t(marital.label) : null],
        ['hrSpouseName', e.spouse_name && `${e.spouse_name}${age(e.spouse_birthday)}`],
        ['hrSpousePhone', e.spouse_phone],
        ['hrChildren', e.children !== null && e.children !== undefined ? `${e.children} ${t('hrPeople')}` : null],
      ],
    },
    {
      title: 'hrEducation',
      icon: 'fa-graduation-cap',
      rows: [
        ['hrEducationLevel', e.educationLevel?.name],
        ['hrEducationField', e.education_field],
        ['hrEducationSchool', [e.education_school, e.graduation_year].filter(Boolean).join(' · ') || null],
      ],
    },
    {
      title: 'hrEmergency',
      icon: 'fa-truck-medical',
      rows: [
        ['hrEmergencyName', e.emergency_name && `${e.emergency_name}${e.emergency_relation ? ` (${e.emergency_relation})` : ''}`],
        ['hrEmergencyPhone', e.emergency_phone],
        ['hrHomeDistance', e.home_distance_km !== null && e.home_distance_km !== undefined ? `${formatNumber(e.home_distance_km)} km` : null],
      ],
    },
  ];
  const shown = groups.map((g) => ({ ...g, rows: g.rows.filter(([, v]) => v !== null && v !== undefined && v !== '') })).filter((g) => g.rows.length);
  if (!shown.length) return <p className="hr-extra-empty"><i className="fa-solid fa-circle-info" /> {t('hrExtraEmpty')}</p>;
  return (
    <div className="hr-extra">
      {shown.map((g) => (
        <section key={g.title}>
          <h6><i className={`fa-solid ${g.icon}`} /> {t(g.title)}</h6>
          <dl>
            {g.rows.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
      ))}
    </div>
  );
};

// ================= ປະຫວັດຫຍໍ້

type ResumeDraft = { _uuid?: number; kind: number; title: string; subtitle: string; start: Date | null; end: Date | null; ongoing: boolean; description: string };

/** ຟອມປະຫວັດ 1 ແຖວ — ປະເພດ, ຊື່, ຕຳແໜ່ງ/ວຸດທິ, ໄລຍະເວລາ (ຍັງເຮັດຢູ່ = ບໍ່ມີວັນສິ້ນສຸດ), ລາຍລະອຽດ, ໃບຢັ້ງຢືນ 1 ໄຟລ໌ */
const ResumeForm = ({ employeeId, line, kind, onClose, onSaved }: {
  employeeId: number;
  line: ResumeLine | null;
  kind: number;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
}) => {
  const t = useT();
  const [draft, setDraft] = useState<ResumeDraft>({
    kind: line?.kind ?? kind,
    title: line?.title ?? '',
    subtitle: line?.subtitle ?? '',
    start: toDate(line?.start_date),
    end: toDate(line?.end_date),
    ongoing: !!line && !line.end_date,
    description: line?.description ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ResumeDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const kindInfo = RESUME_KINDS.find((k) => k.value === draft.kind)!;

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!DOCUMENT_FILE.test(f.name)) return Notific.warning('hrDocumentType');
    if (f.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setFile(f);
  };

  const submit = async () => {
    if (!draft.title.trim()) return Notific.warning(t('hrResumeTitleRequired'));
    const body = new FormData();
    body.append('kind', String(draft.kind));
    body.append('title', draft.title.trim());
    body.append('subtitle', draft.subtitle.trim());
    body.append('start_date', apiDate(draft.start));
    body.append('end_date', draft.ongoing ? '' : apiDate(draft.end));
    body.append('description', draft.description.trim());
    if (file) body.append('files', file);
    if (line && removeFile && !file) body.append('remove_file', '1');
    try {
      setSaving(true);
      const res = line
        ? await putApi(`/employee/resume-line/${enc(line._uuid)}`, body)
        : await postApi(`/employee/resume/${enc(employeeId)}`, body);
      Notific.success('saveSuccessDone');
      onSaved(res.data?.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const currentFile = line?.original_name && !removeFile ? line.original_name : null;
  return (
    <SettingModal title={t(line ? 'hrResumeEdit' : 'hrResumeAdd')} hint={t(kindInfo.label)} icon={kindInfo.icon} saving={saving} onClose={onClose} onSubmit={submit} keyboard={false}>
      <div className="hr-resume-form">
        <div className="acc-type-segment" role="radiogroup">
          {RESUME_KINDS.map((k) => (
            <button key={k.value} type="button" role="radio" aria-checked={draft.kind === k.value} className={draft.kind === k.value ? 'is-active' : ''}
              onClick={() => set({ kind: k.value })}
            >
              <i className={`fa-solid ${k.icon}`} /> {t(k.label)}
            </button>
          ))}
        </div>
        <label className="hr-field">
          <span>{t(draft.kind === 1 ? 'hrResumeCompany' : draft.kind === 2 ? 'hrResumeSchool' : 'hrResumeCourse')} <em>*</em></span>
          <Input value={draft.title} onChange={(v) => set({ title: v })} placeholder={t(draft.kind === 1 ? 'hrResumeCompanyHint' : 'hrResumeSchoolHint')} />
        </label>
        <label className="hr-field">
          <span>{t(draft.kind === 1 ? 'hrResumeRole' : draft.kind === 2 ? 'hrResumeDegree' : 'hrResumeOrganizer')}</span>
          <Input value={draft.subtitle} onChange={(v) => set({ subtitle: v })} />
        </label>
        <div className="hr-field-row">
          <label className="hr-field">
            <span>{t('hrResumeFrom')}</span>
            <DatePicker block oneTap format="MM/yyyy" value={draft.start} onChange={(v) => set({ start: v })} placeholder="mm/yyyy" />
          </label>
          <label className="hr-field">
            <span>{t('hrResumeTo')}</span>
            <DatePicker block oneTap format="MM/yyyy" value={draft.ongoing ? null : draft.end} disabled={draft.ongoing} onChange={(v) => set({ end: v })}
              placeholder={draft.ongoing ? t('hrResumeNow') : 'mm/yyyy'}
            />
          </label>
        </div>
        <SwitchRow checked={draft.ongoing} onChange={(on) => set({ ongoing: on })} className="hr-inline-toggle" size="sm">
          <span><b>{t(draft.kind === 1 ? 'hrResumeStillWorking' : 'hrResumeStillStudying')}</b></span>
        </SwitchRow>
        <label className="hr-field">
          <span>{t('detail')}</span>
          <Textarea rows={3} value={draft.description} onChange={(v) => set({ description: v })} />
        </label>
        <div className="hr-field">
          <span>{t('hrResumeCertificate')}</span>
          {file || currentFile ? (
            <span className="hr-resume-file">
              <i className="fa-solid fa-paperclip" /> <b>{file?.name ?? currentFile}</b>
              {file && <small>{fileSizeText(file.size)}</small>}
              <button type="button" className="acc-gl-act is-danger" aria-label={t('delete')} onClick={() => (file ? setFile(null) : setRemoveFile(true))}>
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ) : (
            <label className="acc-rp-btn hr-resume-pick">
              <i className="fa-solid fa-upload" /> {t('hrDocumentUpload')}
              <input type="file" hidden accept={DOCUMENT_ACCEPT} onChange={pick} />
            </label>
          )}
        </div>
      </div>
    </SettingModal>
  );
};

const period = (line: ResumeLine, t: (k: string) => string) => {
  const fmt = (d: string | null) => (d ? moment(d, 'YYYY-MM-DD').format('MM/YYYY') : '…');
  if (!line.start_date && !line.end_date) return null;
  return `${fmt(line.start_date)} – ${line.end_date ? fmt(line.end_date) : t('hrResumeNow')}`;
};

/** ປະຫວັດຫຍໍ້ — ປະສົບການເຮັດວຽກ, ການສຶກສາ, ການຝຶກອົບຮົມ (ເພີ່ມ/ແກ້/ລຶບ, ໃບຢັ້ງຢືນດາວໂຫຼດໄດ້) */
export const ResumeSection = ({ employee, onSaved }: { employee: Employee; onSaved: (employee: Employee) => void }) => {
  const t = useT();
  const [editing, setEditing] = useState<{ line: ResumeLine | null; kind: number } | null>(null);
  const remove = (line: ResumeLine) => Notific.confirm(`${t('hrResumeDeleteConfirm')} ${line.title}`, async () => {
    try {
      const res = await deleteApi(`/employee/resume-line/${enc(line._uuid)}`);
      onSaved(res.data?.data);
      Notific.success('acsDeleted');
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });
  return (
    <section className="hr-profile-block">
      <header>
        <h6><i className="fa-solid fa-timeline" /> {t('hrResume')} <em>{employee.resumes.length}</em></h6>
      </header>
      {RESUME_KINDS.map((k) => {
        const lines = employee.resumes.filter((r) => r.kind === k.value);
        return (
          <div key={k.value} className="hr-resume-group">
            <div className="hr-resume-group-head">
              <span><i className={`fa-solid ${k.icon}`} /> {t(k.label)} {lines.length > 0 && <em>{lines.length}</em>}</span>
              {canEdit && (
                <button type="button" className="acc-gl-act" title={t('hrResumeAdd')} aria-label={t('hrResumeAdd')} onClick={() => setEditing({ line: null, kind: k.value })}>
                  <i className="fa-solid fa-plus" />
                </button>
              )}
            </div>
            {lines.map((line) => (
              <article key={line._uuid} className="hr-resume-line">
                <span className="hr-resume-dot" />
                <div className="hr-resume-body">
                  <b>{line.title}</b>
                  {(line.subtitle || period(line, t)) && <small>{[line.subtitle, period(line, t)].filter(Boolean).join(' · ')}</small>}
                  {line.description && <p>{line.description}</p>}
                  {line.original_name && (
                    <button type="button" className="hr-resume-file is-link"
                      onClick={() => downloadWithAuth(`/employee/resume-line/file/${enc(line._uuid)}`, line.original_name!)}
                    >
                      <i className="fa-solid fa-paperclip" /> {line.original_name}
                    </button>
                  )}
                </div>
                {canEdit && (
                  <span className="hr-resume-actions">
                    <button type="button" className="acc-gl-act" title={t('edit')} aria-label={t('edit')} onClick={() => setEditing({ line, kind: line.kind })}>
                      <i className="fa-solid fa-pen" />
                    </button>
                    <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} onClick={() => remove(line)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </span>
                )}
              </article>
            ))}
          </div>
        );
      })}
      {editing && <ResumeForm employeeId={employee._uuid} line={editing.line} kind={editing.kind} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </section>
  );
};

// ================= ທັກສະ

/** ເລືອກທັກສະ + ລະດັບ — ທຸກໝວດທີ່ເປີດໃຊ້; ກົດລະດັບ = ເລືອກທັກສະນັ້ນໄປນຳ */
const SkillsModal = ({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: (employee: Employee) => void }) => {
  const t = useT();
  const [types, setTypes] = useState<SkillType[] | null>(null);
  const [picked, setPicked] = useState<Map<number, string | null>>(() => new Map(employee.skills.map((s) => [s.skill_id, s.level])));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getApi('/skill/fetch').then((res) => setTypes(res.data?.data ?? [])).catch((error) => Notific.error(getErrorMessage(error)));
  }, []);
  const set = (skillId: number, level: string | null | undefined) => setPicked((m) => {
    const next = new Map(m);
    if (level === undefined) next.delete(skillId);
    else next.set(skillId, level);
    return next;
  });
  const owned = new Set(employee.skills.map((s) => s.skill_id));
  const save = async () => {
    try {
      setSaving(true);
      const res = await putApi(`/employee/skills/${enc(employee._uuid)}`, { skills: [...picked].map(([skill_id, level]) => ({ skill_id, level })) });
      Notific.success('saveSuccessDone');
      onSaved(res.data?.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SettingModal title={t('hrSkillsEdit')} hint={t('hrSkillsEditHint')} icon="fa-star" saving={saving} onClose={onClose} onSubmit={save} wide keyboard={false}>
      {!types ? <div className="text-center py-4"><Loader /></div> : (
        <div className="hr-skill-editor">
          {types.filter((ty) => Number(ty.status) === 1).map((ty) => (
            <section key={ty._uuid}>
              <h6>{ty.name}</h6>
              {ty.skills.filter((s) => Number(s.status) === 1 || owned.has(s._uuid)).map((s) => {
                const on = picked.has(s._uuid);
                const level = picked.get(s._uuid) ?? null;
                return (
                  <div key={s._uuid} className={`hr-skill-row${on ? ' is-on' : ''}`}>
                    <button type="button" className="hr-skill-name" aria-pressed={on} onClick={() => set(s._uuid, on ? undefined : null)}>
                      <i className={`fa-solid ${on ? 'fa-square-check' : 'fa-square'}`} /> {s.name}
                    </button>
                    <span className="hr-skill-levels">
                      {ty.levels.map((l) => (
                        <button key={l} type="button" className={on && level === l ? 'is-active' : ''} onClick={() => set(s._uuid, on && level === l ? null : l)}>{l}</button>
                      ))}
                    </span>
                  </div>
                );
              })}
              {!ty.skills.length && <small className="hr-skill-none">{t('hrSkillNone')}</small>}
            </section>
          ))}
          {!types.length && <p className="acc-arap-empty">{t('hrSkillTypesEmpty')}</p>}
        </div>
      )}
    </SettingModal>
  );
};

/** ທັກສະຂອງພະນັກງານ — ຈັດກຸ່ມຕາມໝວດ, ປ້າຍລະດັບ (ສີເຂັ້ມຂຶ້ນຕາມລະດັບ) */
export const SkillSection = ({ employee, onSaved }: { employee: Employee; onSaved: (employee: Employee) => void }) => {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<number, { name: string; sort: number; skills: Employee['skills'] }>();
    for (const s of employee.skills) {
      const g = map.get(s.type_id) ?? { name: s.type_name, sort: s.type_sort, skills: [] };
      g.skills.push(s);
      map.set(s.type_id, g);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [employee.skills]);
  return (
    <section className="hr-profile-block">
      <header>
        <h6><i className="fa-solid fa-star" /> {t('hrSkills')} <em>{employee.skills.length}</em></h6>
        {canEdit && <button type="button" className="acc-rp-btn" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> {t('hrSkillsEdit')}</button>}
      </header>
      {groups.length ? groups.map((g) => (
        <div key={g.name} className="hr-skill-group">
          <span className="hr-skill-type">{g.name}</span>
          <span className="hr-skill-chips">
            {g.skills.map((s) => {
              const rank = s.level ? (s.levels.indexOf(s.level) + 1) / Math.max(1, s.levels.length) : 0;
              return (
                <span key={s._uuid} className="hr-skill-chip" style={{ '--rank': rank } as object}>
                  {s.name}{s.level && <em>{s.level}</em>}
                </span>
              );
            })}
          </span>
        </div>
      )) : <p className="acc-arap-empty">{t('hrSkillEmpty')}</p>}
      {editing && <SkillsModal employee={employee} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </section>
  );
};

// ================= ເອກະສານ

/**
 * ເອກະສານຄັດຕິດ ແຍກຕາມປະເພດ (ບັດປະຈຳຕົວ/Passport, ໃບຂັບຂີ່, CV, ສັນຍາ, ໃບຢັ້ງຢືນ, ອື່ນໆ) —
 * ແຕ່ລະປະເພດມີປຸ່ມອັບໂຫຼດຂອງຕົນ; ປ່ຽນປະເພດຂອງເອກະສານທີ່ອັບໄປແລ້ວໄດ້
 */
export const DocumentSection = ({ employee, onSaved }: { employee: Employee; onSaved: (employee: Employee) => void }) => {
  const t = useT();
  const [uploading, setUploading] = useState<string | null>(null);
  const typeOptions = DOC_TYPES.map((d) => ({ value: d.key, label: t(d.label) }));

  const upload = async (docType: string, e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (files.length > MAX_DOCUMENTS) return Notific.warning('hrDocumentMax');
    if (files.some((f) => !DOCUMENT_FILE.test(f.name))) return Notific.warning('hrDocumentType');
    if (files.some((f) => f.size > MAX_FILE)) return Notific.warning('incomeFileSize');
    const body = new FormData();
    files.forEach((f) => body.append('files', f));
    body.append('doc_type', docType);
    try {
      setUploading(docType);
      const res = await postApi(`/employee/document/${enc(employee._uuid)}`, body);
      if (res.data?.data) onSaved(res.data.data);
      Notific.success('saveSuccessDone');
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setUploading(null);
    }
  };
  const retype = async (doc: EmployeeDocument, docType: string) => {
    try {
      const res = await putApi(`/employee/document/${enc(doc._uuid)}`, { doc_type: docType });
      if (res.data?.data) onSaved(res.data.data);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };
  const remove = (doc: EmployeeDocument) => Notific.confirm(`${t('hrDocumentDeleteConfirm')} ${doc.original_name}`, async () => {
    try {
      const res = await deleteApi(`/employee/document/${enc(doc._uuid)}`);
      onSaved(res.data?.data ?? { ...employee, documents: employee.documents.filter((d) => d._uuid !== doc._uuid) });
      Notific.success('acsDeleted');
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  return (
    <section className="hr-profile-block">
      {DOC_TYPES.map((type) => {
        const docs = employee.documents.filter((d) => d.doc_type === type.key);
        return (
          <div key={type.key} className={`hr-doc-group${docs.length ? '' : ' is-empty'}`}>
            <div className="hr-doc-group-head">
              <span><i className={`fa-solid ${type.icon}`} /> {t(type.label)} {docs.length > 0 && <em>{docs.length}</em>}</span>
              <label className={`acc-rp-btn${!canEdit || uploading ? ' is-disabled' : ''}`}>
                {uploading === type.key ? <Loader size="xs" /> : <i className="fa-solid fa-upload" />} {t('hrDocumentUpload')}
                <input type="file" multiple hidden disabled={!canEdit || !!uploading} onChange={(e) => upload(type.key, e)} accept={DOCUMENT_ACCEPT} />
              </label>
            </div>
            {docs.length > 0 && (
              <ul className="hr-docs">
                {docs.map((doc) => (
                  <li key={doc._uuid}>
                    <i className={`fa-solid ${docIcon(doc)}`} />
                    <span>
                      <b>{doc.original_name}</b>
                      <small>{fileSizeText(doc.file_size)} · {moment(doc.createdAt).format('DD/MM/YYYY')}</small>
                    </span>
                    {canEdit && (
                      <SelectPicker size="xs" data={typeOptions} value={doc.doc_type} cleanable={false} searchable={false} className="hr-doc-type"
                        onChange={(v) => v && v !== doc.doc_type && retype(doc, String(v))} aria-label={t('hrDocType')}
                      />
                    )}
                    <button type="button" className="acc-gl-act" title={t('hrDownload')}
                      onClick={() => downloadWithAuth(`/employee/document/download/${enc(doc._uuid)}`, doc.original_name)}
                    >
                      <i className="fa-solid fa-download" />
                    </button>
                    <button type="button" className="acc-gl-act is-danger" title={t('delete')} disabled={!canEdit} onClick={() => remove(doc)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <small className="hr-docs-note">{t('hrDocumentNote')}</small>
    </section>
  );
};
