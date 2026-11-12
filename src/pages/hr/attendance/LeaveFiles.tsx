import { useEffect, useState } from 'react';
import { getApi } from '../../../utils/configApi';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { fileSizeText } from '../hrApi';

/** ໃບລາທີ່ພະນັກງານແນບໃນ app (ສະແກນ / ຖ່າຍຮູບ / PDF) — GET /leave/file/download/:id (ສິດດຽວກັບໜ້າຄຳຂໍລາພັກ) */
export type LeaveFile = { _uuid: number; original_name: string; mime_type: string | null; file_size: number };

const isPdf = (file: LeaveFile) => /pdf/i.test(file.mime_type || file.original_name);

const blobOf = async (file: LeaveFile) =>
  (await getApi(`/leave/file/download/${btoa(String(file._uuid))}`, { responseType: 'blob' })).data as Blob;

/**
 * ເປີດໃບລາໃນແຖບໃໝ່ (ຮູບ / PDF ເບິ່ງໃນ browser ເລີຍ) — ເປີດແຖບຕອນກົດກ່ອນ ບໍ່ໃຫ້ browser ບັອກ popup,
 * ໂຫຼດແລ້ວຈຶ່ງໃສ່ໄຟລ໌; ບັອກແທ້ = ດາວໂຫຼດແທນ
 */
const openLeaveFile = async (file: LeaveFile) => {
  const tab = window.open('', '_blank');
  try {
    const href = URL.createObjectURL(await blobOf(file));
    if (tab) {
      tab.location.href = href;
    } else {
      const link = document.createElement('a');
      link.href = href;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    // ໃຫ້ແຖບໃໝ່ບັນທຶກ / ພິມ PDF ໄດ້ກ່ອນ
    setTimeout(() => URL.revokeObjectURL(href), 5 * 60_000);
  } catch (error) {
    console.error(error);
    tab?.close();
    Notific.error('hrDownloadFailed');
  }
};

/** ໃນຕາຕະລາງ: ປຸ່ມນ້ອຍຕໍ່ໄຟລ໌ (ໄອຄອນຮູບ / PDF) — ກົດ = ເປີດ */
export const LeaveFileChips = ({ files }: { files?: LeaveFile[] }) => {
  const t = useT();
  if (!files?.length) return null;
  return (
    <span className="lv-file-chips">
      {files.map((file, i) => (
        <button
          key={file._uuid}
          type="button"
          className="lv-file-chip"
          title={`${t('lvFiles')}: ${file.original_name}`}
          aria-label={`${t('lvFiles')} ${i + 1}: ${file.original_name}`}
          onClick={() => openLeaveFile(file)}
        >
          <i className={`fa-solid ${isPdf(file) ? 'fa-file-pdf' : 'fa-file-image'}`} />
          {files.length > 1 && <span>{i + 1}</span>}
        </button>
      ))}
    </span>
  );
};

/** ຮູບຫຍໍ້ຂອງໃບລາ (ຮູບ) — ໂຫຼດຜ່ານ token ເປັນ blob, ອອກຈາກໜ້າ = ຄືນໜ່ວຍຄວາມຈຳ */
const Thumb = ({ file }: { file: LeaveFile }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let href: string | null = null;
    let alive = true;
    blobOf(file)
      .then((blob) => {
        href = URL.createObjectURL(blob);
        if (alive) setSrc(href);
        else URL.revokeObjectURL(href);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (href) URL.revokeObjectURL(href);
    };
  }, [file]);
  if (src) return <img src={src} alt={file.original_name} />;
  return <i className={`fa-solid ${failed ? 'fa-image' : 'fa-spinner fa-spin'}`} />;
};

/** ໃນ modal ອະນຸມັດ: ຮູບຫຍໍ້ / ໄອຄອນ PDF ພ້ອມຊື່ ແລະ ຂະໜາດ — ກົດ = ເປີດເບິ່ງໃນແຖບໃໝ່ */
export const LeaveFileGallery = ({ files }: { files?: LeaveFile[] }) => {
  const t = useT();
  if (!files?.length) return null;
  return (
    <div className="lv-review-files">
      <small><i className="fa-solid fa-paperclip" /> {t('lvFiles')} ({files.length})</small>
      <div className="lv-file-grid">
        {files.map((file) => (
          <button key={file._uuid} type="button" className="lv-file-card" title={t('lvFileOpen')} onClick={() => openLeaveFile(file)}>
            <span className={`lv-file-face${isPdf(file) ? ' is-pdf' : ''}`}>
              {isPdf(file) ? <i className="fa-solid fa-file-pdf" /> : <Thumb file={file} />}
            </span>
            <b>{file.original_name}</b>
            <small>{fileSizeText(file.file_size)}</small>
          </button>
        ))}
      </div>
    </div>
  );
};
