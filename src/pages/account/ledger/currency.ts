/**
 * ສັນຍາລັກສະກຸນເງິນ (₭, $, ฿) — ເກັບຢູ່ tbl_currency.genus; `icon` ເປັນທຸງ ຈຶ່ງບໍ່ໃຊ້ໃນໜ້າບັນຊີເງິນຄັງ.
 * ບໍ່ມີ genus ກໍ່ໃຊ້ລະຫັດ (LAK) ແທນ.
 */
export const currencySymbol = (c?: { genus?: string; name?: string } | null) => c?.genus || c?.name || '';

/** ເງິນກີບ (ສະກຸນຫຼັກ) */
export const isKip = (c?: { genus?: string; name?: string } | null) => /^(LAK|KIP)$/i.test(c?.name ?? '') || c?.genus === '₭';

/** ສີຂອງປ້າຍສະກຸນເງິນ (ເບິ່ງປຸບຮູ້ວ່າກຸ່ມ / ບັນຊີເປັນສະກຸນໃດ): ກີບ ຟ້າ, USD ຂຽວ, THB ສົ້ມ, ອື່ນໆ ເທົາ */
export const currencyTone = (c?: { genus?: string; name?: string } | null) => {
  if (isKip(c)) return 'is-lak';
  const code = String(c?.name ?? '').toUpperCase();
  return code === 'USD' ? 'is-usd' : code === 'THB' ? 'is-thb' : '';
};

/** ເງິນກີບຂຶ້ນກ່ອນ, ສະກຸນອື່ນຄົງລຳດັບເດີມ */
export const kipFirst = <T>(list: T[], currencyOf: (item: T) => { genus?: string; name?: string } | null | undefined) =>
  [...list].sort((a, b) => Number(isKip(currencyOf(b))) - Number(isKip(currencyOf(a))));
