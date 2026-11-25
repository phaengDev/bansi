import * as XLSX from 'xlsx-js-style';
import moment from 'moment';

/**
 * ອ່ານໃບແຈ້ງຍອດທະນາຄານ (Excel / CSV ທີ່ດາວໂຫຼດຈາກ i-Bank ຂອງ BCEL, LDB, JDB…) ແລ້ວຈັບຄູ່ກັບລາຍການໃນລະບົບ.
 * ຫາແຖວຫົວຕາຕະລາງເອງ (20 ແຖວທຳອິດ) ຈາກຄຳ ລາວ / ອັງກິດ: ວັນທີ, ລາຍລະອຽດ, ຖອນ (debit) / ຝາກ (credit) ຫຼື ຈຳນວນ (+/−), ຍອດເຫຼືອ.
 * amount: + = ເງິນເຂົ້າບັນຊີ (ຄືກັບລາຍການໃນລະບົບ), − = ເງິນອອກ
 */
export type StatementRow = { date: string; description: string; amount: number; balance: number | null };

const COLUMNS = {
  date: /date|ວັນທີ|ວັນ\s*ທີ|日期/i,
  description: /desc|detail|narr|particular|remark|memo|ລາຍລະອຽດ|ເນື້ອໃນ|ລາຍການ|摘要|说明/i,
  debit: /debit|withdraw|ຖອນ|ເງິນອອກ|支出|借方|^dr\.?$/i,
  credit: /credit|deposit|ຝາກ|ເງິນເຂົ້າ|收入|贷方|^cr\.?$/i,
  amount: /amount|ຈຳນວນເງິນ|ຈຳນວນ|金额/i,
  balance: /balance|ຍອດເຫຼືອ|ຄົງເຫຼືອ|余额/i,
};
type ColumnKey = keyof typeof COLUMNS;

const cellText = (value: unknown) => String(value ?? '').trim();

/** "1,250,000.50" / "(1,000)" / "-500" / 1250 → ຕົວເລກ; ວ່າງ = null */
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cellText(value).replace(/[^\d.,()\-]/g, '');
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith('-');
  const n = Number(text.replace(/[(),\-]/g, ''));
  return Number.isFinite(n) ? (negative ? -n : n) : null;
};

/** ວັນທີ Excel (ເລກ / Date) ຫຼື ຂໍ້ຄວາມ dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy (ມີເວລາຕໍ່ທ້າຍໄດ້) → YYYY-MM-DD */
const toDate = (value: unknown): string | null => {
  if (value instanceof Date) return moment(value).format('YYYY-MM-DD');
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? moment({ year: parsed.y, month: parsed.m - 1, day: parsed.d }).format('YYYY-MM-DD') : null;
  }
  const text = cellText(value).split(/\s+/)[0];
  const m = moment(text, ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'DD.MM.YYYY', 'YYYY/MM/DD', 'DD/MM/YY'], true);
  return m.isValid() ? m.format('YYYY-MM-DD') : null;
};

/** ແຖວຫົວຕາຕະລາງ = ແຖວທຳອິດທີ່ມີຖັນວັນທີ ແລະ ຖັນເງິນ (ຖອນ/ຝາກ ຫຼື ຈຳນວນ) */
const findHeader = (rows: unknown[][]) => {
  for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
    const cols: Partial<Record<ColumnKey, number>> = {};
    rows[r].forEach((cell, c) => {
      const text = cellText(cell);
      if (!text || text.length > 40) return;
      // ລຳດັບສຳຄັນ: ຍອດເຫຼືອ ກ່ອນ ຈຳນວນ (ຄຳວ່າ "ຍອດ" ບໍ່ໃຫ້ກາຍເປັນຖັນເງິນ), ຖອນ/ຝາກ ກ່ອນ ລາຍລະອຽດ
      const key = (['date', 'balance', 'debit', 'credit', 'amount', 'description'] as ColumnKey[])
        .find((k) => cols[k] === undefined && COLUMNS[k].test(text));
      if (key) cols[key] = c;
    });
    if (cols.date !== undefined && (cols.amount !== undefined || cols.debit !== undefined || cols.credit !== undefined)) return { row: r, cols };
  }
  return null;
};

