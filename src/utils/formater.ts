import moment from "moment";

/** ຕົວເລກມີທົດສະນິຍົມ 2 ຕຳແໜ່ງ — "1234.5" → "1,234.50" (ໃຊ້ເປັນ formatter ຂອງ InputNumber) */
export function toThousands(value: unknown): string {
  const num = Number(String(value ?? 0).replace(/[% ,]/g, ""));
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// parse api/form date ("YYYY-MM-DD", "DD/MM/YYYY", ISO, Date) -> Date | null
export const toDateValue = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const parsed = moment(value, ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", moment.ISO_8601], true);
  if (parsed.isValid()) return parsed.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// format date for api payload -> "YYYY-MM-DD" ("" when empty) — toDateOnly ຂອງ api-bansi ຮັບໄດ້
export const toSubmitDate = (value?: Date | string | null): string => {
  const date = toDateValue(value);
  return date ? moment(date).format("YYYY-MM-DD") : "";
};
