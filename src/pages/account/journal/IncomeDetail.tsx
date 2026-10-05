import { useRef, useState } from 'react';
import { Button, Drawer } from 'rsuite';
import moment from 'moment';
import html2canvas from 'html2canvas';
import { formatNumber, getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { printElementByFrame } from '../../../utils/Print';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { currencySymbol } from '../ledger/currency';
import { TRANSFER, incomeDateOf, type Income } from './IncomeForm';
import { RECEIPT_PRINT_CSS, blobErrorMessage, saveBlob } from './journalKit';
import { CustomerLabel } from './CustomerField';

const ACTIVE = 1;

/**
 * ລາຍລະອຽດລາຍຮັບ (Drawer ຂວາ) — ໃບຮັບເງິນທີ່ພິມ / ບັນທຶກ PDF ໄດ້ + ໄຟລ໌ຄັດຕິດ (ເບິ່ງ / ດາວໂຫຼດ).
 * ຈາກນີ້ໄປ ແກ້ໄຂ ຫຼື ຍົກເລີກ ໄດ້ຄືປຸ່ມໃນລາຍການ
 */
const IncomeDetail = ({ income, onClose, onEdit, onCancel }: {
  income: Income;
  onClose: () => void;
  /** ບໍ່ສົ່ງ = ເບິ່ງຢ່າງດຽວ (ເຊັ່ນ ເປີດຈາກໜ້າລາຍງານ) — ບໍ່ມີປຸ່ມແກ້ໄຂ / ຍົກເລີກ */
  onEdit?: () => void;
  onCancel?: () => void;
}) => {
  const t = useT();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [makingImage, setMakingImage] = useState(false);
  const active = Number(income.status) === ACTIVE;
  const acc = income.acount;
  const cur = acc?.treasury?.currency;
  const symbol = currencySymbol(cur);
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();
  const isTransfer = Number(income.receive_type) === TRANSFER;
  const isPdf = /\.pdf$/i.test(income.file_doct ?? '');
  const created = moment(income.createdAt);
  const updated = income.updatedAt ? moment(income.updatedAt) : null;
  const wasEdited = updated && Math.abs(updated.diff(created, 'minutes')) >= 1;

  /** ໄຟລ໌ຄັດຕິດ — ດຶງຜ່ານ API (GET /income/download/:id) ເປັນ blob ແລ້ວບັນທຶກທັນທີ ຊື່ = ເລກທີ.ນາມສະກຸນ */
  const download = async () => {
    try {
      setDownloading(true);
      const res = await getApi(`/income/download/${btoa(String(income._uuid))}`, { responseType: 'blob' });
      const ext = (income.file_doct ?? '').match(/\.[^.]+$/)?.[0] ?? '';
      saveBlob(res.data as Blob, `${income.number}${ext}`);
    } catch (error) {
      console.error(error);
      Notific.error(await blobErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  /**
   * ໃບຮັບເງິນເປັນຮູບ PNG ດາວໂຫຼດທັນທີ — ຖ່າຍສະເພາະບັດໃບຮັບເງິນ (html2canvas, ຕົວອັກສອນລາວຄົບ),
   * ພື້ນຫຼັງໂປ່ງໃສ ມຸມມົນຂອງບັດຈຶ່ງບໍ່ມີຂອບຂາວ; scale 2 ໃຫ້ຮູບຄົມ. ໂລໂກ້ທະນາຄານຢູ່ຄົນລະໂດເມນ ຈຶ່ງໃຊ້ useCORS
   */
  const downloadImage = async () => {
    const el = receiptRef.current;
    if (!el) return;
    try {
      setMakingImage(true);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('image');
      saveBlob(blob, `${income.number}.png`);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setMakingImage(false);
    }
  };

  const print = () => {
    if (receiptRef.current) printElementByFrame(receiptRef.current, RECEIPT_PRINT_CSS);
  };

  return (
    <Drawer open onClose={onClose} size="sm" placement="right" className="acc-stmt-drawer acc-inv-drawer">
      <Drawer.Header>
        <div className="acc-stmt-head">
          <span className="acc-inv-head-icon"><i className="fa-solid fa-receipt" /></span>
          <span className="acc-stmt-title">
            <Drawer.Title>{t('incomeDetail')}</Drawer.Title>
            <small>{income.number}</small>
          </span>
        </div>
      </Drawer.Header>

      <Drawer.Body className="acc-inv-body">
        {/* ---- ໃບຮັບເງິນ (ສ່ວນທີ່ພິມ) ---- */}
        <div ref={receiptRef} className={`acc-inv-receipt${active ? '' : ' is-cancelled'}`}>
          <header className="acc-inv-top">
            <span>
              <small>{t('incomeReceipt')}</small>
              <b>{income.number}</b>
            </span>
            <span className="acc-inv-date">
              <small>{t('incomeDate')}</small>
              <b>{incomeDateOf(income).format('DD/MM/YYYY')}</b>
            </span>
          </header>

          <div className="acc-inv-amount">
            <small>{t('incomeTotal')}</small>
            <b>+{money(Number(income.balance_income) || 0)}</b>
            <span>
              {t('incomeAmount')} {money(Number(income.balances) || 0)}
              {' · '}
              {t('incomeTaxField')} {money(Number(income.tax) || 0)}
            </span>
            {!active && <em className="acc-inv-stamp">{t('incomeCancelled')}</em>}
          </div>

          <dl className="acc-inv-list">
            <div>
              <dt>{t('incomeTitle')}</dt>
              <dd><b>{income.incom_title}</b></dd>
            </div>
            <div>
              <dt>{t('incomeCategory')}</dt>
              <dd>
                {income.typein
                  ? <span className="acc-jr-cat">{income.typein.type_code} · {income.typein.type_name}</span>
                  : '—'}
              </dd>
            </div>
            {income.description && (
              <div>
                <dt>{t('detail')}</dt>
                <dd className="acc-inv-desc">{income.description}</dd>
              </div>
            )}
            <div>
              <dt>{t('incomeAccount')}</dt>
              <dd>
                <span className="acc-inv-account">
                  <span className="acc-xfer-logo">
                    {acc?.banks?.url ? <img src={acc.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                  </span>
                  <span className="acc-xfer-opt-text">
                    <b>{acc?.acountName ?? '—'}</b>
                    <small>{[acc?.banks?.abbr ?? t('treasuryNoBank'), acc?.acount_number].filter(Boolean).join(' · ')}</small>
                  </span>
                  {cur?.name && <em className="acc-xfer-cur">{symbol !== cur.name ? `${symbol} ` : ''}{cur.name}</em>}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t('incomeReceiveMethod')}</dt>
              <dd>
                <span className={`acc-jr-method${isTransfer ? ' is-transfer' : ''}`}>
                  <i className={`fa-solid ${isTransfer ? 'fa-building-columns' : 'fa-money-bill-wave'}`} />
                  {t(isTransfer ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}
                </span>
              </dd>
            </div>
            {(income.partner || income.payer_name) && (
              <div>
                <dt>{t('incomeCustomer')}</dt>
                <dd><CustomerLabel partner={income.partner} name={income.payer_name} /></dd>
              </div>
            )}
            {isTransfer && (income.payerBank || income.payer_account_name || income.payer_account_number) && (
              <div>
                <dt>{t('incomeTransferFrom')}</dt>
                <dd>
                  <span className="acc-inv-account">
                    <span className="acc-xfer-logo">
                      {income.payerBank?.url ? <img src={income.payerBank.url} alt="" /> : <i className="fa-solid fa-building-columns" />}
                    </span>
                    <span className="acc-xfer-opt-text">
                      <b>{income.payer_account_name || income.payerBank?.name_la || '—'}</b>
                      <small>{[income.payerBank?.abbr, income.payer_account_number].filter(Boolean).join(' · ')}</small>
                    </span>
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>{t('incomeRecordedBy')}</dt>
              <dd>{income.user?.user_name ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('incomeRecordedAt')}</dt>
              <dd>{created.format('DD/MM/YYYY HH:mm')}</dd>
            </div>
            {wasEdited && (
              <div>
                <dt>{t('incomeUpdatedAt')}</dt>
                <dd>{updated!.format('DD/MM/YYYY HH:mm')}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* ---- ໄຟລ໌ຄັດຕິດ (ບໍ່ພິມ) ---- */}
        <section className="acc-inv-file">
          <h5><i className="fa-solid fa-paperclip" /> {t('incomeStepFile')}</h5>
          {income.file_url ? (
            <div className="acc-inv-file-card">
              {isPdf ? (
                <a className="acc-inv-file-pdf" href={income.file_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-file-pdf" />
                  <span>{income.file_doct}</span>
                </a>
              ) : (
                <a className="acc-inv-file-img" href={income.file_url} target="_blank" rel="noreferrer" title={t('incomeFileView')}>
                  <img src={income.file_url} alt={income.incom_title} />
                </a>
              )}
              <div className="acc-inv-file-actions">
                <a className="acc-inv-btn" href={income.file_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-up-right-from-square" /> {t('incomeFileView')}
                </a>
                <button type="button" className="acc-inv-btn is-primary" onClick={download} disabled={downloading}>
                  <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-download'}`} /> {t('incomeFileDownload')}
                </button>
              </div>
            </div>
          ) : (
            <p className="acc-inv-file-empty">{t('incomeNoFile')}</p>
          )}
        </section>

        {/* ປຸ່ມຄຳສັ່ງ — ຕິດລຸ່ມຂອງ body (Drawer.Footer ຂອງ rsuite v6 ເລີກໃຊ້ແລ້ວ ແລະ body ບໍ່ເວັ້ນບ່ອນໃຫ້) */}
        <div className="acc-inv-footer">
          {active && onCancel && (
            <Button appearance="default" className="acc-inv-btn is-danger" disabled={!canDelete} onClick={onCancel}>
              <i className="fa-solid fa-ban" /> {t('incomeCancel')}
            </Button>
          )}
          <span className="acc-inv-spacer" />
          {active && onEdit && (
            <Button appearance="default" className="acc-inv-btn" disabled={!canEdit} onClick={onEdit}>
              <i className="fa-solid fa-pen" /> {t('edit')}
            </Button>
          )}
          <Button appearance="default" className="acc-inv-btn" onClick={print} title={t('incomePrintOnly')}>
            <i className="fa-solid fa-print" /> {t('incomePrintOnly')}
          </Button>
          <Button appearance="primary" className="acc-inv-btn is-primary" onClick={downloadImage} disabled={makingImage}>
            <i className={`fa-solid ${makingImage ? 'fa-spinner fa-spin' : 'fa-image'}`} /> {t('incomeDownloadImage')}
          </Button>
        </div>
      </Drawer.Body>
    </Drawer>
  );
};

export default IncomeDetail;
