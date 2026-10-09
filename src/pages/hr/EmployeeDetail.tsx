import { useState, type ChangeEvent, type ReactNode } from 'react';
import { Button, DatePicker, Loader, Modal } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import {
  GENDERS, MAX_DOCUMENTS, MAX_FILE, RESIGNED, WORKING, downloadWithAuth, fileSizeText, fullName, type Employee, type EmployeeDocument,
} from './hrApi';
import { HrAvatar, WorkStatusPill } from './hrKit';

const DOCUMENT = /\.(jpe?g|png|webp|pdf|docx?|xlsx?)$/i;

const showDate = (value: string | null) => (value ? moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY') : '—');

/** PUT ສະເພາະ work_status + end_date (backend ໃຊ້ຄ່າເດີມຂອງຖັນທີ່ບໍ່ສົ່ງ); ລາອອກ = backend ປິດບັນຊີຜູ້ໃຊ້ທີ່ຜູກໄວ້ */
const saveWorkStatus = async (employee: Employee, status: number, endDate: Date | null) => {
  const body = new FormData();
  body.append('work_status', String(status));
  body.append('end_date', endDate ? moment(endDate).format('YYYY-MM-DD') : '');
  const res = await putApi(`/employee/${btoa(String(employee._uuid))}`, body);
  return (res.data?.data ?? employee) as Employee;
};

/** ກ່ອງລາອອກ — ເລືອກວັນລາອອກ (ຕັ້ງແຕ່ວັນເຂົ້າວຽກ) ແລ້ວຢືນຢັນ */
const ResignModal = ({ employee, onClose, onSaved }: {
  employee: Employee;
  onClose: () => void;
  onSaved: (saved: Employee) => void;
}) => {
  const t = useT();
  const [date, setDate] = useState<Date | null>(new Date());
  const [saving, setSaving] = useState(false);
  const linkedUser = employee.user && Number(employee.user.status) === 1 ? employee.user : null;

  const submit = async () => {
    if (!date) return;
    try {
      setSaving(true);
      const saved = await saveWorkStatus(employee, RESIGNED, date);
      Notific.success('saveSuccessDone');
      onSaved(saved);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xs" className="acc-lock-modal hr-resign">
      <Modal.Body>
        <div className="acc-lock">
          <span className="hr-resign-icon"><i className="fa-solid fa-door-open" /></span>
          <h4>{t('hrResign')}</h4>
          <p>{employee.emp_code} · {fullName(employee)}</p>
          <label className="hr-resign-field">
            <span>{t('hrEndDate')}</span>
            <DatePicker value={date} onChange={setDate} oneTap format="dd/MM/yyyy" block placement="bottomStart"
              shouldDisableDate={(day) => !!employee.start_date && moment(day).isBefore(moment(employee.start_date, 'YYYY-MM-DD'), 'day')}
            />
          </label>
          {linkedUser && (
            <div className="hr-note is-warn">
              <i className="fa-solid fa-user-lock" /> {t('hrResignCloseUser')} ({linkedUser.user_name})
            </div>
          )}
          <div className="acc-lock-actions">
            <Button appearance="default" className="acc-lock-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
            <Button appearance="primary" className="acc-lock-btn is-danger" loading={saving} disabled={!date} onClick={submit}>
              <i className="fa-solid fa-door-open" /> {t('hrResignConfirm')}
            </Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

/** ໄລຍະເວລາ (ປີ ເດືອນ) ຈາກວັນທີ ຮອດ ມື້ນີ້ ຫຼື ວັນທີສິ້ນສຸດ */
const spanText = (from: string | null, to: string | null, t: (key: string) => string) => {
  if (!from) return '';
  const end = to ? moment(to, 'YYYY-MM-DD') : moment();
  const months = end.diff(moment(from, 'YYYY-MM-DD'), 'months');
  if (months < 0) return '';
  const years = Math.floor(months / 12);
  return [years && `${years} ${t('hrYears')}`, months % 12 && `${months % 12} ${t('hrMonths')}`].filter(Boolean).join(' ') || `< 1 ${t('hrMonths')}`;
};

const docIcon = (doc: EmployeeDocument) =>
  /pdf/i.test(doc.mime_type ?? doc.original_name) ? 'fa-file-pdf'
    : /image/i.test(doc.mime_type ?? '') ? 'fa-file-image'
      : /sheet|excel|xlsx?$/i.test(doc.mime_type ?? doc.original_name) ? 'fa-file-excel' : 'fa-file-word';

/**
 * ລາຍລະອຽດພະນັກງານ — ຂໍ້ມູນທັງໝົດ, ບັນຊີຜູ້ໃຊ້ທີ່ຜູກ ແລະ ເອກະສານຄັດຕິດ (ອັບໂຫຼດ ≤ 5 ໄຟລ໌ × 5MB, ດາວໂຫຼດຜ່ານ API ທີ່ login ແລ້ວ, ລຶບ).
 * ປ່ຽນສະຖານະຢູ່ນີ້: ລາອອກ (ເລືອກວັນລາອອກ) / ກັບເຂົ້າວຽກ (ລ້າງວັນລາອອກ)
 */
const EmployeeDetail = ({ employee: initial, onClose, onEdit, onChanged }: {
  employee: Employee;
  onClose: () => void;
  /** ສົ່ງຂໍ້ມູນລ່າສຸດ (ຫຼັງອັບໂຫຼດ / ລາອອກ) ໄປຟອມແກ້ໄຂ */
  onEdit: (employee: Employee) => void;
  /** ເອກະສານ / ສະຖານະປ່ຽນ — ໃຫ້ລາຍການໂຫຼດຄືນ */
  onChanged: () => void;
}) => {
  const t = useT();
  const [employee, setEmployee] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [resigning, setResigning] = useState(false);
  const resigned = Number(employee.work_status) === RESIGNED;
  const gender = GENDERS.find((g) => g.value === Number(employee.gender));
  const address = [employee.village, employee.district?.district_name, employee.province?.province_name].filter(Boolean).join(', ');

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    if (files.length > MAX_DOCUMENTS) return Notific.warning('hrDocumentMax');
    if (files.some((f) => !DOCUMENT.test(f.name))) return Notific.warning('hrDocumentType');
    if (files.some((f) => f.size > MAX_FILE)) return Notific.warning('incomeFileSize');
    const body = new FormData();
    files.forEach((f) => body.append('files', f));
    try {
      setUploading(true);
      const res = await postApi(`/employee/document/${btoa(String(employee._uuid))}`, body);
      setEmployee(res.data?.data ?? employee);
      Notific.success('saveSuccessDone');
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  /** ສຳເນົາເລກບັນຊີ (ບໍ່ມີຂີດ) ໄປວາງໃນແອັບທະນາຄານຕອນໂອນເງິນເດືອນ */
  const copyAccount = (accountNo: string) => {
    navigator.clipboard?.writeText(accountNo.replace(/[\s-]/g, ''))
      .then(() => Notific.success('hrCopied'))
      .catch(() => Notific.error('hrCopyFailed'));
  };

  const remove = (doc: EmployeeDocument) =>
    Notific.confirm(`${t('hrDocumentDeleteConfirm')} ${doc.original_name}`, async () => {
      try {
        const res = await deleteApi(`/employee/document/${btoa(String(doc._uuid))}`);
        setEmployee(res.data?.data ?? { ...employee, documents: employee.documents.filter((d) => d._uuid !== doc._uuid) });
        Notific.success('acsDeleted');
        onChanged();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  /** ກັບເຂົ້າວຽກ — ລ້າງວັນລາອອກ; ບັນຊີຜູ້ໃຊ້ທີ່ຖືກປິດ ຕ້ອງເປີດເອງຢູ່ໜ້າຜູ້ໃຊ້ */
  const reinstate = () =>
    Notific.confirm(`${t('hrReinstateConfirm')} ${employee.emp_code} ${fullName(employee)}`, async () => {
      try {
        setEmployee(await saveWorkStatus(employee, WORKING, null));
        Notific.success('saveSuccessDone');
        onChanged();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  /** [label, ຄ່າ, ກວ້າງເຕັມແຖວ] */
  const rows: [string, ReactNode, boolean?][] = [
    ['hrDepartment', employee.department?.depart_name ?? '—'],
    ['hrPosition', employee.position?.position_name ?? '—'],
    ['hrStartDate', <>{showDate(employee.start_date)} <small>{spanText(employee.start_date, employee.end_date, t)}</small></>],
    ...(employee.end_date ? [['hrEndDate', showDate(employee.end_date)] as [string, ReactNode, boolean?]] : []),
    ['hrBasicSalary', employee.basic_salary ? `₭ ${formatNumber(employee.basic_salary)}` : '—'],
    ['hrGender', gender ? <><i className={`fa-solid ${gender.icon}`} /> {t(gender.label)}</> : '—'],
    ['hrBirthday', <>{showDate(employee.birthday)} <small>{employee.birthday ? `${moment().diff(moment(employee.birthday), 'years')} ${t('hrYears')}` : ''}</small></>],
    ['hrPhone', employee.phone || '—'],
    ['hrEmail', employee.email || '—'],
    ['hrAddress', address || '—'],
    ['hrAccount', employee.user
      ? <><i className="fa-solid fa-user-shield" /> {employee.user.user_name} · {employee.user.phones}{Number(employee.user.status) !== 1 ? ` (${t('inactive')})` : ''}</>
      : t('hrNoAccount')],
    ['hrSalaryAccount', employee.bank && employee.bank_account_no ? (
      <span className="hr-bank-account">
        {employee.bank.url ? <img src={employee.bank.url} alt="" /> : <i className="fa-solid fa-building-columns" />}
        <span>
          <b>{employee.bank.abbr} · {employee.bank_account_no}</b>
          {employee.bank_account_name && <small>{employee.bank_account_name}</small>}
        </span>
        <button type="button" className="acc-gl-act" title={t('hrCopy')} aria-label={t('hrCopy')} onClick={() => copyAccount(employee.bank_account_no!)}>
          <i className="fa-regular fa-copy" />
        </button>
      </span>
    ) : t('hrNoSalaryAccount'), true],
  ];

  return (
    <Modal open onClose={onClose} size="md" className="acc-gl-ledger-modal hr-detail">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <HrAvatar url={employee.profile_url} name={employee.first_name} size="lg" />
          <span>
            <Modal.Title>{fullName(employee)} <WorkStatusPill status={employee.work_status} /></Modal.Title>
            <small>{employee.emp_code}{employee.position ? ` · ${employee.position.position_name}` : ''}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <dl className="hr-info">
          {rows.map(([label, value, wide]) => (
            <div key={label} className={wide ? 'is-wide' : undefined}><dt>{t(label)}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        {employee.description && <p className="acc-arap-desc">{employee.description}</p>}

        <div className="hr-docs-head">
          <h6><i className="fa-solid fa-paperclip" /> {t('hrDocuments')} <em>{employee.documents.length}</em></h6>
          <label className={`acc-rp-btn${!canEdit || uploading ? ' is-disabled' : ''}`}>
            {uploading ? <Loader size="xs" /> : <i className="fa-solid fa-upload" />} {t('hrDocumentUpload')}
            <input type="file" multiple hidden disabled={!canEdit || uploading} onChange={upload}
              accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"
            />
          </label>
        </div>
        {employee.documents.length ? (
          <ul className="hr-docs">
            {employee.documents.map((doc) => (
              <li key={doc._uuid}>
                <i className={`fa-solid ${docIcon(doc)}`} />
                <span>
                  <b>{doc.original_name}</b>
                  <small>{fileSizeText(doc.file_size)} · {moment(doc.createdAt).format('DD/MM/YYYY')}</small>
                </span>
                <button type="button" className="acc-gl-act" title={t('hrDownload')}
                  onClick={() => downloadWithAuth(`/employee/document/download/${btoa(String(doc._uuid))}`, doc.original_name)}
                >
                  <i className="fa-solid fa-download" />
                </button>
                <button type="button" className="acc-gl-act is-danger" title={t('delete')} disabled={!canEdit} onClick={() => remove(doc)}>
                  <i className="fa-solid fa-trash" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="acc-arap-empty">{t('hrNoDocuments')}</p>
        )}
        <small className="hr-docs-note">{t('hrDocumentNote')}</small>
      </Modal.Body>
      <Modal.Footer>
        {resigned ? (
          <button type="button" className="acc-rp-btn hr-status-btn" disabled={!canEdit} onClick={reinstate}>
            <i className="fa-solid fa-rotate-left" /> {t('hrReinstate')}
          </button>
        ) : (
          <button type="button" className="acc-rp-btn is-danger hr-status-btn" disabled={!canEdit} onClick={() => setResigning(true)}>
            <i className="fa-solid fa-door-open" /> {t('hrResign')}
          </button>
        )}
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" disabled={!canEdit} onClick={() => onEdit(employee)}>
          <i className="fa-solid fa-pen" /> {t('edit')}
        </Button>
      </Modal.Footer>

      {resigning && (
        <ResignModal employee={employee} onClose={() => setResigning(false)}
          onSaved={(saved) => {
            setEmployee(saved);
            setResigning(false);
            onChanged();
          }}
        />
      )}
    </Modal>
  );
};

export default EmployeeDetail;
