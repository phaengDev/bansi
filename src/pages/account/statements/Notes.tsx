import { useMemo } from 'react';
import { Loader } from 'rsuite';
import { useLangField, useT } from '../../../context/LanguageContext';
import { money, type ChartAccount } from '../gl/glApi';
import { GlNotReady, useChartAccounts } from '../gl/glKit';
import { useCompany } from '../../hr/payroll/payrollApi';
import { useAccountSetting } from '../accountSettings';
import { POLICY_TEMPLATE_KEY } from '../setting/AccountGeneralPage';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { Zero } from './StatementBits';
import { naturalClosing, naturalMovement, useGlSnapshots } from './glSnapshots';

/**
 * ບົດອະທິບາຍງົບການເງິນ: ຖັນ compare = ຍອດ ນ ທ້າຍງວດນີ້ ທຽບທ້າຍງວດກ່ອນ (ຊັບສິນ/ໜີ້ສິນ) ຫຼື ງວດນີ້ ທຽບງວດກ່ອນ (ລາຍຮັບ-ລາຍຈ່າຍ);
 * movement = ຍອດຕົ້ນງວດ, ເພີ່ມ, ຫຼຸດ, ທ້າຍງວດ (ຊັບສົມບັດຄົງທີ່)
 */
type NoteDef = { key: string; title: string; groups: number[]; types: string[]; kind: 'balance' | 'pnl' | 'movement' };

const NOTES: NoteDef[] = [
  { key: 'cash', title: 'fsNoteCash', groups: [1], types: ['CASH'], kind: 'balance' },
  { key: 'receivable', title: 'fsNoteReceivable', groups: [1], types: ['RECEIVABLE'], kind: 'balance' },
  { key: 'otherCurrent', title: 'fsNoteOtherCurrent', groups: [1], types: ['CURRENT_ASSET'], kind: 'balance' },
  { key: 'fixed', title: 'fsNoteFixedAssets', groups: [1], types: ['FIXED_ASSET', 'NONCURRENT_ASSET'], kind: 'movement' },
  { key: 'payable', title: 'fsNotePayable', groups: [2], types: ['PAYABLE'], kind: 'balance' },
  { key: 'otherLiab', title: 'fsNoteOtherLiabilities', groups: [2], types: ['CURRENT_LIABILITY'], kind: 'balance' },
  { key: 'longLiab', title: 'fsNoteLongLiabilities', groups: [2], types: ['NONCURRENT_LIABILITY'], kind: 'balance' },
  { key: 'revenue', title: 'fsNoteRevenue', groups: [4], types: ['REVENUE', 'OTHER_INCOME'], kind: 'pnl' },
  { key: 'expense', title: 'fsNoteExpense', groups: [5], types: ['EXPENSE', 'OTHER_EXPENSE', 'TAX_EXPENSE'], kind: 'pnl' },
];

const cell = (value: number) => (Math.abs(value) >= 0.005 ? money(value) : <Zero />);

/**
 * ບົດອະທິບາຍງົບການເງິນ (ກົດໝາຍບັນຊີ ມາດຕາ 31 — ທຸກວິສາຫະກິດຕ້ອງມີ): 1 ຂໍ້ມູນທົ່ວໄປ, 2 ພື້ນຖານການກະກຽມ,
 * 3 ນະໂຍບາຍບັນຊີ (ຕັ້ງຄ່າບັນຊີ → ຕັ້ງຄ່າທົ່ວໄປ), ແລ້ວລາຍລະອຽດຕາມບັນຊີຂອງແຕ່ລະໝວດ (ສະເພາະໝວດທີ່ມີຍອດ) ຈາກສະໝຸດບັນຊີ
 */
