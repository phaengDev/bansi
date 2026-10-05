import { useEffect, useState } from 'react';
import { DateRangePicker, Loader, Modal } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { useLangField, useT } from '../../../context/LanguageContext';
import { defaultLedgerRange, groupOf, money, naturalOf, type ChartAccount } from './glApi';
import { AccountCode, SourceChip } from './glKit';

type LedgerLine = {
  _uuid: number;
  entry_number: string;
  entry_date: string;
  source_type: string;
  reference?: string | null;
  description?: string | null;
  line_description?: string | null;
  debit: number;
  credit: number;
  balance: number;
  reversal_of?: number | null;
  reversed_by?: number | null;
};

/**
 * ປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີດຽວ (ເນື້ອໃນ) — ຍອດຍົກມາ, ທຸກແຖວໃນຊ່ວງ ແລະ ຍອດສະສົມ (ຕາມຝັ່ງປົກກະຕິຂອງບັນຊີ).
 * ໃຊ້ທັງໃນ <AccountLedgerModal> (ກົດແຖວໃນ ຜັງບັນຊີ / ງົບທົດລອງ) ແລະ ໜ້າ ປຶ້ມບັນຊີໃຫຍ່ (GeneralLedgerPage)
 */
export const AccountLedgerView = ({ account, dates, onDates }: {
  account: ChartAccount;
  dates: [Date, Date];
  onDates: (dates: [Date, Date]) => void;
}) => {
  const t = useT();
  const lf = useLangField();
  const [data, setData] = useState<{ opening: number; closing: number; lines: LedgerLine[] } | null>(null);
  const [error, setError] = useState('');
  const side = Number(account.normal_side);
  const startKey = moment(dates[0]).format('YYYY-MM-DD');
  const endKey = moment(dates[1]).format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    postApi('/gl/ledger', { account_id: account._uuid, start_date: startKey, end_date: endKey })
      .then((res) => {
        if (!cancelled) setData({ opening: res.data?.opening ?? 0, closing: res.data?.closing ?? 0, lines: res.data?.data ?? [] });
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [account._uuid, startKey, endKey]);

  const totalDebit = data?.lines.reduce((n, l) => n + l.debit, 0) ?? 0;
  const totalCredit = data?.lines.reduce((n, l) => n + l.credit, 0) ?? 0;
  const startText = moment(dates[0]).format('DD/MM/YYYY');
  const endText = moment(dates[1]).format('DD/MM/YYYY');

  const exportRows = () => {
    if (!data) return;
    const col = { date: t('date'), no: t('glEntryNumber'), desc: t('detail'), dr: t('glDebit'), cr: t('glCredit'), bal: t('glBalance') };
    const row = (date: string, no: string, desc: string, dr: number | string, cr: number | string, bal: number) =>
      ({ [col.date]: date, [col.no]: no, [col.desc]: desc, [col.dr]: dr, [col.cr]: cr, [col.bal]: naturalOf(side, bal) });
    exportExcel([
      row(startText, '', t('glOpeningBalance'), '', '', data.opening),
      ...data.lines.map((l) => row(moment(l.entry_date).format('DD/MM/YYYY'), l.entry_number,
        l.line_description || l.description || '', l.debit || '', l.credit || '', l.balance)),
      row(endText, '', t('glClosingBalance'), totalDebit, totalCredit, data.closing),
    ], `ledger_${account.account_code}_${startKey}_${endKey}`,
    `${account.account_code} ${lf(account, 'name')} (${startText} – ${endText})`);
  };

  return (
    <>
      <div className="acc-gl-ledger-tools">
        <DateRangePicker format="dd/MM/yyyy" character=" – " cleanable={false} value={dates}
          onChange={(value) => value && onDates(value as [Date, Date])} placement="bottomStart"
        />
        <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!data?.lines.length}>
          <i className="fa-solid fa-file-excel" /> Excel
        </button>
      </div>

      {error ? (
        <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
      ) : !data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className="acc-rp-scroll">
          <table className="acc-gl-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('glEntryNumber')}</th>
                <th>{t('detail')}</th>
                <th className="is-num">{t('glDebit')}</th>
                <th className="is-num">{t('glCredit')}</th>
                <th className="is-num">{t('glBalance')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-opening">
                <td>{startText}</td>
                <td />
                <td>{t('glOpeningBalance')}</td>
                <td />
                <td />
                <td className="is-num">{money(naturalOf(side, data.opening))}</td>
              </tr>
              {data.lines.map((l) => (
                <tr key={l._uuid} className={l.reversal_of || l.reversed_by ? 'is-reversed' : ''}>
                  <td>{moment(l.entry_date).format('DD/MM/YYYY')}</td>
                  <td>
                    <b className="acc-gl-mono">{l.entry_number}</b>
                    <SourceChip type={l.source_type} />
                  </td>
                  <td>
                    {l.line_description || l.description}
                    {l.reference && <small className="acc-gl-ref">{l.reference}</small>}
                  </td>
                  <td className="is-num">{money(l.debit)}</td>
                  <td className="is-num">{money(l.credit)}</td>
                  <td className="is-num is-strong">{money(naturalOf(side, l.balance))}</td>
                </tr>
              ))}
              {!data.lines.length && (
                <tr className="is-empty"><td colSpan={6}>{t('rpEmpty')}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t('glClosingBalance')} · {endText}</td>
                <td className="is-num">{money(totalDebit)}</td>
                <td className="is-num">{money(totalCredit)}</td>
                <td className="is-num">{money(naturalOf(side, data.closing))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
};

/** ປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີດຽວ ແບບໜ້າຕ່າງ — ຄ່າຕັ້ງຕົ້ນ: ຕົ້ນປີ → ມື້ນີ້ */
const AccountLedgerModal = ({ account, range, onClose }: {
  account: ChartAccount;
  range?: [Date, Date];
  onClose: () => void;
}) => {
  const t = useT();
  const lf = useLangField();
  const [dates, setDates] = useState<[Date, Date]>(range ?? defaultLedgerRange);
  const side = Number(account.normal_side);
  const group = groupOf(account.account_group);

  return (
    <Modal open onClose={onClose} size="lg" className="acc-gl-ledger-modal">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <AccountCode code={account.account_code} group={account.account_group} />
          <span>
            <Modal.Title>{lf(account, 'name')}</Modal.Title>
            <small>{t(group.label)} · {t(side === 1 ? 'glSideDebit' : 'glSideCredit')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <AccountLedgerView account={account} dates={dates} onDates={setDates} />
      </Modal.Body>
    </Modal>
  );
};

export default AccountLedgerModal;
