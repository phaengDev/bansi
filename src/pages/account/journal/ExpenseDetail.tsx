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
import { expenseDateOf, type Expense } from './ExpenseForm';
import { RECEIPT_PRINT_CSS, TRANSFER, blobErrorMessage, formatQty, saveBlob } from './journalKit';
import { CustomerLabel } from './CustomerField';

const ACTIVE = 1;

/**
 * ລາຍລະອຽດລາຍຈ່າຍ (Drawer ຂວາ) — ໃບຈ່າຍເງິນ (ຫົວ + ຕາຕະລາງລາຍການຍ່ອຍ + ລວມ/ອາກອນ/ຍອດຈ່າຍ) ທີ່ພິມ ຫຼື
 * ດາວໂຫຼດເປັນຮູບໄດ້ + ໃບບິນຄັດຕິດ (ເບິ່ງ / ດາວໂຫຼດ). ແບບດຽວກັບ IncomeDetail; ແກ້ໄຂ ຫຼື ຍົກເລີກ ໄດ້ຈາກນີ້
 */
const ExpenseDetail = ({ expense, onClose, onEdit, onCancel }: {
  expense: Expense;
  onClose: () => void;
  /** ບໍ່ສົ່ງ = ເບິ່ງຢ່າງດຽວ (ເຊັ່ນ ເປີດຈາກໜ້າລາຍງານ) — ບໍ່ມີປຸ່ມແກ້ໄຂ / ຍົກເລີກ */
  onEdit?: () => void;
  onCancel?: () => void;
}) => {
  const t = useT();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [makingImage, setMakingImage] = useState(false);
  const active = Number(expense.status) === ACTIVE;
  const acc = expense.acount;
  const cur = acc?.treasury?.currency;
  const symbol = currencySymbol(cur);
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();
  const isTransfer = Number(expense.pay_type) === TRANSFER;
  const isPdf = /\.pdf$/i.test(expense.file_doct ?? '');
  const created = moment(expense.createdAt);
  const updated = expense.updatedAt ? moment(expense.updatedAt) : null;
  const wasEdited = updated && Math.abs(updated.diff(created, 'minutes')) >= 1;
  const items = expense.items ?? [];

  /** ໃບບິນຄັດຕິດ — ດຶງຜ່ານ API (GET /expense/download/:id) ເປັນ blob ແລ້ວບັນທຶກທັນທີ ຊື່ = ເລກທີ.ນາມສະກຸນ */
  const download = async () => {
    try {
      setDownloading(true);
      const res = await getApi(`/expense/download/${btoa(String(expense._uuid))}`, { responseType: 'blob' });
      const ext = (expense.file_doct ?? '').match(/\.[^.]+$/)?.[0] ?? '';
      saveBlob(res.data as Blob, `${expense.number}${ext}`);
    } catch (error) {
      console.error(error);
      Notific.error(await blobErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  /** ໃບຈ່າຍເງິນເປັນຮູບ PNG — ຖ່າຍສະເພາະບັດ (ພື້ນໂປ່ງໃສ, scale 2); ໂລໂກ້ທະນາຄານຢູ່ຄົນລະໂດເມນ ຈຶ່ງໃຊ້ useCORS */
  const downloadImage = async () => {
    const el = receiptRef.current;
    if (!el) return;
    try {
      setMakingImage(true);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('image');
      saveBlob(blob, `${expense.number}.png`);
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
    <Drawer open onClose={onClose} size="sm" placement="right" className="acc-stmt-drawer acc-inv-drawer is-expense">
      <Drawer.Header>
        <div className="acc-stmt-head">
          <span className="acc-inv-head-icon"><i className="fa-solid fa-file-invoice-dollar" /></span>
          <span className="acc-stmt-title">
            <Drawer.Title>{t('expenseDetail')}</Drawer.Title>
            <small>{expense.number}</small>
          </span>
        </div>
      </Drawer.Header>

      <Drawer.Body className="acc-inv-body">
        {/* ---- ໃບຈ່າຍເງິນ (ສ່ວນທີ່ພິມ) ---- */}
        <div ref={receiptRef} className={`acc-inv-receipt is-expense${active ? '' : ' is-cancelled'}`}>
          <header className="acc-inv-top">
            <span>
              <small>{t('expenseVoucher')}</small>
              <b>{expense.number}</b>
            </span>
            <span className="acc-inv-date">
              <small>{t('expenseDate')}</small>
              <b>{expenseDateOf(expense).format('DD/MM/YYYY')}</b>
            </span>
          </header>

          <div className="acc-inv-amount">
            <small>{t('expenseTotal')}</small>
            <b>−{money(Number(expense.balance_expense) || 0)}</b>
            <span>
              {t('expenseSubtotal')} {money(Number(expense.subtotal) || 0)}
              {' · '}
              {t('incomeTaxField')} {money(Number(expense.tax) || 0)}
            </span>
            {!active && <em className="acc-inv-stamp">{t('incomeCancelled')}</em>}
          </div>

          <dl className="acc-inv-list">
            <div>
              <dt>{t('expenseTitle')}</dt>
              <dd><b>{expense.expense_title}</b></dd>
            </div>
            <div>
              <dt>{t('expenseCategory')}</dt>
              <dd>
                {expense.typeout
                  ? <span className="acc-jr-cat">{expense.typeout.type_code} · {expense.typeout.type_name}</span>
                  : '—'}
              </dd>
            </div>
            {(expense.partner || expense.payee_name) && (
              <div>
                <dt>{t('expenseParty')}</dt>
                <dd><CustomerLabel partner={expense.partner} name={expense.payee_name} /></dd>
              </div>
            )}
            {expense.bill_no && (
              <div>
                <dt>{t('expenseBillNo')}</dt>
                <dd>{expense.bill_no}</dd>
              </div>
            )}
          </dl>

          {/* ລາຍການຍ່ອຍ */}
          <table className="acc-inv-items">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('expenseItemName')}</th>
                <th>{t('expenseQty')}</th>
                <th>{t('expenseUnitPrice')}</th>
                <th>{t('expenseLineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item._uuid}>
                  <td>{index + 1}</td>
                  <td>
                    {item.item_name}
                    {item.discount > 0 && <small>{t('expenseDiscount')} −{formatNumber(item.discount)}</small>}
                  </td>
                  <td>{formatQty(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</td>
                  <td>{formatNumber(item.unit_price)}</td>
                  <td>{formatNumber(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{t('expenseSubtotal')}</td>
                <td>{formatNumber(Number(expense.subtotal) || 0)}</td>
              </tr>
              {Number(expense.tax) > 0 && (
                <tr>
                  <td colSpan={4}>{t('incomeTaxField')}</td>
                  <td>{formatNumber(Number(expense.tax) || 0)}</td>
                </tr>
              )}
              <tr className="is-total">
                <td colSpan={4}>{t('expenseTotal')}</td>
                <td>{money(Number(expense.balance_expense) || 0)}</td>
              </tr>
            </tfoot>
          </table>

          <dl className="acc-inv-list">
            <div>
              <dt>{t('expensePayFrom')}</dt>
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
              <dt>{t('expensePayMethod')}</dt>
              <dd>
                <span className={`acc-jr-method${isTransfer ? ' is-transfer' : ''}`}>
                  <i className={`fa-solid ${isTransfer ? 'fa-building-columns' : 'fa-money-bill-wave'}`} />
                  {t(isTransfer ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}
                </span>
              </dd>
            </div>
            {isTransfer && (expense.payeeBank || expense.payee_account_number) && (
              <div>
                <dt>{t('expenseTo')}</dt>
                <dd>
                  <span className="acc-inv-account">
                    <span className="acc-xfer-logo">
                      {expense.payeeBank?.url ? <img src={expense.payeeBank.url} alt="" /> : <i className="fa-solid fa-building-columns" />}
                    </span>
                    <span className="acc-xfer-opt-text">
                      <b>{expense.payee_name || expense.payeeBank?.name_la || '—'}</b>
                      <small>{[expense.payeeBank?.abbr, expense.payee_account_number].filter(Boolean).join(' · ')}</small>
                    </span>
                  </span>
                </dd>
              </div>
            )}
            {expense.description && (
              <div>
                <dt>{t('expenseNote')}</dt>
                <dd className="acc-inv-desc">{expense.description}</dd>
              </div>
            )}
            <div>
              <dt>{t('incomeRecordedBy')}</dt>
              <dd>{expense.user?.user_name ?? '—'}</dd>
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

        {/* ---- ໃບບິນຄັດຕິດ (ບໍ່ພິມ) ---- */}
        <section className="acc-inv-file">
          <h5><i className="fa-solid fa-paperclip" /> {t('expenseStepFile')}</h5>
          {expense.file_url ? (
            <div className="acc-inv-file-card">
              {isPdf ? (
                <a className="acc-inv-file-pdf" href={expense.file_url} target="_blank" rel="noreferrer">
                  <i className="fa-solid fa-file-pdf" />
                  <span>{expense.file_doct}</span>
                </a>
              ) : (
                <a className="acc-inv-file-img" href={expense.file_url} target="_blank" rel="noreferrer" title={t('incomeFileView')}>
                  <img src={expense.file_url} alt={expense.expense_title} />
                </a>
              )}
              <div className="acc-inv-file-actions">
                <a className="acc-inv-btn" href={expense.file_url} target="_blank" rel="noreferrer">
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

        {/* ປຸ່ມຄຳສັ່ງ — ຕິດລຸ່ມຂອງ body */}
        <div className="acc-inv-footer">
          {active && onCancel && (
            <Button appearance="default" className="acc-inv-btn is-danger" disabled={!canDelete} onClick={onCancel}>
              <i className="fa-solid fa-ban" /> {t('expenseCancel')}
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

export default ExpenseDetail;