const Notes = ({ data }: { data: StatementData }) => {
  const t = useT();
  const lf = useLangField();
  const company = useCompany();
  const setting = useAccountSetting();
  const { range, prev } = data;
  const { rows: accounts, notReady: chartNotReady, loading: chartLoading } = useChartAccounts();
  const { data: snaps, error, notReady } = useGlSnapshots({
    period: { start: range.start, end: range.end },
    before: { end: prev.end },
    prevPeriod: { start: prev.start, end: prev.end },
  });

  const notes = useMemo(() => {
    if (!snaps || chartLoading) return null;
    const postable = accounts.filter((a) => Number(a.is_postable) === 1);
    const has = (...values: number[]) => values.some((v) => Math.abs(v) >= 0.005);
    return NOTES.map((n) => {
      const list = postable.filter((a) => n.groups.includes(Number(a.account_group)) && n.types.includes(a.account_type));
      const rows = list.map((a) => {
        if (n.kind === 'pnl') return { a, values: [naturalMovement(snaps.period, a), naturalMovement(snaps.prevPeriod, a)] };
        if (n.kind === 'balance') return { a, values: [naturalClosing(snaps.period, a), naturalClosing(snaps.before, a)] };
        // ຊັບສົມບັດ: ຄ່າຫຼຸ້ຍຫ້ຽນສະສົມ (ຝັ່ງມີ) ເປັນຕິດລົບ — ເພີ່ມ = ໜີ້, ຫຼຸດ = ມີ
        const b = snaps.period.get(a._uuid);
        const opening = b?.opening ?? 0;
        return { a, values: [opening, b?.debit ?? 0, -(b?.credit ?? 0), opening + (b?.debit ?? 0) - (b?.credit ?? 0)] };
      }).filter((r) => has(...r.values));
      const totals = rows.reduce((sum, r) => sum.map((v, i) => v + r.values[i]), rows[0]?.values.map(() => 0) ?? []);
      return { ...n, rows, totals };
    }).filter((n) => n.rows.length);
  }, [snaps, accounts, chartLoading]);

  if (notReady || chartNotReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!notes) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const endText = range.end.format('DD/MM/YYYY');
  const prevEndText = prev.end.format('DD/MM/YYYY');
  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${endText}`;
  const prevText = `${prev.start.format('DD/MM/YYYY')} – ${prevEndText}`;
  const heads = (kind: NoteDef['kind']) =>
    kind === 'pnl' ? [rangeText, prevText]
      : kind === 'balance' ? [endText, prevEndText]
        : [t('fsNoteOpening'), t('fsNoteIncrease'), t('fsNoteDecrease'), t('fsNoteClosing')];
  const policies = (setting.policies || t(POLICY_TEMPLATE_KEY)).split('\n');
  const label = (a: ChartAccount) => <><span className="acc-fs-code">{a.account_code}</span>{lf(a, 'name')}</>;
  const fixed = 3;

  return (
    <StatementDoc title={t('fsNotes')} period={rangeText} unit="LAK">
      <div className="acc-fs-notes">
        <section>
          <h4>1. {t('fsNoteGeneral')}</h4>
          <dl>
            <dt>{t('fsNoteCompany')}</dt><dd>{company?.name_la ?? '—'}{company?.name_en ? ` (${company.name_en})` : ''}</dd>
            {setting.tax_id && <><dt>{t('acgTaxId')}</dt><dd>{setting.tax_id}</dd></>}
            {company?.village && <><dt>{t('fsNoteAddress')}</dt><dd>{company.village}</dd></>}
            <dt>{t('fsNotePeriod')}</dt><dd>{rangeText}</dd>
            <dt>{t('fsNoteCurrency')}</dt><dd>{t('fsNoteCurrencyText')}</dd>
          </dl>
        </section>
        <section>
          <h4>2. {t('fsNoteBasis')}</h4>
          <p>{t('fsNoteBasisText')}</p>
        </section>
        <section>
          <h4>3. {t('acgPolicies')}</h4>
          {policies.map((line, i) => (line.trim() ? <p key={i}>{line}</p> : null))}
        </section>

        {notes.map((n, index) => (
          <section key={n.key}>
            <h4>{index + fixed + 1}. {t(n.title)}</h4>
            <div className="acc-rp-scroll">
              <table className="acc-fs-table">
                <thead>
                  <tr>
                    <th>{t('fsItem')}</th>
                    {heads(n.kind).map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {n.rows.map((r) => (
                    <tr key={r.a._uuid} className="is-line">
                      <td className="is-indent">{label(r.a)}</td>
                      {r.values.map((v, i) => <td key={i}>{cell(v)}</td>)}
                    </tr>
                  ))}
                  <tr className="is-subtotal">
                    <td>{t('total')}</td>
                    {n.totals.map((v, i) => <td key={i}>{cell(v)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <section>
          <h4>{notes.length + fixed + 1}. {t('fsNoteEquity')}</h4>
          <p>{t('fsNoteEquityText')}</p>
        </section>
      </div>
    </StatementDoc>
  );
};

export default Notes;
