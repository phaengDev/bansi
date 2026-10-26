import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Textarea } from 'rsuite';
import { deleteApi, formatDateTime, getApi, postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { ListState, SettingModal, SettingToolbar } from '../account/setting/settingKit';
import { fileSizeText } from './hrApi';

/** ແຖວຂອງ GET /app-release/fetch */
type AppRelease = {
  _uuid: number;
  version_name: string | null;
  build_number: number;
  file_size: number;
  notes: string | null;
  url: string;
  createdAt: string;
  createdby_name?: string | null;
};

/** Cloudflare (ທາງເຂົ້າ api-bansi) ຮັບໄຟລ໌ບໍ່ເກີນ 100MB */
const MAX_APK = 100 * 1024 * 1024;

const versionOf = (r: Pick<AppRelease, 'version_name' | 'build_number'>) => `${r.version_name ?? '—'} (${r.build_number})`;

/** ອັບໂຫຼດ APK — ເລກ build / ເວີຊັນ backend ອ່ານຈາກໄຟລ໌ເອງ; ໄຟລ໌ໃຫຍ່ ສະແດງ % ລະຫວ່າງສົ່ງ */
const UploadForm = ({ latest, onClose, onSaved }: { latest: AppRelease | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!picked) return;
    if (!/\.apk$/i.test(picked.name)) return Notific.warning('hrAppPickApk');
    if (picked.size > MAX_APK) return Notific.warning('hrAppTooLarge');
    setFile(picked);
  };

  const submit = async () => {
    if (!file) return Notific.warning('hrAppPickApk');
    const body = new FormData();
    body.append('notes', notes.trim());
    body.append('apk', file);
    try {
      setProgress(0);
      const res = await postApi('/app-release/create', body, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      Notific.success(res.data?.message ?? 'saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
      setProgress(null);
    }
  };

  const uploading = progress !== null;

  return (
    <SettingModal
      title={t('hrAppUpload')} hint={t('hrAppUploadHint')} icon="fa-cloud-arrow-up" saving={uploading}
      onClose={() => !uploading && onClose()} onSubmit={submit} submit={{ label: t('hrAppUploadSubmit'), icon: 'fa-upload' }}
      className="hr-app-modal"
    >
      <div className="hr-app-form">
        <div className="acc-jr-file">
          {file ? (
            <div className="acc-jr-file-card">
              <span className="acc-jr-file-thumb"><i className="fa-brands fa-android" /></span>
              <span className="acc-jr-file-name">
                <b>{file.name}</b>
                <small>{fileSizeText(file.size)}</small>
              </span>
              {!uploading && (
                <button type="button" className="acc-jr-file-remove" onClick={() => setFile(null)} aria-label={t('delete')} title={t('delete')}>
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>
          ) : (
            <label className="acs-logo-pick">
              <span className="acs-logo-preview"><i className="fa-brands fa-android" /></span>
              <span className="acs-logo-text">
                <b><i className="fa-solid fa-upload" /> {t('hrAppPick')}</b>
                <small>app-release.apk · ≤ 100MB</small>
              </span>
              <input type="file" accept=".apk,application/vnd.android.package-archive" hidden onChange={pick} />
            </label>
          )}
          {latest && (
            <small className="hr-app-latest">
              <i className="fa-solid fa-circle-info" /> {t('hrAppLatestNow')} <b>{versionOf(latest)}</b> — {t('hrAppBuildHigher')}
            </small>
          )}
        </div>

        <label className="hr-app-notes">
          <span>{t('hrAppNotes')}</span>
          <Textarea value={notes} onChange={setNotes} rows={3} maxLength={1000} placeholder={t('hrAppNotesPlaceholder')} disabled={uploading} />
        </label>

        {uploading && (
          <div className="hr-app-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
            <small>{progress < 100 ? `${t('hrAppUploading')} ${progress}%` : t('hrAppChecking')}</small>
          </div>
        )}
      </div>
    </SettingModal>
  );
};

/**
 * ອັບເດດແອັບພະນັກງານ (Android) — ອັບໂຫຼດ app-release.apk ບ່ອນດຽວ ແທນການສົ່ງໄຟລ໌ໃຫ້ທຸກຄົນ: ແອັບກວດລຸ້ນລ່າສຸດຕອນເປີດ,
 * ເລກ build ສູງກວ່າຂອງເຄື່ອງ = ຂຶ້ນແຖບ "ມີເວີຊັນໃໝ່" ໃຫ້ກົດອັບເດດເອງ; ອັບເດດແລ້ວແຖບຫາຍເອງ.
 * ເກັບໄວ້ລຸ້ນດຽວ: ອັບໂຫຼດລຸ້ນໃໝ່ = ລຸ້ນເກົ່າຖືກລຶບອອກເອງ (ບໍ່ໃຫ້ເຊີບເວີໜັກ); ລຶບລຸ້ນນີ້ = ແອັບບໍ່ເຫັນແຖບອັບເດດຈົນອັບໂຫຼດໃໝ່
 */
const AppReleasePage = () => {
  const t = useT();
  const [rows, setRows] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/app-release/fetch');
      setRows(res.data?.data ?? []);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const remove = (row: AppRelease) => {
    Notific.confirm(`${t('hrAppDeleteConfirm')} ${versionOf(row)}`, async () => {
      try {
        await deleteApi(`/app-release/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
      } catch (error) {
        Notific.error(getErrorMessage(error));
      } finally {
        reload();
      }
    });
  };

  return (
    <div className="acs-page">
      <SettingToolbar stats={[{ label: t('hrAppVersions'), value: rows.length }]} addLabel={t('hrAppUpload')} onAdd={() => setAdding(true)} canAdd={canCreate} />
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('hrAppNote')} — {t('hrAppKeepOne')}</p>

      <ListState loading={loading} empty={!rows.length} icon="fa-mobile-screen-button">
        <div className="hr-apps">
          {rows.map((row, index) => (
            <article key={row._uuid} className={`hr-app${index === 0 ? ' is-latest' : ''}`}>
              <span className="hr-app-icon"><i className="fa-brands fa-android" /></span>
              <span className="hr-app-text">
                <b>
                  {t('hrAppVersion')} {versionOf(row)}
                  {index === 0 && <em className="hr-app-badge"><i className="fa-solid fa-circle-check" /> {t('hrAppCurrent')}</em>}
                </b>
                <small>
                  {formatDateTime(row.createdAt)} · {fileSizeText(row.file_size)}
                  {row.createdby_name ? ` · ${row.createdby_name}` : ''}
                </small>
                {row.notes && <p>{row.notes}</p>}
              </span>
              <span className="hr-app-actions">
                <a className="acc-gl-act" href={row.url} download title={t('hrAppDownload')}>
                  <i className="fa-solid fa-download" />
                </a>
                <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')} onClick={() => remove(row)}>
                  <i className="fa-solid fa-trash" />
                </button>
              </span>
            </article>
          ))}
        </div>
      </ListState>

      {adding && <UploadForm latest={rows[0] ?? null} onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  );
};

export default AppReleasePage;
