import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button, Input, Loader, NumberInput, SelectPicker } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { useFiscalYears } from '../../../utils/selectOption';
import { isNotReady } from '../gl/glApi';
import { GlNotReady, amountFormatter } from '../gl/glKit';
import { exportExcel } from '../../../utils/exportHelpers';
import StatementDoc from '../statements/StatementDoc';

type Data = {
  fiscal: { _uuid: number; fiscal_code: string; fiscal_name?: string; start_date: string; end_date: string };
  pnl: { revenue: number; expense: number; profit: number; booked: number };
  rate: number;
  saved: { add_back: string; deduction: string; rate: string; taxable: string; tax: string; entry_date: string | null; note: string | null; updatedAt: string } | null;
  date: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ອາກອນກຳໄລ — ກຳໄລກ່ອນອາກອນຂອງປີ (ຈາກສະໝຸດບັນຊີ) + ລາຍຈ່າຍທີ່ບໍ່ຫັກໄດ້ − ລາຍຮັບທີ່ບໍ່ຕ້ອງເສຍ = ກຳໄລເສຍອາກອນ × ອັດຕາ.
 * ລົງບັນຊີ ໜີ້ ລາຍຈ່າຍອາກອນກຳໄລ / ມີ ອາກອນກຳໄລຄ້າງຈ່າຍ (ລົງຊ້ຳ = ກັບໃບເກົ່າ ແລ້ວລົງໃໝ່).
 * ຕາຕະລາງເປັນເອກະສານ "ລາຍງານປຽບທຽບຜົນບັນຊີ ກັບ ຜົນອາກອນ" (ແຈ້ງການກົມສ່ວຍສາອາກອນ ເລກທີ 0253 ໃຫ້ຍື່ນພ້ອມງົບການເງິນ)
 * — ພິມ/Excel ໄດ້, ມີບ່ອນເຊັນ. ຈ່າຍອາກອນ: ປິດງວດບັນຊີ → ນຳສົ່ງອາກອນ (ຈ່າຍແລ້ວ ສະແດງໃນລາຍງານ)
 */
const ProfitTaxPage = () => {
  const t = useT();
  const years = useFiscalYears();
  const [fiscalId, setFiscalId] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [addBack, setAddBack] = useState(0);
  const [deduction, setDeduction] = useState(0);
  const [rate, setRate] = useState(20);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  /** ອາກອນກຳໄລທີ່ນຳສົ່ງແລ້ວ ສຳລັບງວດໃນປີນີ້ (ລວມຈ່າຍລ່ວງໜ້າ) — ຈາກ ນຳສົ່ງອາກອນ */
  const [paid, setPaid] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(null);
      const res = await postApi('/tax/profit-tax', { fiscal_id: fiscalId });
      const d: Data = res.data;
      setData(d);
      setAddBack(Number(d.saved?.add_back ?? 0));
      setDeduction(Number(d.saved?.deduction ?? 0));
      setRate(Number(d.rate));
      setNote(d.saved?.note ?? '');
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else Notific.error(getErrorMessage(err));
    }
  }, [fiscalId]);

  useEffect(() => {
    load();
  }, [load]);

  const fiscalStart = data?.fiscal.start_date;
  const fiscalEnd = data?.fiscal.end_date;
  useEffect(() => {
    if (!fiscalStart || !fiscalEnd) return;
    postApi('/tax-payment/fetch', { start_date: fiscalStart })
      .then((res) => setPaid((res.data?.data ?? [])
        .filter((p: any) => Number(p.tax_kind) === 5 && Number(p.status) === 1 && p.period_end >= fiscalStart && p.period_end <= fiscalEnd)
        .reduce((n: number, p: any) => n + (Number(p.amount) || 0), 0)))
      .catch(() => setPaid(0));
  }, [fiscalStart, fiscalEnd]);

  if (notReady) return <GlNotReady />;
  if (!data) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const taxable = round2(data.pnl.profit + addBack - deduction);
  const tax = round2(Math.max(0, taxable) * rate / 100);
  const yearEnded = moment(data.fiscal.end_date).isBefore(moment(), 'day');
  const num = (v: unknown) => Math.max(0, Number(String(v ?? '').replace(/,/g, '')) || 0);

  const post = () =>
    Notific.confirm(`${t('ptPostConfirm')} ₭ ${formatNumber(tax)}`, async () => {
      try {
        setBusy(true);
        await postApi('/tax/profit-tax/post', { fiscal_id: data.fiscal._uuid, add_back: addBack, deduction, rate, note });
        Notific.success('acsSaved');
        await load();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    });

  /** ແຖວຂອງລາຍງານ — ໃຊ້ທັງຕາຕະລາງ ແລະ Excel */
  const lines: { label: string; value: number; className?: string; hint?: string }[] = [
    { label: t('fsTotalRevenue'), value: data.pnl.revenue },
    { label: t('ptExpenses'), value: -data.pnl.expense },
    { label: t('ptProfitBeforeTax'), value: data.pnl.profit, className: 'is-subtotal' },
    { label: t('ptAddBack'), value: addBack, hint: t('ptAddBackHint') },
    { label: t('ptDeduction'), value: -deduction, hint: t('ptDeductionHint') },
    { label: t('ptTaxable'), value: taxable, className: 'is-subtotal' },
    { label: `${t('closeProfitTax')} ${rate}%`, value: tax, className: 'is-total' },
    { label: t('ptBooked'), value: data.pnl.booked, hint: t('ptBookedHint') },
    { label: t('ptPaid'), value: -paid, hint: t('ptPaidHint') },
    { label: t('ptStillDue'), value: round2(tax - paid), className: 'is-total' },
  ];
  const period = `${moment(data.fiscal.start_date).format('DD/MM/YYYY')} – ${moment(yearEnded ? data.fiscal.end_date : data.date).format('DD/MM/YYYY')}`;
  const exportRows = () => exportExcel(
    lines.map((l) => ({ [t('ptReconItem')]: l.label, LAK: l.value })),
    `profit_tax_${data.fiscal.fiscal_code}`, t('ptReconTitle'),
  );

  const row = (label: string, value: number, className = 'is-line', hint?: string) => (
    <tr className={className}>
      <td>{label}{hint && <small>{hint}</small>}</td>
      <td>{value < 0 ? `(${formatNumber(-value)})` : formatNumber(value)}</td>
    </tr>
  );

  return (
    <div className="acs-page acc-close">
      <section className="acc-rp-card acc-pt">
        <header>
          <h4><i className="fa-solid fa-percent" /> {t('closeProfitTax')}</h4>
          <SelectPicker cleanable={false} searchable={false} value={data.fiscal._uuid} onChange={(v) => setFiscalId(v ?? null)}
            data={years.map((y) => ({ value: y._uuid, label: y.fiscal_name || y.fiscal_code }))} />
        </header>
        <p className="acc-close-note">
          <i className="fa-solid fa-circle-info" /> {t(yearEnded ? 'ptHintYear' : 'ptHintYtd')} ({moment(data.date).format('DD/MM/YYYY')})
        </p>

        <div className="acc-pt-grid">
          {/* ລາຍງານປຽບທຽບຜົນບັນຊີ ກັບ ຜົນອາກອນ — ຍື່ນພ້ອມງົບການເງິນປະຈຳປີ */}
          <StatementDoc title={t('ptReconTitle')} period={`${data.fiscal.fiscal_name || data.fiscal.fiscal_code} · ${period}`} unit="LAK"
            onExcel={exportRows} note={note ? <p>{t('note')}: {note}</p> : undefined}
          >
            <table className="acc-fs-table">
              <tbody>
                {lines.map((l) => <Fragment key={l.label}>{row(l.label, l.value, l.className, l.hint)}</Fragment>)}
              </tbody>
            </table>
          </StatementDoc>

          <div className="acc-pt-inputs">
            <label><span>{t('ptAddBack')}</span>
              <NumberInput value={addBack} onChange={(v) => setAddBack(num(v))} formatter={amountFormatter} controls={false} prefix="₭" />
            </label>
            <label><span>{t('ptDeduction')}</span>
              <NumberInput value={deduction} onChange={(v) => setDeduction(num(v))} formatter={amountFormatter} controls={false} prefix="₭" />
            </label>
            <label><span>{t('acgProfitTaxRate')}</span>
              <NumberInput value={rate} onChange={(v) => setRate(Math.min(100, num(v)))} postfix="%" min={0} max={100} step={0.5} />
            </label>
            <label><span>{t('note')}</span><Input value={note} onChange={setNote} /></label>
          </div>
        </div>

        <footer className="acc-fa-foot">
          <span>
            {data.saved
              ? <><i className="fa-solid fa-circle-check" /> {t('ptSaved')} ₭ {formatNumber(Number(data.saved.tax))} · {moment(data.saved.updatedAt).format('DD/MM/YYYY HH:mm')}</>
              : t('ptNotSaved')}
          </span>
          <Button appearance="primary" loading={busy} disabled={!canCreate} onClick={post}>
            <i className="fa-solid fa-check" /> {t('ptPost')}
          </Button>
        </footer>
        <p className="acc-close-note"><i className="fa-solid fa-money-bill-wave" /> {t('ptPayHint')}</p>
      </section>
    </div>
  );
};

export default ProfitTaxPage;
