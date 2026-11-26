import { useState } from 'react';
import { Button, Modal, Textarea } from 'rsuite';
import { formatNumber, postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { showDate } from '../account/loans/loanApi';
import type { CollectionRow } from './creditApi';

/** ເບີລາວ → ຮູບແບບສາກົນສຳລັບ WhatsApp: 020 5555 1111 / 2055551111 → 8562055551111 */
const intlPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  return digits.startsWith('856') ? digits : `856${digits}`;
};

/**
 * ແຈ້ງເຕືອນລູກຄ້າ (ຍັງບໍ່ມີຜູ້ໃຫ້ບໍລິການ SMS) — ຂໍ້ຄວາມສຳເລັດຮູບ (ກາຍກຳນົດ / ໃກ້ຮອດກຳນົດ) ແກ້ໄດ້,
 * ສົ່ງຜ່ານ WhatsApp ຫຼື SMS ຂອງໂທລະສັບ, ສຳເນົາ; ກົດສົ່ງ = ບັນທຶກປະຫວັດ (tbl_loan_notice) ເທື່ອດຽວ
 */
const ReminderModal = ({ row, onClose, onSent }: { row: CollectionRow; onClose: () => void; onSent: () => void }) => {
  const t = useT();
  const company = useCompany();
  const overdue = row.days_overdue > 0;
  const symbol = row.currency?.genus || '₭';
  const name = row.customer?.name ?? row.counterparty;
  const phone = row.customer?.phone ?? '';
  const contact = [company?.name_la, company?.phone1].filter(Boolean).join(' ');
  const draft = overdue
    ? t('crMsgOverdue').replace('{name}', name).replace('{code}', row.loan_code).replace('{d}', String(row.days_overdue))
      .replace('{amount}', `${symbol} ${formatNumber(row.overdue_amount + row.penalty_due)}`)
      .replace('{penalty}', row.penalty_due > 0 ? t('crMsgPenaltyPart').replace('{p}', formatNumber(row.penalty_due)) : '')
    : t('crMsgDue').replace('{name}', name).replace('{code}', row.loan_code).replace('{n}', String(row.next?.no ?? ''))
      .replace('{amount}', `${symbol} ${formatNumber(row.next?.amount ?? 0)}`).replace('{date}', showDate(row.next?.due_date));
  // ເບີຕິດຕໍ່ຂອງບໍລິສັດ (ຖ້າຕັ້ງໄວ້ໃນ ຂໍ້ມູນບໍລິສັດ)
  const full = contact ? `${draft}${t('crMsgContact').replace('{c}', contact)}` : draft;
  const [message, setMessage] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const text = message ?? full;

  const log = async () => {
    if (logged) return;
    try {
      await postApi('/credit/notice', { loan_id: row._uuid, installment_no: row.next?.no, notice_type: overdue ? 2 : 1, channel: 1, phone, message: text });
      setLogged(true);
      onSent();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  };
  const open = (url: string) => {
    window.open(url, '_blank', 'noopener');
    log();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      Notific.success('crCopied');
    } catch {
      Notific.error(t('crCopyFailed'));
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" className="cr-reminder">
      <Modal.Header>
        <Modal.Title><i className="fa-solid fa-bell" /> {t('crReminder')}</Modal.Title>
        <small>{row.loan_code} · {name} · {phone || t('crNoPhone')}</small>
      </Modal.Header>
      <Modal.Body>
        <p className="acc-gl-hint"><i className="fa-solid fa-circle-info" /> {t('crReminderHint')}</p>
        <Textarea rows={6} value={text} onChange={(v) => setMessage(v)} />
        {logged && <p className="cr-reminder-done"><i className="fa-solid fa-circle-check" /> {t('crReminderLogged')}</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={copy}><i className="fa-solid fa-copy" /> {t('crCopy')}</Button>
        <Button appearance="default" className="acc-book-btn" disabled={!phone} onClick={() => open(`sms:${phone}?body=${encodeURIComponent(text)}`)}>
          <i className="fa-solid fa-comment-sms" /> SMS
        </Button>
        <Button appearance="primary" className="acc-book-btn is-save" disabled={!phone} onClick={() => open(`https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(text)}`)}>
          <i className="fa-brands fa-whatsapp" /> WhatsApp
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReminderModal;
