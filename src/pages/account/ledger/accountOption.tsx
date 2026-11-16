import { formatNumber } from '../../../utils/configApi';
import type { AccountType } from '../setting/AccountTypeForm';
import type { TreasuryAccount } from './TreasuryAccountForm';
import { currencySymbol } from './currency';

/**
 * ຕົວເລືອກບັນຊີເງິນຄັງສຳລັບ PickerField (ໂອນເງິນ, ລາຍຮັບ …) — label ເປັນຂໍ້ຄວາມໃຫ້ຊ່ອງຄົ້ນຫາ,
 * ສ່ວນທີ່ສະແດງແທ້ແມ່ນ renderAccountOption
 */
export const accountOption = (account: TreasuryAccount, type?: AccountType) => {
  const currency = (type ?? account.treasury)?.currency;
  return {
    label: `${account.account_code ?? ''} ${account.acountName} ${account.acount_number ?? ''} ${account.banks?.abbr ?? ''} ${currency?.name ?? ''}`,
    value: account._uuid,
    account,
    symbol: currencySymbol(currency),
    /** ລະຫັດສະກຸນເງິນ ເຊັ່ນ LAK / THB */
    currency: currency?.name ?? '',
  };
};

/**
 * ບັນຊີໃນ picker (ລາຍຮັບ, ລາຍຈ່າຍ, ໂອນເງິນ, ຮັບ/ຈ່າຍຊຳລະ — ແບບດຽວກັນທຸກບ່ອນ): ໂລໂກ້ທະນາຄານ + ຊື່ +
 * ລະຫັດບັນຊີ · ທະນາຄານ · ເລກບັນຊີ (noBank = ປ້າຍບັນຊີບໍ່ຜູກທະນາຄານ) + ຍອດໃຊ້ໄດ້ ແລະ ສະກຸນເງິນ
 */
export const renderAccountOption = (noBank: string) => (_: unknown, item: any) => {
  const account: TreasuryAccount | undefined = item?.account;
  if (!account) return null;
  return (
    <span className="acc-xfer-opt">
      <span className="acc-xfer-logo">
        {account.banks?.url ? <img src={account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
      </span>
      <span className="acc-xfer-opt-text">
        <b>{account.acountName}</b>
        <small>{[account.account_code, account.banks?.abbr ?? noBank, account.acount_number].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="acc-xfer-opt-bal">
        <b>{item.symbol} {formatNumber(account.balance_treasury)}</b>
        {item.currency && <em className="acc-xfer-cur">{item.currency}</em>}
      </span>
    </span>
  );
};

/** ລະຫັດບັນຊີເງິນຄັງ (10211) — ປ້າຍນ້ອຍໜ້າຊື່ບັນຊີ ແບບດຽວກັນທຸກໜ້າ (ບັດ, ຕາຕະລາງ, ໂອນເງິນ) */
export const AccountCode = ({ code }: { code?: string | null }) =>
  code ? <span className="acc-code-tag">{code}</span> : null;

/** ລາຍການບັນຊີກວ້າງກວ່າຊ່ອງ — ຊື່ບັນຊີຍາວ + ຍອດເງິນ ບໍ່ຖືກຕັດ */
export const ACCOUNT_POPUP_STYLE = { minWidth: 420 };
