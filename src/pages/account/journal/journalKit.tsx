import moment from 'moment';
import { getErrorMessage } from '../../../utils/useCRUD';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import type { AccountClass, FinanceCategory, Tax } from '../../../utils/selectOption';

/** ສ່ວນທີ່ຟອມລາຍຮັບ (IncomeForm) ແລະ ລາຍຈ່າຍ (ExpenseForm) ໃຊ້ຮ່ວມກັນ */

/** ວິທີຮັບ/ຈ່າຍເງິນ — ກົງກັບ receive_type / pay_type ຂອງ backend */
export const CASH = 1;
export const TRANSFER = 2;

/**
 * ໝວດເງິນສົດ (ລະຫັດໝວດ 101 ເງິນສົດໃນຄັງ ຕາມຜັງບັນຊີ) — ບັນຊີໃນໝວດນີ້ = ເງິນສົດ, ໝວດອື່ນ = ເງິນໂອນ.
 * ຕ້ອງກົງກັບ CASH_CLASS_CODE ຂອງ backend (bansi/journalHelpers)
 */
export const CASH_CLASS_CODE = '101';

/** ໝວດຂອງບັນຊີເງິນຄັງ (tbl_type_account._uuid ຜ່ານປະເພດບັນຊີ) */
export const classIdOf = (account?: TreasuryAccount) => account?.treasury?.typeId;

// ປະເພດຂໍ້ມູນຂອງຊ່ອງເລືອກ ຢູ່ utils/selectOption (ບ່ອນດຶງຂໍ້ມູນ) — ສົ່ງຕໍ່ໃຫ້ຟອມທີ່ import ຈາກນີ້ຢູ່ແລ້ວ
export type { FinanceCategory as Category, AccountClass, Tax };

/** ໝວດຕັ້ງຕົ້ນຂອງ "ຮັບເງິນເຂົ້າ" / "ຈ່າຍຈາກ" — ໝວດເງິນສົດ (ບໍ່ມີ = ໝວດທຳອິດ) */
export const defaultClassId = (classes: AccountClass[]) =>
  (classes.find((c) => c.type_code === CASH_CLASS_CODE) ?? classes[0])?._uuid ?? null;
export type TaxMode = 'none' | 'select' | 'manual';

/** ລົງຍ້ອນຫຼັງໄດ້ ແຕ່ບໍ່ໃຫ້ເລືອກວັນໃນອະນາຄົດ (backend ກວດຊ້ຳ) */
export const isFutureDay = (date: Date) => moment(date).isAfter(moment(), 'day');

/** ໄຟລ໌ທີ່ຮັບ — ກົງກັບ createUploadFile ຂອງ backend (ຮູບ, PDF · ≤ 5MB) */
export const MAX_FILE = 5 * 1024 * 1024;
export const isAllowedFile = (file: File) => /^image\//.test(file.type) || file.type === 'application/pdf';

/**
 * ຄິດອາກອນ (ສູດດຽວກັບ backend ແລະ ໜ້າຕັ້ງຄ່າອາກອນ): method 1 = ລວມໃນລາຄາແລ້ວ (ຍອດ = ຈຳນວນ),
 * 2 = ບວກເພີ່ມ (ຍອດ = ຈຳນວນ + ອາກອນ). ອາກອນປັດເປັນຈຳນວນເຕັມ
 */
export const computeTax = (amount: number, mode: TaxMode, tax: Tax | undefined, manual: number, manualMethod: number) => {
  if (mode === 'select' && tax) {
    const rate = Number(tax.rate) || 0;
    const inclusive = Number(tax.calc_method) === 1;
    const value = Math.round(inclusive ? amount - amount / (1 + rate / 100) : (amount * rate) / 100);
    return { tax: value, total: inclusive ? amount : amount + value };
  }
  if (mode === 'manual' && manual > 0) {
    return { tax: Math.round(manual), total: manualMethod === 1 ? amount : amount + Math.round(manual) };
  }
  return { tax: 0, total: amount };
};

/** ຈຳນວນຂອງລາຍການ — ທົດສະນິຍົມໄດ້ເຖິງ 3 ຕຳແໜ່ງ (1.5 ລິດ); formatNumber ປັດເປັນຈຳນວນເຕັມຈຶ່ງໃຊ້ບໍ່ໄດ້ */
export const formatQty = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(value) || 0);

/** ບັນທຶກ blob ເປັນໄຟລ໌ — browser ດາວໂຫຼດທັນທີ */
export const saveBlob = (blob: Blob, name: string) => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
};

/** error ຂອງ request ແບບ blob — ຂໍ້ຄວາມ JSON ຈາກ backend ຢູ່ໃນ blob ຕ້ອງອ່ານອອກກ່ອນ */
export const blobErrorMessage = async (error: any) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text())?.message ?? getErrorMessage(error);
    } catch {
      return getErrorMessage(error);
    }
  }
  return getErrorMessage(error);
};

/** CSS ຕອນພິມ — ພິມສະເພາະໃບຮັບ/ໃບຈ່າຍເງິນ (.acc-inv-receipt), ພື້ນຂາວ, ກວ້າງເຕັມໜ້າ */
export const RECEIPT_PRINT_CSS = `
  @page { size: A5 portrait; margin: 12mm; }
  html, body { background: #fff !important; margin: 0; padding: 0; }
  .acc-inv-receipt { box-shadow: none !important; border: 1px solid #d5dee6 !important; margin: 0 auto; max-width: 100%; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;
