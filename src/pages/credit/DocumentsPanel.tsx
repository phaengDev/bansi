import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, SelectPicker } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { downloadWithAuth } from '../hr/hrApi';
import { DOC_TYPES, type CreditDocument } from './creditApi';

const sizeText = (n: number | null) => (!n ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fileIcon = (mime: string | null) => (mime?.startsWith('image/') ? 'fa-file-image' : mime?.includes('pdf') ? 'fa-file-pdf' : mime?.includes('word') ? 'fa-file-word' : 'fa-file');

/**
 * ເອກະສານແນບ (ລູກຄ້າ / ສັນຍາ / ຫຼັກຊັບ) — ອັບໂຫຼດສູງສຸດ 5 ໄຟລ໌ຕໍ່ເທື່ອ (ຮູບ, PDF, Word, Excel ≤ 5MB), ເລືອກປະເພດ,
 * ດາວໂຫຼດ (ຜ່ານ token), ລຶບ. ໃຊ້ຮ່ວມ: ລາຍລະອຽດລູກຄ້າ ແລະ ສັນຍາ
 */
const DocumentsPanel = ({ ownerType, ownerId }: { ownerType: 'customer' | 'loan' | 'application' | 'collateral'; ownerId: number }) => {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CreditDocument[]>([]);
  const [docType, setDocType] = useState('ID_CARD');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getApi(`/credit/document?owner_type=${ownerType}&owner_id=${ownerId}`);
      setRows(res.data?.data ?? []);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  }, [ownerType, ownerId]);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const body = new FormData();
    body.append('owner_type', ownerType);
    body.append('owner_id', String(ownerId));
    body.append('doc_type', docType);
    if (title.trim()) body.append('title', title.trim());
    Array.from(files).slice(0, 5).forEach((f) => body.append('files', f));
    try {
      setBusy(true);
      await postApi('/credit/document', body);
      Notific.success('saveSuccessDone');
      setTitle('');
      load();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = (d: CreditDocument) => Notific.confirm(`${t('crDocDeleteConfirm')} ${d.title ?? d.file_name ?? ''}`, async () => {
    try {
      await deleteApi(`/credit/document/${d._uuid}`);
      Notific.success('acsDeleted');
      load();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  return (
    <div className="cr-docs">
      {(canCreate || canEdit) && (
        <div className="cr-docs-upload">
          <SelectPicker data={DOC_TYPES.map((d) => ({ value: d.value, label: t(d.label) }))} value={docType} onChange={(v) => v && setDocType(v)}
            cleanable={false} searchable={false} block popupClassName="acc-book-menu" aria-label={t('crDocType')}
          />
          <Input value={title} onChange={setTitle} placeholder={t('crDocTitlePlaceholder')} />
          <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => upload(e.target.files)} />
          <button type="button" className="acc-rp-btn is-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} /> {t('crDocUpload')}
          </button>
        </div>
      )}
      {!rows.length ? (
        <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-folder-open" /><p>{t('crNoDocs')}</p></div>
      ) : (
        <div className="cr-doc-list">
          {rows.map((d) => {
            const type = DOC_TYPES.find((x) => x.value === d.doc_type);
            return (
              <article key={d._uuid} className="cr-doc">
                <i className={`fa-solid ${fileIcon(d.mime)}`} />
                <div>
                  <b>{d.title ?? d.file_name}</b>
                  <small>{[type ? t(type.label) : null, sizeText(d.size), moment(d.createdAt).format('DD/MM/YYYY'), d.by].filter(Boolean).join(' · ')}</small>
                </div>
                <span className="acc-fa-actions">
                  <button type="button" title={t('crDocDownload')} aria-label={t('crDocDownload')} onClick={() => downloadWithAuth(`/credit/document/download/${d._uuid}`, d.file_name ?? 'document')}>
                    <i className="fa-solid fa-download" />
                  </button>
                  {canDelete && (
                    <button type="button" className="is-danger" title={t('delete')} aria-label={t('delete')} onClick={() => remove(d)}><i className="fa-solid fa-trash" /></button>
                  )}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
