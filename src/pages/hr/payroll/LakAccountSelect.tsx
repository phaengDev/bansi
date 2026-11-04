import { useEffect, useState, type ReactNode } from 'react';
import { SelectPicker } from 'rsuite';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { kip } from './payrollApi';

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
 * ເລືອກບັນຊີສະກຸນກີບ ພ້ອມຍອດໃຊ້ໄດ້ຂອງແຕ່ລະບັນຊີ ແລະ ຍອດຫຼັງລາຍການ.
 * direction out = ເງິນອອກ (ຍອດບໍ່ພໍເປັນສີແດງ), in = ເງິນເຂົ້າ
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
    balance: a.balance_treasury,
  }));
  const account = accounts.find((a) => a._uuid === value);
  const after = account ? account.balance_treasury + (direction === 'in' ? amount : -amount) : null;
  return (
    <>
      <SelectPicker block data={options} value={value} onChange={onChange} searchable={options.length > 6} cleanable={false}
        placeholder={accounts.length ? t('select') : t('payNoLakAccount')} popupClassName="acc-book-menu"
        renderOption={(label: ReactNode, item: Record<string, unknown>) => (
          <span className="pay-acc-opt">
            <span>{label}</span>
            <em className={direction === 'out' && Number(item.balance) < amount ? 'is-bad' : ''}>₭ {kip(Number(item.balance))}</em>
          </span>
        )}
      />
      {account && (
        <small className={`pay-field-hint${after! < 0 ? ' is-bad' : ''}`}>
          {t('payBalance')} {kip(account.balance_treasury)} → {t('payAfter')} {kip(after!)}
        </small>
      )}
    </>
  );
};
