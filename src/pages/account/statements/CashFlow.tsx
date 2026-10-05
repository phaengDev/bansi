import { formatNumber } from '../../../utils/configApi';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import type { Entry } from '../journal/reportData';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { accountFlows, acct, linesByCategory, type Line } from './statementData';

/**
 * ໃບລາຍງານກະແສເງິນສົດ (ວິທີກົງ) — ເງິນສົດ ແລະ ເງິນຝາກ ຕົ້ນງວດ + ເງິນຮັບ (ລາຍຮັບ ຕາມປະເພດ) − ເງິນຈ່າຍ (ລາຍຈ່າຍ ຕາມປະເພດ)
 * = ທ້າຍງວດ, ແລ້ວແຍກຕາມບັນຊີ (ຕົ້ນງວດ / ຮັບ / ຈ່າຍ / ໂອນເຂົ້າ / ໂອນອອກ / ທ້າຍງວດ). ຍອດເງິນແທ້ທີ່ເຂົ້າ-ອອກ (ລວມອາກອນ).
 * ຍອດຕົ້ນ/ທ້າຍງວດ ຄິດຍ້ອນຈາກຍອດປັດຈຸບັນຂອງບັນຊີ (ເບິ່ງ accountFlows)
 */
const CashFlow = ({ data }: { data: StatementData }) => {
  const t = useT();
  const { range, prev, currency, symbol } = data;
  // ເງິນເຂົ້າ = ລາຍຮັບ + ຮັບຊຳລະຈາກລູກໜີ້, ເງິນອອກ = ລາຍຈ່າຍ + ຈ່າຍຊຳລະເຈົ້າໜີ້
  const inflows = [...data.incomes, ...data.receipts];
  const outflows = [...data.expenses, ...data.payments];
  const flows = accountFlows(data.accounts, inflows, outflows, data.transfers, range, currency);
  // ນັບສະເພາະລາຍການຂອງບັນຊີທີ່ຢູ່ໃນໃບ — ຍອດຕົ້ນ + ຮັບ − ຈ່າຍ ± ໂອນ ຈຶ່ງເທົ່າທ້າຍງວດພໍດີ
  const ids = new Set(flows.map((f) => f.account._uuid));
  const ofAccounts = (e: Entry) => e.active && !!e.account && ids.has(e.account.id);
  const receiptLines = linesByCategory(inflows.filter(ofAccounts), range, prev, (e) => e.amount, t('notSpecified'));
  const paymentLines = linesByCategory(outflows.filter(ofAccounts), range, prev, (e) => e.amount, t('notSpecified'));

  const total = (pick: (f: (typeof flows)[number]) => number) => flows.reduce((n, f) => n + pick(f), 0);
  const opening = total((f) => f.opening);
  const closing = total((f) => f.closing);
  const receipts = total((f) => f.receipts);
  const payments = total((f) => f.payments);
  const transferNet = total((f) => f.transferIn - f.transferOut);
  const operating = receipts - payments;
  const change = closing - opening;

  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const startText = range.start.format('DD/MM/YYYY');
  const endText = range.end.format('DD/MM/YYYY');

  const renderLines = (lines: Line[], negative: boolean) =>
    lines.filter((l) => l.current).length ? lines.filter((l) => l.current).map((l) => (
      <tr key={l.key}>
        <td className="is-indent-2">{l.code && <span className="acc-fs-code">{l.code}</span>}{l.label}</td>
        <td>{acct(negative ? -l.current : l.current)}</td>
      </tr>
    )) : (
      <tr className="is-empty"><td className="is-indent-2" colSpan={2}>{t('rpEmpty')}</td></tr>
    );

  const exportRows = () => {
    const col = { item: t('fsItem'), amount: `${t('fsAmount')} (${currency ?? ''})` };
    const row = (label: string, amount: number | string) => ({ [col.item]: label, [col.amount]: amount });
    const lineRows = (lines: Line[], negative: boolean) =>
      lines.filter((l) => l.current).map((l) => row(`      ${[l.code, l.label].filter(Boolean).join(' ')}`, negative ? -l.current : l.current));
    const statement = [
      row(`${t('fsCashOpening')} (${startText})`, opening),
      row(t('fsOperating'), ''),
      row(`   ${t('fsReceipts')}`, ''),
      ...lineRows(receiptLines, false),
      row(`   ${t('fsTotalReceipts')}`, receipts),
      row(`   ${t('fsPayments')}`, ''),
      ...lineRows(paymentLines, true),
      row(`   ${t('fsTotalPayments')}`, -payments),
      row(t('fsNetOperating'), operating),
      ...(transferNet ? [row(t('fsTransferNet'), transferNet)] : []),
      row(t('fsNetChange'), change),
      row(`${t('fsCashClosing')} (${endText})`, closing),
      row('', ''),
      row(t('fsByAccount'), ''),
      ...flows.map((f) => row(
        `   ${f.account.acountName}: ${t('fsOpening')} ${formatNumber(f.opening)} · +${formatNumber(f.receipts + f.transferIn)} · −${formatNumber(f.payments + f.transferOut)}`,
        f.closing,
      )),
    ];
    exportExcel(statement, `cash-flow_${range.start.format('YYYY-MM-DD')}_${range.end.format('YYYY-MM-DD')}`,
      `${t('fsCashFlow')} ${rangeText} (${currency ?? ''})`);
  };

  return (
    <>
      {/* ---- ຕົວເລກສະຫຼຸບ: ຕົ້ນງວດ + ຮັບ − ຈ່າຍ = ທ້າຍງວດ ---- */}
      <div className="acc-rp-kpis acc-fs-flow-kpis">
        <div className="acc-rp-kpi">
          <small>{t('fsCashOpening')}</small>
          <b>{symbol} {acct(opening)}</b>
          <em className="is-flat">{startText}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalReceipts')}</small>
          <b className="is-in">+{formatNumber(receipts)}</b>
          <em className="is-flat">{inflows.filter((e) => ofAccounts(e) && !e.date.isBefore(range.start, 'day') && !e.date.isAfter(range.end, 'day')).length} {t('incomeItems')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalPayments')}</small>
          <b className="is-out">−{formatNumber(payments)}</b>
          <em className="is-flat">{outflows.filter((e) => ofAccounts(e) && !e.date.isBefore(range.start, 'day') && !e.date.isAfter(range.end, 'day')).length} {t('incomeItems')}</em>
        </div>
        <div className={`acc-rp-kpi is-main${closing < 0 ? ' is-loss' : ''}`}>
          <small>{t('fsCashClosing')}</small>
          <b>{symbol} {acct(closing)}</b>
          <em>{change >= 0 ? '+' : '−'}{formatNumber(Math.abs(change))} · {endText}</em>
        </div>
      </div>

      {/* ---- ໃບລາຍງານ (ສ່ວນທີ່ພິມ) ---- */}
      <StatementDoc
        title={t('fsCashFlow')}
        period={`${t('fsForPeriod')} ${rangeText}`}
        unit={currency ?? ''}
        onExcel={exportRows}
        note={<>
          <p>{t('fsCashFlowNote')}</p>
          <p>{t('fsCashFlowMethod')}</p>
        </>}
      >
        <table className="acc-fs-table is-single">
          <thead>
            <tr>
              <th>{t('fsItem')}</th>
              <th>{t('fsAmount')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="is-strong">
              <td>{t('fsCashOpening')} <small>({startText})</small></td>
              <td>{acct(opening)}</td>
            </tr>

            <tr className="is-section"><td colSpan={2}>{t('fsOperating')}</td></tr>
            <tr className="is-group"><td className="is-indent" colSpan={2}>{t('fsReceipts')}</td></tr>
            {renderLines(receiptLines, false)}
            <tr className="is-subtotal is-light">
              <td className="is-indent">{t('fsTotalReceipts')}</td>
              <td>{acct(receipts)}</td>
            </tr>
            <tr className="is-group"><td className="is-indent" colSpan={2}>{t('fsPayments')}</td></tr>
            {renderLines(paymentLines, true)}
            <tr className="is-subtotal is-light">
              <td className="is-indent">{t('fsTotalPayments')}</td>
              <td>{acct(-payments)}</td>
            </tr>
            <tr className="is-subtotal">
              <td>{t('fsNetOperating')}</td>
              <td>{acct(operating)}</td>
            </tr>
            {transferNet !== 0 && (
              <tr>
                <td>{t('fsTransferNet')}</td>
                <td>{acct(transferNet)}</td>
              </tr>
            )}
            <tr className="is-subtotal">
              <td>{t('fsNetChange')}</td>
              <td>{acct(change)}</td>
            </tr>
            <tr className={`is-total${closing < 0 ? ' is-negative' : ''}`}>
              <td>{t('fsCashClosing')} <small>({endText})</small></td>
              <td>{acct(closing)}</td>
            </tr>
          </tbody>
        </table>

        {/* ---- ແຍກຕາມບັນຊີ ---- */}
        <h5 className="acc-fs-subhead">{t('fsByAccount')}</h5>
        <div className="acc-rp-scroll">
          <table className="acc-fs-table is-accounts">
            <thead>
              <tr>
                <th>{t('fsAccount')}</th>
                <th>{t('fsOpening')}</th>
                <th>{t('fsReceiptsShort')}</th>
                <th>{t('fsPaymentsShort')}</th>
                <th>{t('mvSrcTRANSFER_IN')}</th>
                <th>{t('mvSrcTRANSFER_OUT')}</th>
                <th>{t('fsClosing')}</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.account._uuid}>
                  <td>
                    <span className="acc-fs-account">
                      <span className="acc-rp-share-logo">
                        {f.account.banks?.url ? <img src={f.account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                      </span>
                      <span>
                        <b>{f.account.acountName}</b>
                        <small>{[f.account.banks?.abbr ?? t('treasuryNoBank'), f.account.treasury?.treasury_name].filter(Boolean).join(' · ')}</small>
                      </span>
                    </span>
                  </td>
                  <td>{acct(f.opening)}</td>
                  <td className="is-in">{f.receipts ? `+${formatNumber(f.receipts)}` : '—'}</td>
                  <td className="is-out">{f.payments ? `−${formatNumber(f.payments)}` : '—'}</td>
                  <td>{f.transferIn ? `+${formatNumber(f.transferIn)}` : '—'}</td>
                  <td>{f.transferOut ? `−${formatNumber(f.transferOut)}` : '—'}</td>
                  <td><b>{acct(f.closing)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('total')} · {flows.length} {t('bankAccounts')}</td>
                <td>{acct(opening)}</td>
                <td>+{formatNumber(receipts)}</td>
                <td>−{formatNumber(payments)}</td>
                <td>+{formatNumber(total((f) => f.transferIn))}</td>
                <td>−{formatNumber(total((f) => f.transferOut))}</td>
                <td>{acct(closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </StatementDoc>
    </>
  );
};

export default CashFlow;
