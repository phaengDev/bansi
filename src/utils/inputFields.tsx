import type { FormControlProps } from "rsuite";
import { Form, InputGroup } from "rsuite";
import type { KeyboardEvent, ReactNode } from "react";
import { useMemo } from "react";
import { useT } from "../context/LanguageContext";

/** ກັນ Enter ໃນ Textarea ບໍ່ໃຫ້ submit ຟອມ — ໃຫ້ຂຶ້ນແຖວໃໝ່ຢ່າງດຽວ */
export const stopEnterSubmit = (event: KeyboardEvent) => {
  if (event.key === "Enter") event.stopPropagation();
};

export interface PickerDataItem<T = string | number> {
  label: string;
  value: T;
  group?: string;
}

export interface TextFieldProps extends Omit<FormControlProps, "name"> {
  name?: string;
  label?: string;
  accepter?: React.ElementType;
  size?: string;
  block?: boolean;
  data?: PickerDataItem[];
  oneTap?: boolean;
  placeholder?: string;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  groupBy?: string;
  labelKey?: string;
  valueKey?: string;
  className?: string;
  format?: string;
  /** ສະແດງ * ຫຼັງ label — ຕັ້ງເປັນ false ສຳລັບຊ່ອງທີ່ບໍ່ບັງຄັບ */
  required?: boolean;
  cleanable?: boolean;
  placement?: string;
  rows?: number;
  shouldDisableDate?: (date: Date) => boolean;

  /** ✅ New: Support formatter for Input or NumberInput */
  formatter?: (value: any) => string;
  parser?: (value: string) => any;
  /** ເຊື່ອງ/ສະແດງປຸ່ມເພີ່ມ-ຫຼຸດຂອງ NumberInput */
  controls?: boolean | ((trigger: "up" | "down") => ReactNode);
}

export function InputField({
  name,
  label,
  size,
  block,
  format,
  icon,
  data,
  oneTap,
  placeholder,
  accepter,
  iconPosition = "start",
  groupBy,
  labelKey,
  valueKey,
  className,
  required = true,
  cleanable,
  placement,
  formatter,
  parser,
  ...rest
}: TextFieldProps) {
  const t = useT();
  const translatedLabel = label ? t(label) : label;
  const translatedPlaceholder = placeholder ? t(placeholder) : placeholder;
  const translatedData = useMemo(() => {
    return data?.map((item) => ({
      ...item,
      label: typeof item?.label === "string" ? t(item?.label) : item?.label,
      group: typeof item?.group === "string" ? t(item?.group) : item?.group,
    }));
  }, [data, t]);

  // ສົ່ງສະເພາະ prop ທີ່ມີຄ່າແທ້ — prop ທີ່ເປັນ undefined ຍັງຄົງຢູ່ໃນ props object ແລ້ວ RSuite
  // ຈະສົ່ງຕໍ່ລົງ DOM ຂອງ accepter ທີ່ບໍ່ຮູ້ຈັກມັນ (ເຊັ່ນ oneTap/groupBy/labelKey ໃສ່ <input>) → React ເຕືອນ unknown prop
  const controlProps = Object.fromEntries(
    Object.entries({
      size,
      block,
      format,
      oneTap,
      groupBy,
      labelKey,
      valueKey,
      className,
      /** ✅ Apply formatter/parser */
      formatter,
      parser,
      cleanable,
      placement,
      data: translatedData,
      placeholder: translatedPlaceholder,
    }).filter(([, value]) => value !== undefined)
  );

  return (
    <Form.Group controlId={`${name}-1`} className="mb-2">
      {label && (
        <Form.Label className="fs-5 form-label">
          {translatedLabel}
          {required && <span className="text-danger">*</span>}
        </Form.Label>
      )}

      {icon ? (
        <InputGroup inside className="overflow-visible">
          {iconPosition === "start" && (
            <InputGroup.Addon className="mx-2">{icon}</InputGroup.Addon>
          )}
          <Form.Control
            {...(name ? { name } : {})}
            accepter={accepter}
            {...rest}
            {...controlProps}
          />
          {iconPosition === "end" && (
            <InputGroup.Addon>{icon}</InputGroup.Addon>
          )}
        </InputGroup>
      ) : (
        <Form.Control
          {...(name ? { name } : {})}
          accepter={accepter}
          {...rest}
          {...controlProps}
        />
      )}
    </Form.Group>
  );
}
