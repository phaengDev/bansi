import { useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { deleteApi, formatNumber, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { CardAction, FormSection, ListState, SettingModal, SettingToolbar, StatusPill } from './settingKit';
import { runSave, useSettingList } from './settingApi';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import { currencySymbol } from '../ledger/currency';

type Bank = { _uuid: number; abbr?: string; name_la?: string; name_en?: string; logo?: string; url?: string; status: number };

/** ຂະໜາດສູງສຸດກົງກັບ multer ຂອງ api-bansi (createUpload: 5MB) */
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * ບ່ອນເລືອກໂລໂກ້ — ກົດຮູບ/ປຸ່ມເພື່ອເລືອກ ຫຼື ລາກໄຟລ໌ມາວາງ; ກວດຊະນິດ ແລະ ຂະໜາດກ່ອນ.
 * ໄຟລ໌ໃໝ່ຖືກອັບໂຫຼດຕອນບັນທຶກ — "ຍົກເລີກຮູບໃໝ່" ກັບໄປໃຊ້ໂລໂກ້ເດີມ (backend ບໍ່ແຕະໂລໂກ້ເມື່ອບໍ່ສົ່ງໄຟລ໌)
 */
const LogoPicker = ({ current, file, onPick, onUndo }: {
  current?: string;
  file: File | null;
  onPick: (file: File) => void;
  onUndo: () => void;
}) => {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? current;
  const choose = () => inputRef.current?.click();
  const accept = (next?: File) => {
    if (!next) return;
    if (!LOGO_TYPES.includes(next.type)) return setError(t('bankLogoInvalid'));
    if (next.size > LOGO_MAX_BYTES) return setError(t('bankLogoTooBig'));
    setError('');
    onPick(next);
  };

  return (
    <div className="is-wide rs-form-group">
      <label className="form-label">{t('bankLogo')}</label>
      <div
        className={`acs-logo-drop${dragging ? ' is-drag' : ''}${error ? ' is-error' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
      >
        <button type="button" className={`acs-logo-thumb${shown ? ' has-img' : ''}`} onClick={choose} aria-label={t('bankLogoPick')}>
          {shown ? <img src={shown} alt="" /> : <i className="fa-solid fa-building-columns" aria-hidden="true" />}
          <span className="acs-logo-thumb-badge" aria-hidden="true"><i className="fa-solid fa-camera" /></span>
        </button>

        <div className="acs-logo-body">
          <b>{t(file ? 'bankLogoNew' : shown ? 'bankLogoCurrent' : 'bankLogoDrop')}</b>
          <small>{t('bankLogoHint')}</small>
          <div className="acs-logo-actions">
            <button type="button" className="acs-logo-btn is-primary" onClick={choose}>
              <i className="fa-solid fa-upload" aria-hidden="true" /> {t(shown ? 'bankLogoChange' : 'bankLogoPick')}
            </button>
            {file && (
              <button type="button" className="acs-logo-btn" onClick={() => { setError(''); onUndo(); }}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true" /> {t('bankLogoUndo')}
              </button>
            )}
          </div>
          {file && (
            <span className="acs-logo-file">
              <i className="fa-regular fa-file-image" aria-hidden="true" /> <span>{file.name}</span> · {fileSize(file.size)}
            </span>
          )}
          {error && (
            <span className="acs-logo-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {error}
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={LOGO_TYPES.join(',')}
          hidden
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = ''; // ເລືອກໄຟລ໌ເດີມຊ້ຳໄດ້
          }}
        />
      </div>
    </div>
  );
};

const BankForm = ({ data, onClose, onSaved }: { data: Bank | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({
    abbr: data?.abbr ?? '',
    name_la: data?.name_la ?? '',
    name_en: data?.name_en ?? '',
  });
  const model = createModel<any>({
    abbr: requiredField(t('inputRequired'), 'string'),
    name_la: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    // multipart — backend (bankController) ຮັບໄຟລ໌ຢູ່ field "logo"
    const body = new FormData();
    body.append('abbr', String(inputs.abbr).trim().toUpperCase());
    body.append('name_la', inputs.name_la.trim());
    body.append('name_en', (inputs.name_en ?? '').trim());
    if (!data) body.append('status', '1');
    if (file) body.append('logo', file);
    const request = () => (data ? putApi(`/bank/${btoa(String(data._uuid))}`, body) : postApi('/bank/create', body));
    if (await runSave(request, setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'bankEdit' : 'bankAdd')} hint={t('bankHint')} icon="fa-building-columns" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(value) => setInputs(value as Record<string, string>)}>
        <FormSection title={t('acsInfo')}>
          <LogoPicker current={data?.url} file={file} onPick={setFile} onUndo={() => setFile(null)} />
          {/* ຕົວຫຍໍ້ (ສັ້ນ) ຄູ່ກັບຊື່ທະນາຄານ (ຍາວ) ຢູ່ແຖວດຽວກັນ */}
          <div className="is-wide acs-code-name">
            <InputField name="abbr" label={t('bankAbbr')} placeholder="BCEL" className="acc-book-upper" />
            <InputField name="name_la" label={t('bankName')} placeholder={t('bankNamePlaceholder')} />
          </div>
          <div className="is-wide">
            <InputField name="name_en" label={t('bankNameEn')} required={false} placeholder="Banque Pour Le Commerce Exterieur Lao" />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ບັນຊີທະນາຄານ — ລາຍຊື່ທະນາຄານທີ່ບໍລິສັດມີບັນຊີ (tbl_banks) ພ້ອມບັນຊີເງິນຄັງທີ່ເປີດໄວ້ກັບແຕ່ລະທະນາຄານ.
 * ທະນາຄານໃນນີ້ຄືລາຍການທີ່ຂຶ້ນໃຫ້ເລືອກຕອນເພີ່ມບັນຊີເງິນຄັງ; ລຶບໄດ້ສະເພາະທະນາຄານທີ່ບໍ່ມີບັນຊີໃຊ້
 */
const BankDirectoryPage = () => {
  const t = useT();
  const lf = useLangField();
  const { rows: banks, loading, reload } = useSettingList<Bank>('/bank/fetch?limit=1000');
  const { rows: accounts } = useSettingList<TreasuryAccount>('/treasury-account/fetch', 'post');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Bank | null | undefined>(undefined);

  const accountsOf = (bankId: number) => accounts.filter((a) => Number(a.bankId) === bankId);
  const q = keyword.trim().toLowerCase();
  const shown = banks.filter((b) => !q || `${b.abbr ?? ''} ${b.name_la ?? ''} ${b.name_en ?? ''}`.toLowerCase().includes(q));

  const remove = (bank: Bank) =>
    Notific.confirm('bankDeleteConfirm', async () => {
      try {
        await deleteApi(`/bank/${btoa(String(bank._uuid))}`);
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
          { label: t('bank'), value: banks.length },
          { label: t('bankAccounts'), value: accounts.filter((a) => a.bankId).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('bankAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-building-columns">
        <div className="acs-bank-grid">
          {shown.map((b) => {
            const list = accountsOf(b._uuid);
            const active = Number(b.status ?? 1) === 1;
            return (
              // ຫົວ = ໂລໂກ້ + ຊື່ + ຕົວຫຍໍ້; ລຸ່ມ = ບັນຊີເງິນຄັງທີ່ເປີດກັບທະນາຄານນີ້ (ຊື່, ເລກ, ຍອດ)
              <article key={b._uuid} className={`acs-bank${active ? '' : ' is-off'}`}>
                <header className="acs-bank-head">
                  <span className="acs-bank-logo">
                    {b.url ? <img src={b.url} alt={b.abbr} /> : <i className="fa-solid fa-building-columns" />}
                  </span>
                  <span className="acs-bank-name">
                    <b title={lf(b, 'name')}>{lf(b, 'name') || b.abbr}</b>
                    <span className="acs-bank-tags">
                      {b.abbr && <em className="acs-bank-abbr">{b.abbr}</em>}
                      <StatusPill active={active} />
                    </span>
                  </span>
                  <button type="button" className="acc-class-edit acs-bank-edit" disabled={!canEdit}
                    aria-label={t('edit')} title={t('edit')} onClick={() => setEditing(b)}
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                </header>

                <div className="acs-bank-accounts">
                  <span className="acs-bank-label">
                    <i className="fa-solid fa-vault" /> {t('bankOpenAccounts')}
                    <em className={list.length ? 'is-on' : ''}>{list.length}</em>
                  </span>
                  {list.length ? (
                    <ul>
                      {list.slice(0, 3).map((a) => {
                        const cur = a.treasury?.currency;
                        const balance = Number(a.balance_treasury ?? 0) + Number(a.balance_unable ?? 0);
                        return (
                          <li key={a._uuid} className={Number(a.status) === 1 ? '' : 'is-off'}>
                            <span className="acs-bank-acc">
                              <b title={a.acountName}>{a.acountName}</b>
                              <small>{a.acount_number || '—'}{cur ? ` · ${cur.name}` : ''}</small>
                            </span>
                            <span className={`acs-bank-balance${balance < 0 ? ' is-negative' : ''}`}>
                              <small>{currencySymbol(cur)}</small> {formatNumber(balance)}
                            </span>
                          </li>
                        );
                      })}
                      {list.length > 3 && <li className="is-more">+{list.length - 3} {t('bankAccounts')}</li>}
                    </ul>
                  ) : (
                    <p className="acs-bank-empty">{t('bankNoAccounts')}</p>
                  )}
                </div>

                {/* ລຶບໄດ້ສະເພາະທະນາຄານທີ່ບໍ່ມີບັນຊີໃຊ້ */}
                {!list.length && (
                  <footer className="acs-card-foot">
                    <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => remove(b)} />
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && <BankForm data={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
};

export default BankDirectoryPage;
