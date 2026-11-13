import { useCallback, useEffect, useState } from 'react';
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
 * ຈ່າຍອາກອນ: ບັນທຶກລາຍຈ່າຍ ປະເພດທີ່ຜູກກັບບັນຊີ ອາກອນກຳໄລຄ້າງຈ່າຍ
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
          <table className="acc-fs-table">
            <tbody>
              {row(t('fsTotalRevenue'), data.pnl.revenue)}
              {row(t('ptExpenses'), -data.pnl.expense)}
              {row(t('ptProfitBeforeTax'), data.pnl.profit, 'is-subtotal')}
              {row(t('ptAddBack'), addBack, 'is-line', t('ptAddBackHint'))}
              {row(t('ptDeduction'), -deduction, 'is-line', t('ptDeductionHint'))}
              {row(t('ptTaxable'), taxable, 'is-subtotal')}
              {row(`${t('closeProfitTax')} ${rate}%`, tax, 'is-total')}
              {row(t('ptBooked'), data.pnl.booked, 'is-line', t('ptBookedHint'))}
            </tbody>
          </table>

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
