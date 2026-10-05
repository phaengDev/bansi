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
    label: `${account.acountName} ${account.acount_number ?? ''} ${account.banks?.abbr ?? ''} ${currency?.name ?? ''}`,
    value: account._uuid,
    account,
    symbol: currencySymbol(currency),
    /** ລະຫັດສະກຸນເງິນ ເຊັ່ນ LAK / THB — ສະແດງແທນຍອດເງິນເມື່ອເຊື່ອງຍອດ */
    currency: currency?.name ?? '',
  };
};

/**
 * ບັນຊີໃນ picker — ໂລໂກ້ທະນາຄານ + ຊື່ + ທະນາຄານ · ເລກບັນຊີ + ຍອດໃຊ້ໄດ້ (noBank = ປ້າຍບັນຊີບໍ່ຜູກທະນາຄານ).
 * showBalance = false ເຊື່ອງຍອດເງິນ (ຟອມລາຍຮັບ — ຜູ້ບັນທຶກບໍ່ຈຳເປັນເຫັນຍອດບັນຊີ) ແລະ ສະແດງສະກຸນເງິນແທນ
 * ໃຫ້ຮູ້ວ່າເປັນບັນຊີກີບ ຫຼື ເງິນຕາຕ່າງປະເທດ
 */
export const renderAccountOption = (noBank: string, showBalance = true) => (_: unknown, item: any) => {
  const account: TreasuryAccount | undefined = item?.account;
  if (!account) return null;
  return (
    <span className="acc-xfer-opt">
      <span className="acc-xfer-logo">
        {account.banks?.url ? <img src={account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
      </span>
      <span className="acc-xfer-opt-text">
        <b>{account.acountName}</b>
        <small>{[account.banks?.abbr ?? noBank, account.acount_number].filter(Boolean).join(' · ')}</small>
      </span>
      {showBalance
        ? <em>{item.symbol} {formatNumber(account.balance_treasury)}</em>
        : item.currency && <em className="acc-xfer-cur">{item.symbol !== item.currency ? `${item.symbol} ` : ''}{item.currency}</em>}
    </span>
  );
};

/** ລາຍການບັນຊີກວ້າງກວ່າຊ່ອງ — ຊື່ບັນຊີຍາວ + ຍອດເງິນ ບໍ່ຖືກຕັດ */
export const ACCOUNT_POPUP_STYLE = { minWidth: 420 };
