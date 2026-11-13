import { useRef, type ReactNode } from 'react';
import moment from 'moment';
import { printElementByFrame } from '../../../utils/Print';
import { useT } from '../../../context/LanguageContext';
import { useCompany } from '../../hr/payroll/payrollApi';
import { useAccountSetting } from '../accountSettings';

/** ພິມສະເພາະໃບ — A4 ຕັ້ງ, ເຊື່ອງປຸ່ມ (.no-print) */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm; }
  html, body { background: #fff !important; margin: 0; }
  .no-print { display: none !important; }
  .acc-fs-doc { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .acc-rp-scroll { overflow: visible !important; }
  .acc-fs-table { min-width: 0 !important; font-size: 11px !important; }
  .acc-fs-table col { width: auto !important; }
  .acc-fs-share-bar { display: none !important; }
  .acc-fs-signs { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ບ່ອນເຊັນທ້າຍງົບການເງິນ (ກົດໝາຍບັນຊີ ມາດຕາ 20: ຫົວໜ້າບັນຊີ ແລະ ຜູ້ບໍລິຫານ ເຊັນ) — ຜູ້ສ້າງ = ຜູ້ໃຊ້ທີ່ພິມ,
 * ຊື່ຫົວໜ້າບັນຊີ / ຜູ້ອຳນວຍການ ຈາກ ຕັ້ງຄ່າບັນຊີ → ຕັ້ງຄ່າທົ່ວໄປ (ຫວ່າງ = ເສັ້ນໃຫ້ຂຽນຊື່ເອງ)
 */
export const SignatureBlock = () => {
  const t = useT();
  const setting = useAccountSetting();
  const signers = [
    { role: t('fsSignPreparer'), name: localStorage.getItem('user_name') },
    { role: t('fsSignChiefAccountant'), name: setting.chief_accountant },
    { role: t('fsSignDirector'), name: setting.director },
  ];
  return (
    <div className="acc-fs-signs">
      <p>{t('fsSignDate')} {moment().format('DD/MM/YYYY')}</p>
      <div>
        {signers.map((s) => (
          <span key={s.role}>
            <b>{s.role}</b>
            <i aria-hidden="true" />
            <em>{s.name || '........................................'}</em>
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * ກອບເອກະສານຂອງໃບລາຍງານການເງິນ — ຫົວ (ບໍລິສັດ + ເລກອາກອນ, ຊື່ໃບ, ຊ່ວງ, ຫົວໜ່ວຍເງິນ) + ປຸ່ມ Excel / ພິມ + ເນື້ອໃນ
 * + ໝາຍເຫດ + ບ່ອນເຊັນ. ພິມສະເພາະກອບນີ້ (ບໍ່ລວມຕົວເລກສະຫຼຸບ ແລະ ກຣາຟທີ່ຢູ່ນອກ)
 */
const StatementDoc = ({ title, period, unit, onExcel, note, children, signatures = true }: {
  title: string;
  period: string;
  unit: string;
  onExcel?: () => void;
  note?: ReactNode;
  children: ReactNode;
  /** false = ບໍ່ມີບ່ອນເຊັນ (ເຊັ່ນ ລາຍງານພາຍໃນ) */
  signatures?: boolean;
}) => {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const company = useCompany();
  const setting = useAccountSetting();
  return (
    <article ref={ref} className="acc-fs-doc">
      <header className="acc-fs-doc-head">
        {company?.logo_url && <img className="acc-fs-doc-logo" src={company.logo_url} alt="" />}
        <span className="acc-fs-doc-title">
          <small>
            {company?.name_la ?? t('accountAppFinancialStatements')}
            {setting.tax_id && <> · {t('acgTaxIdShort')} {setting.tax_id}</>}
          </small>
          <h3>{title}</h3>
          <em>{period}{unit ? ` · ${t('fsUnit')} ${unit}` : ''}</em>
        </span>
        <span className="acc-rp-actions no-print">
          {onExcel && (
            <button type="button" className="acc-rp-btn" onClick={onExcel}>
              <i className="fa-solid fa-file-excel" /> Excel
            </button>
          )}
          <button type="button" className="acc-rp-btn" onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}>
            <i className="fa-solid fa-print" /> {t('incomePrintOnly')}
          </button>
        </span>
      </header>
      {children}
      {note && <footer className="acc-fs-note">{note}</footer>}
      {signatures && <SignatureBlock />}
    </article>
  );
};

export default StatementDoc;
