import { Form, InputGroup, SelectPicker } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { GENDERS } from '../../pages/hr/hrApi';

/**
 * ຊ່ອງຊື່ ທີ່ມີ dropdown ເລືອກເພດຢູ່ທາງໜ້າ ເຊັ່ນ [♀ ເພດຍິງ ▾] ບົວລາຍ — ໃຊ້ຮ່ວມ: ຟອມພະນັກງານ, ລູກຄ້າສິນເຊື່ອ.
 * ຢູ່ພາຍໃນ <Form> (name = ຊ່ອງຊື່ຂອງ formValue); ເພດເກັບແຍກໃນ state ຂອງຟອມ (1 ຊາຍ, 2 ຍິງ)
 */
const NameWithGenderField = ({ name, label, placeholder, gender, onGender, required = true }: {
  name: string;
  label: string;
  placeholder?: string;
  gender: number;
  onGender: (value: number) => void;
  required?: boolean;
}) => {
  const t = useT();
  const options = GENDERS.map((g) => ({ value: g.value, label: t(g.long), icon: g.icon }));
  const genderLabel = (_: unknown, item: any) => item && (
    <span className={`hr-gender-value is-${item.value === 2 ? 'female' : 'male'}`}>
      <i className={`fa-solid ${item.icon}`} /> {item.label}
    </span>
  );
  return (
    <Form.Group controlId={`${name}-1`} className="mb-2">
      <Form.Label className="fs-5 form-label">
        {label}{required && <span className="text-danger">*</span>}
      </Form.Label>
      <InputGroup className="hr-name-field">
        <InputGroup.Addon className="hr-gender">
          <SelectPicker data={options} value={gender} onChange={(value) => value && onGender(value)}
            cleanable={false} searchable={false} appearance="subtle" size="sm" aria-label={t('hrGender')}
            popupClassName="acc-book-menu" renderValue={genderLabel} renderOption={genderLabel}
          />
        </InputGroup.Addon>
        <Form.Control name={name} placeholder={placeholder} />
      </InputGroup>
    </Form.Group>
  );
};

export default NameWithGenderField;