/** ອ່ານໄຟລ໌ → ແຖວຂອງໃບແຈ້ງຍອດ (ຂ້າມແຖວທີ່ບໍ່ມີວັນທີ ຫຼື ບໍ່ມີເງິນ — ເຊັ່ນ ຍອດຍົກມາ / ລວມ). throw = ອ່ານບໍ່ໄດ້ */
export const readStatement = async (file: File): Promise<StatementRow[]> => {
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: true, defval: '' });
    const header = findHeader(rows);
    if (!header) continue;
    const { cols } = header;
    const at = (row: unknown[], key: ColumnKey) => (cols[key] === undefined ? undefined : row[cols[key]!]);
    const out: StatementRow[] = [];
    for (const row of rows.slice(header.row + 1)) {
      const date = toDate(at(row, 'date'));
      if (!date) continue;
      const debit = Math.abs(toNumber(at(row, 'debit')) ?? 0);
      const credit = Math.abs(toNumber(at(row, 'credit')) ?? 0);
      const amount = cols.debit !== undefined || cols.credit !== undefined ? credit - debit : toNumber(at(row, 'amount')) ?? 0;
      if (!amount) continue;
      out.push({ date, description: cellText(at(row, 'description')), amount: Math.round(amount * 100) / 100, balance: toNumber(at(row, 'balance')) });
    }
    if (out.length) return out;
  }
  throw new Error('no-rows');
};

/** ຍອດເຫຼືອໃນໃບແຈ້ງຍອດ ຮອດວັນທີ (ແຖວສຸດທ້າຍທີ່ວັນທີ ≤ date ຕາມລຳດັບໃນໄຟລ໌) — ບໍ່ມີຖັນຍອດເຫຼືອ = null */
export const statementBalanceAt = (rows: StatementRow[], date: string) => {
  const upTo = rows.filter((r) => r.date <= date && r.balance !== null);
  if (!upTo.length) return null;
  const lastDate = upTo.reduce((max, r) => (r.date > max ? r.date : max), upTo[0].date);
  const sameDay = upTo.filter((r) => r.date === lastDate);
  return sameDay[sameDay.length - 1].balance;
};

/** ລາຍການໃນລະບົບທີ່ຍັງບໍ່ກະທົບຍອດ (ຈາກ /bank-rec/open) */
export type BookLine = { line_id: number; entry_date: string; amount: number };

/**
 * ຈັບຄູ່: ແຕ່ລະແຖວໃນໃບແຈ້ງຍອດ (ວັນທີ ≤ ວັນທີໃບແຈ້ງຍອດ) ກັບລາຍການໃນລະບົບທີ່ຈຳນວນເທົ່າກັນ ແລະ ວັນທີຫ່າງບໍ່ເກີນ 7 ມື້
 * (ໃກ້ສຸດກ່ອນ, ໃຊ້ໄດ້ເທື່ອດຽວ). matched = line_id ທີ່ຕິກໃຫ້; unmatched = ແຖວທີ່ບໍ່ພົບໃນລະບົບ (ຄ່າທຳນຽມ, ດອກເບ້ຍ…)
 */
export const matchStatement = (rows: StatementRow[], lines: BookLine[], date: string, maxDays = 7) => {
  const used = new Set<number>();
  const unmatched: StatementRow[] = [];
  const pairs: { row: StatementRow; line_id: number }[] = [];
  for (const row of rows.filter((r) => r.date <= date)) {
    const candidates = lines
      .filter((l) => !used.has(l.line_id) && Math.abs(l.amount - row.amount) < 0.005)
      .map((l) => ({ l, gap: Math.abs(moment(l.entry_date).diff(moment(row.date), 'days')) }))
      .filter((c) => c.gap <= maxDays)
      .sort((a, b) => a.gap - b.gap);
    if (candidates.length) {
      used.add(candidates[0].l.line_id);
      pairs.push({ row, line_id: candidates[0].l.line_id });
    } else {
      unmatched.push(row);
    }
  }
  return { matched: [...used], pairs, unmatched };
};
