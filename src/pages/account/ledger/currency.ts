/**
 * ສັນຍາລັກສະກຸນເງິນ (₭, $, ฿) — ເກັບຢູ່ tbl_currency.genus; `icon` ເປັນທຸງ ຈຶ່ງບໍ່ໃຊ້ໃນໜ້າບັນຊີເງິນຄັງ.
 * ບໍ່ມີ genus ກໍ່ໃຊ້ລະຫັດ (LAK) ແທນ.
 */
export const currencySymbol = (c?: { genus?: string; name?: string } | null) => c?.genus || c?.name || '';
