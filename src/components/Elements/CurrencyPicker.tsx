import { Form, SelectPicker, type SelectPickerProps } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { useCurrency, type CurrencyOption } from '../../utils/selectOption';
import CurrencyFlag from './CurrencyFlag';

/**
 * ຊ່ອງເລືອກສະກຸນເງິນ ອັນດຽວຂອງທັງລະບົບ — ທຸງ + ລະຫັດ + ຊື່ລາວ + ສັນຍາລັກ, ຄົ້ນຫາໄດ້ທັງລະຫັດ ແລະ ຊື່ລາວ.
 * ຂໍ້ມູນມາຈາກ useCurrency() (ໂຫຼດເທື່ອດຽວ ໃຊ້ຮ່ວມກັນ). ແກ້ຮູບແບບບ່ອນນີ້ = ປ່ຽນທຸກຟອມ:
 * ຜັງບັນຊີ, ປະເພດບັນຊີ, ບັນທຶກທົ່ວໄປ, ໃບແຈ້ງໜີ້/ໃບບິນ ລູກໜີ້-ເຈົ້າໜີ້
 */

/** ແຖວສະກຸນເງິນໃນລາຍການ ແລະ ຄ່າທີ່ເລືອກ */
export const currencyOptionLabel = (_: unknown, item?: CurrencyOption | null) => item && (
  <span className="cur-opt">
    <CurrencyFlag icon={item.icon} currency={item.label} />
    <b>{item.label}</b>
    {item.laos && <small>{item.laos}</small>}
    {item.genus && <em>{item.genus}</em>}
  </span>
);

export type CurrencyPickerProps = Omit<SelectPickerProps<number>, 'data' | 'value' | 'onChange'> & {
  value?: number | null;
  onChange?: (value: number | null, option: CurrencyOption | undefined) => void;
  /** ສະກຸນທີ່ບໍ່ໃຫ້ເລືອກ (ເຊັ່ນ ສະກຸນດຽວກັນກັບອີກຊ່ອງ) */
  exclude?: number[];
};

export const CurrencyPicker = ({ value, onChange, exclude, placeholder, ...rest }: CurrencyPickerProps) => {
  const t = useT();
  const currencies = useCurrency();
  const data = exclude?.length ? currencies.filter((c) => !exclude.includes(c.value)) : currencies;
  return (
    <SelectPicker<number>
      block
      data={data}
      value={value ?? null}
      onChange={(next) => onChange?.(next ?? null, currencies.find((c) => c.value === next))}
      loading={currencies.loading}
      placeholder={placeholder ?? t('select')}
      searchable={data.length > 5}
      searchBy={(keyword, _label, item) => {
        const q = keyword.trim().toLowerCase();
        const c = item as unknown as CurrencyOption;
        return !q || [c.label, c.laos, c.genus].some((x) => String(x ?? '').toLowerCase().includes(q));
      }}
      renderOption={(label, item) => currencyOptionLabel(label, item as unknown as CurrencyOption)}
      renderValue={(v, item) => currencyOptionLabel(v, item as unknown as CurrencyOption)}
      popupClassName="acc-book-menu"
      locale={{ searchPlaceholder: t('search') }}
      {...rest}
    />
  );
};

/** ຊ່ອງເລືອກສະກຸນເງິນໃນ <Form> ຂອງ rsuite (ມີ label, * ແລະ ຂໍ້ຄວາມ error ຂອງ model) */
export const CurrencyField = ({ name, label, required = true, className, ...rest }: Omit<CurrencyPickerProps, 'value' | 'onChange'> & {
  name: string;
  label: string;
  required?: boolean;
}) => (
  <Form.Group controlId={`${name}-1`} className={className}>
    <Form.Label className="form-label">
      {label}
      {required && <span className="text-danger">*</span>}
    </Form.Label>
    {/* prop ຂອງ SelectPicker (onSelect…) ບໍ່ກົງ type ກັບ Form.Control — ສົ່ງຕໍ່ໃຫ້ accepter ຕາມເດີມ */}
    <Form.Control name={name} accepter={CurrencyPicker} {...(rest as Record<string, unknown>)} />
  </Form.Group>
);

export default CurrencyPicker;
