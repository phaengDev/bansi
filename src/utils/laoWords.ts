/**
 * ຕົວເລກ → ຂໍ້ຄວາມພາສາລາວ ສຳລັບ "ຈຳນວນເງິນຂຽນເປັນຕົວໜັງສື" ໃນໃບເກັບເງິນ / ໃບຮັບເງິນ.
 * 11 = ສິບເອັດ, 21 = ຊາວເອັດ, 101 = ໜຶ່ງຮ້ອຍໜຶ່ງ, 45,455 = ສີ່ສິບຫ້າພັນສີ່ຮ້ອຍຫ້າສິບຫ້າ,
 * 250,000 = ສອງແສນຫ້າສິບພັນ, 1,000,000 = ໜຶ່ງລ້ານ, 1,000,000,000 = ໜຶ່ງຕື້. ທົດສະນິຍົມ = ຈຸດ + ຕົວເລກລະຕົວ
 */
const DIGITS = ['ສູນ', 'ໜຶ່ງ', 'ສອງ', 'ສາມ', 'ສີ່', 'ຫ້າ', 'ຫົກ', 'ເຈັດ', 'ແປດ', 'ເກົ້າ'];

/** 1–999 */
const underThousand = (n: number) => {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  let out = h ? `${DIGITS[h]}ຮ້ອຍ` : '';
  if (t) out += t === 1 ? 'ສິບ' : t === 2 ? 'ຊາວ' : `${DIGITS[t]}ສິບ`;
  if (u) out += u === 1 && t ? 'ເອັດ' : DIGITS[u];
  return out;
};

/** 1–999,999: ຫຼັກແສນ ໃຊ້ "ແສນ", ທີ່ເຫຼືອເປັນ "…ພັນ" */
const underMillion = (n: number) => {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  let out = '';
  if (thousands) {
    const lakh = Math.floor(thousands / 100);
    const tens = thousands % 100;
    if (lakh) out += `${DIGITS[lakh]}ແສນ`;
    if (tens) out += `${underThousand(tens)}ພັນ`;
  }
  if (rest) out += underThousand(rest);
  return out;
};

const integerWords = (n: number): string => {
  if (n === 0) return DIGITS[0];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const rest = n % 1e6;
  let out = '';
  if (billions) out += `${integerWords(billions)}ຕື້`;
  if (millions) out += `${underMillion(millions)}ລ້ານ`;
  if (rest) out += underMillion(rest);
  return out;
};

/** ຊື່ສະກຸນເງິນພາສາລາວ ຕາມລະຫັດ — ບໍ່ຮູ້ຈັກ = ລະຫັດເດີມ */
const CURRENCY_WORDS: Record<string, string> = { LAK: 'ກີບ', THB: 'ບາດ', USD: 'ໂດລາ', CNY: 'ຢວນ', EUR: 'ເອີໂຣ', VND: 'ດົ່ງ', JPY: 'ເຢນ' };

/**
 * ຈຳນວນເງິນເປັນຂໍ້ຄວາມ + ຊື່ສະກຸນເງິນ (ຕັ້ງຕົ້ນ ກີບ). ຕິດລົບ = "ລົບ…"; ທົດສະນິຍົມສູງສຸດ 2 ຕຳແໜ່ງ (ຈຸດ…)
 * ເຊັ່ນ 50000 → "ຫ້າສິບພັນກີບ", 1000.5 USD → "ໜຶ່ງພັນຈຸດຫ້າໂດລາ"
 */
export const amountInLaoWords = (value: number, currencyCode = 'LAK') => {
  const amount = Math.round(Math.abs(Number(value) || 0) * 100) / 100;
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  let out = integerWords(whole);
  if (cents) out += `ຈຸດ${String(cents).padStart(2, '0').replace(/0$/, '').split('').map((d) => DIGITS[Number(d)]).join('')}`;
  const code = String(currencyCode || 'LAK').toUpperCase();
  return `${Number(value) < 0 ? 'ລົບ' : ''}${out}${CURRENCY_WORDS[code] ?? code}`;
};
