/** ສີຂອງກ່ອງລະຫັດ — ໝຸນຕາມລະຫັດໝວດ ໃຫ້ໝວດ ແລະ ປະເພດທີ່ຢູ່ໃນໝວດນັ້ນສີດຽວກັນ (class ຢູ່ _account-setting.scss) */
const TONES = ['is-blue', 'is-emerald', 'is-violet', 'is-gold', 'is-coral', 'is-sky'];

export const toneOf = (code: string) =>
  TONES[[...(code ?? '')].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
