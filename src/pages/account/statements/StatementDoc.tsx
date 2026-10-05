import { useRef, type ReactNode } from 'react';
import { printElementByFrame } from '../../../utils/Print';
import { useT } from '../../../context/LanguageContext';

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
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ກອບເອກະສານຂອງໃບລາຍງານການເງິນ — ຫົວ (ຊື່ໃບ, ຊ່ວງ, ຫົວໜ່ວຍເງິນ) + ປຸ່ມ Excel / ພິມ + ເນື້ອໃນ + ໝາຍເຫດ.
 * ພິມສະເພາະກອບນີ້ (ບໍ່ລວມຕົວເລກສະຫຼຸບ ແລະ ກຣາຟທີ່ຢູ່ນອກ)
 */
const StatementDoc = ({ title, period, unit, onExcel, note, children }: {
  title: string;
  period: string;
  unit: string;
  onExcel: () => void;
  note?: ReactNode;
  children: ReactNode;
}) => {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  return (
    <article ref={ref} className="acc-fs-doc">
      <header className="acc-fs-doc-head">
        <span className="acc-fs-doc-title">
          <small>{t('accountAppFinancialStatements')}</small>
          <h3>{title}</h3>
          <em>{period}{unit ? ` · ${t('fsUnit')} ${unit}` : ''}</em>
        </span>
        <span className="acc-rp-actions no-print">
          <button type="button" className="acc-rp-btn" onClick={onExcel}>
            <i className="fa-solid fa-file-excel" /> Excel
          </button>
          <button type="button" className="acc-rp-btn" onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}>
            <i className="fa-solid fa-print" /> {t('incomePrintOnly')}
          </button>
        </span>
      </header>
      {children}
      {note && <footer className="acc-fs-note">{note}</footer>}
    </article>
  );
};

export default StatementDoc;
