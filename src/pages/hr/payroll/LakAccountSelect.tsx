import { useEffect, useState } from 'react';
import { SelectPicker } from 'rsuite';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';

export type CashAccount = {
  _uuid: number;
  acountName: string;
  acount_number?: string | null;
  balance_treasury: number;
  banks?: { abbr?: string; url?: string | null } | null;
  treasury?: { currency?: { name?: string } | null } | null;
};

const BASE_CURRENCY = 'LAK';

/** ບັນຊີເງິນຄັງສະກຸນກີບ — ເງິນເດືອນ ແລະ ເງິນເບີກລ່ວງໜ້າ ຈ່າຍ/ຮັບໄດ້ສະເພາະສະກຸນນີ້ (backend ກວດຊ້ຳ) */
export const useLakAccounts = () => {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  useEffect(() => {
    getApi('/treasury-account/option')
      .then((res) => setAccounts((res.data?.data ?? [])
        .filter((a: CashAccount) => String(a.treasury?.currency?.name ?? '').toUpperCase() === BASE_CURRENCY)
        .map((a: CashAccount) => ({ ...a, balance_treasury: Number(a.balance_treasury) || 0 }))))
      .catch((error) => Notific.error(getErrorMessage(error)));
  }, []);
  return accounts;
};

/**
 * ເລືອກບັນຊີສະກຸນກີບ — ບໍ່ສະແດງຍອດເງິນຂອງບັນຊີ (ຄືກັບຟອມລາຍຈ່າຍ); direction out = ເງິນອອກ: ເຕືອນເມື່ອຍອດບໍ່ພໍ
 * (backend ກວດຊ້ຳ), in = ເງິນເຂົ້າ
 */
export const LakAccountSelect = ({ accounts, value, onChange, amount, direction = 'out' }: {
  accounts: CashAccount[];
  value: number | null;
  onChange: (id: number | null) => void;
  amount: number;
  direction?: 'in' | 'out';
}) => {
  const t = useT();
  const options = accounts.map((a) => ({
    value: a._uuid,
    label: [a.banks?.abbr, a.acountName, a.acount_number].filter(Boolean).join(' · '),
  }));
  const account = accounts.find((a) => a._uuid === value);
  const short = direction === 'out' && !!account && account.balance_treasury < amount;
  return (
    <>
      <SelectPicker block data={options} value={value} onChange={onChange} searchable={options.length > 6} cleanable={false}
        placeholder={accounts.length ? t('select') : t('payNoLakAccount')} popupClassName="acc-book-menu"
      />
      {short && <small className="pay-field-hint is-bad"><i className="fa-solid fa-triangle-exclamation" /> {t('payNotEnough')}</small>}
    </>
  );
};
