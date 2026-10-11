import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, Toggle } from 'rsuite';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import moment from 'moment';
import { getApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { printElementByFrame } from '../../utils/Print';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { saveBlob } from '../account/journal/journalKit';
import type { Company } from './hrApi';

/** GET/PUT /company/scan-qr — payload = ຂໍ້ຄວາມໃນ QR (BANSI-ATT:<token>) ທີ່ app ມືຖືສົ່ງໄປ POST /attendance/scan { qr } */
type ScanQr = { payload: string | null; require_qr: boolean; token_at: string | null };

/** ພິມໂປສເຕີ QR — A5 ໜ້າດຽວ */
const POSTER_PRINT_CSS = `
  @page { size: A5 portrait; margin: 10mm; }
  html, body { background: #fff !important; margin: 0; padding: 0; }
  .hr-qr-poster { margin: 0 auto; box-shadow: none !important; transform: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * QR ສະແກນເຂົ້າ-ອອກວຽກ (ສະເພາະຜູ້ມີສິດແກ້ໄຂ) — ໂປສເຕີ (ໂລໂກ້ + ຊື່ບໍລິສັດ + QR + ເວລາເຮັດວຽກ) ດາວໂຫຼດເປັນ PNG ຫຼື ພິມ
 * ໄປຕິດໄວ້ບໍລິສັດ. ສ້າງ QR ໃໝ່ = QR ທີ່ພິມໄວ້ກ່ອນໃຊ້ບໍ່ໄດ້ອີກ; ບັງຄັບ QR = ສະແກນດ້ວຍ GPS ຢ່າງດຽວບໍ່ໄດ້
 */
const CompanyScanQr = ({ company }: { company: Company }) => {
  const t = useT();
  const posterRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<ScanQr | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'load' | 'save' | 'image' | null>('load');

  const apply = (data: ScanQr) => {
    setQr(data);
    if (!data.payload) return setImage(null);
    QRCode.toDataURL(data.payload, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f2a3d', light: '#ffffff' } })
      .then(setImage)
      .catch(() => setImage(null));
  };

  const load = useCallback(async () => {
    try {
      setBusy('load');
      const res = await getApi('/company/scan-qr');
      apply(res.data.data);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (canEdit) load();
  }, [load]);

  const save = async (body: Record<string, unknown>, message: string) => {
    try {
      setBusy('save');
      const res = await putApi('/company/scan-qr', body);
      apply(res.data.data);
      Notific.success(message);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const regenerate = () => Notific.confirm('hrQrRegenerateConfirm', () => save({ regenerate: 1 }, 'hrQrRegenerated'));

  /** ໂປສເຕີເປັນ PNG (scale 3 ພໍພິມ) — ໂລໂກ້ຢູ່ຄົນລະໂດເມນ (api) ຈຶ່ງໃຊ້ useCORS */
  const downloadImage = async () => {
    const el = posterRef.current;
    if (!el) return;
    try {
      setBusy('image');
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('image');
      saveBlob(blob, `scan-qr_${moment().format('YYYY-MM-DD')}.png`);
    } catch (error) {
      console.error(error);
      Notific.error('hrQrImageFailed');
    } finally {
      setBusy(null);
    }
  };

  const print = () => {
    if (posterRef.current) printElementByFrame(posterRef.current, POSTER_PRINT_CSS);
  };

  return (
    <section className="acc-book-step hr-company-card">
      <header>
        <span className="hr-company-card-icon"><i className="fa-solid fa-qrcode" /></span>
        <span className="acc-book-step-title"><b>{t('hrQrTitle')}</b><small>{t('hrQrHint')}</small></span>
      </header>

      {!canEdit ? (
        <p className="acc-bg-note"><i className="fa-solid fa-lock" /> {t('hrQrNoPermission')}</p>
      ) : !qr ? (
        <div className="text-center py-4"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className="hr-qr">
          {/* ໂປສເຕີ — ອັນດຽວກັນກັບທີ່ດາວໂຫຼດ / ພິມ */}
          <div className="hr-qr-poster" ref={posterRef}>
            <div className="hr-qr-poster-head">
              {company.logo_url && <img src={company.logo_url} alt="" crossOrigin="anonymous" />}
              <span>
                <b>{company.name_la}</b>
                {company.name_en && <small>{company.name_en}</small>}
              </span>
            </div>
            <div className="hr-qr-poster-title">
              <b>{t('hrQrPosterTitle')}</b>
              <small>Scan to check in / check out</small>
            </div>
            <div className="hr-qr-poster-code">
              {image ? <img src={image} alt="QR" /> : <Loader size="md" />}
            </div>
            <div className="hr-qr-poster-foot">
              <span><i className="fa-solid fa-clock" /> {t('hrQrWorkHours')} {company.work_start} – {company.work_end}</span>
              <small>{t('hrQrPosterHint')}</small>
            </div>
          </div>

          <div className="hr-qr-side">
            <div className="hr-qr-actions">
              <button type="button" className="acc-rp-btn is-primary" disabled={!image || !!busy} onClick={downloadImage}>
                <i className={`fa-solid ${busy === 'image' ? 'fa-spinner fa-spin' : 'fa-download'}`} /> {t('hrQrDownload')}
              </button>
              <button type="button" className="acc-rp-btn" disabled={!image || !!busy} onClick={print}>
                <i className="fa-solid fa-print" /> {t('print')}
              </button>
            </div>

            <label className={`hr-qr-require${qr.require_qr ? ' is-on' : ''}`}>
              <Toggle checked={qr.require_qr} disabled={!!busy}
                onChange={(on) => save({ require_qr: on ? 1 : 0 }, on ? 'hrQrRequireOn' : 'hrQrRequireOff')}
              />
              <span>
                <b>{t('hrQrRequire')}</b>
                <small>{t(qr.require_qr ? 'hrQrRequireOnHint' : 'hrQrRequireOffHint')}</small>
              </span>
            </label>

            <ul className="hr-qr-notes">
              <li><i className="fa-solid fa-location-dot" /> {t('hrQrGpsNote')}</li>
              <li><i className="fa-solid fa-shield-halved" /> {t('hrQrSecretNote')}</li>
            </ul>

            <div className="hr-qr-regen">
              <small>
                <i className="fa-regular fa-clock" /> {t('hrQrCreatedAt')} {qr.token_at ? moment(qr.token_at).format('DD/MM/YYYY HH:mm') : '—'}
              </small>
              <button type="button" className="acc-rp-btn is-danger" disabled={!!busy} onClick={regenerate}>
                <i className={`fa-solid ${busy === 'save' ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> {t('hrQrRegenerate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CompanyScanQr;
