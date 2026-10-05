import { useMemo, useState, type ReactNode } from 'react';
import { AutoComplete, Button } from 'rsuite';
import { formatNumber } from '../../../utils/configApi';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { AP, AR, usePartners, type Partner } from '../arap/arapApi';
import { PartnerForm } from '../arap/PartnerPage';

/** ລູກຄ້າ/ຄູ່ຄ້າ ທີ່ແນບມາກັບລາຍຮັບ-ລາຍຈ່າຍ (include "partner" ຂອງ /income/fetch, /expense/fetch) */
export type PartnerRef = { _uuid: number; partner_code: string; name: string; phone?: string | null; partner_type: number };

/** ຄ່າຂອງຊ່ອງ — ເລືອກຈາກລາຍຊື່ (partner + ຊື່ຂອງມັນ) ຫຼື ພິມເອງ (partner = null) */
export type CustomerValue = { partner: PartnerRef | null; name: string };

type Side = 'income' | 'expense';

/** partner_type ທີ່ເລືອກໄດ້ — ກົງກັບ INCOME_/EXPENSE_PARTNER_TYPES ຂອງ api-bansi (journalHelpers.ts) */
const TYPES: Record<Side, number[]> = { income: [1, 3], expense: [1, 2, 3] };
const isSupplier = (p: { partner_type: number }) => [2, 3].includes(Number(p.partner_type));
/** ຊື່ທີ່ປ້ອນເອງຍາວສຸດ (ຖັນ STRING ຂອງ backend) */
const MAX_NAME = 150;
/** value ຂອງຕົວເລືອກ — ບໍ່ແມ່ນຊື່ ເພາະຊື່ຊ້ຳກັນໄດ້; onChange ທີ່ໄດ້ຄ່ານີ້ຖືກຂ້າມ (onSelect ຈັດການແລ້ວ) */
const KEY = '\u0000partner:';

type Option = {
  value: string;
  label: string;
  partner: PartnerRef;
  supplier: boolean;
  owes: number;
  docs: number;
  order: number;
};

/** ໄອຄອນ + ຊື່ + ລະຫັດ/ເບີໂທ ຂອງລູກຄ້າໃນລາຍຊື່ — ໃຊ້ທັງໃນລາຍການແນະນຳ ແລະ ໜ້າລາຍລະອຽດ */
export const PartnerLabel = ({ partner, children }: { partner: PartnerRef; children?: ReactNode }) => {
  const supplier = isSupplier(partner);
  return (
    <span className="acc-cust-opt">
      <span className={`acc-cust-icon${supplier ? ' is-supplier' : ''}`}>
        <i className={`fa-solid ${supplier ? 'fa-truck-field' : 'fa-user'}`} />
      </span>
      <span className="acc-cust-text">
        <b>{partner.name}</b>
        <small>{[partner.partner_code, partner.phone].filter(Boolean).join(' · ')}</small>
      </span>
      {children}
    </span>
  );
};

/** ລູກຄ້າຂອງລາຍການ (ໜ້າລາຍລະອຽດ) — ຄົນໃນລາຍຊື່ ຫຼື ຊື່ທີ່ພິມເອງ */
export const CustomerLabel = ({ partner, name }: { partner?: PartnerRef | null; name?: string | null }) => {
  const t = useT();
  if (partner) return <PartnerLabel partner={partner} />;
  return (
    <span className="acc-cust-opt">
      <span className="acc-cust-icon is-manual"><i className="fa-solid fa-pen" /></span>
      <span className="acc-cust-text">
        <b>{name || '—'}</b>
        <small>{t('custManualShort')}</small>
      </span>
    </span>
  );
};

/**
 * ຊ່ອງລູກຄ້າ (ລາຍຮັບ) / ລູກຄ້າ-ຜູ້ສະໜອງ (ລາຍຈ່າຍ) — ບໍ່ບັງຄັບ. ພິມຊື່ເອງໄດ້ເລີຍ ຫຼື ເລືອກຈາກລາຍຊື່ ລູກໜີ້/ເຈົ້າໜີ້
 * (tbl_partner) ທີ່ຂຶ້ນມາໃຫ້ຕອນພິມ; ຄົນທີ່ຍັງມີໜີ້ຄ້າງຂຶ້ນກ່ອນ ພ້ອມຍອດຄ້າງ. ແກ້ຊື່ຫຼັງເລືອກ = ກາຍເປັນປ້ອນເອງ.
 * ຊື່ທີ່ພິມເອງ ບັນທຶກເປັນລູກຄ້າໃໝ່ໄດ້ຈາກບ່ອນນີ້ (ເລືອກໃຫ້ອັດຕະໂນມັດ).
 * ລາຍການນີ້ບໍ່ຕັດໜີ້ — ຖ້າເລືອກຄົນທີ່ມີໜີ້ຄ້າງ ຈະບອກໃຫ້ໄປໃຊ້ ຮັບຊຳລະ/ຈ່າຍຊຳລະ ແທນ
 */
const CustomerField = ({ side, value, onChange, current }: {
  side: Side;
  value: CustomerValue;
  onChange: (next: CustomerValue) => void;
  /** ລູກຄ້າເດີມຂອງລາຍການທີ່ກຳລັງແກ້ໄຂ — ສະແດງໄດ້ເຖິງວ່າປິດໃຊ້ງານແລ້ວ ຫຼື ລາຍຊື່ຍັງໂຫຼດບໍ່ແລ້ວ */
  current?: PartnerRef | null;
}) => {
  const t = useT();
  const { rows, reload } = usePartners();
  const [adding, setAdding] = useState(false);
  const isIncome = side === 'income';
  const { partner, name } = value;

  const options = useMemo<Option[]>(() => {
    const toOption = (p: PartnerRef & Partial<Partner>): Option => {
      const owes = Number(isIncome ? p.ar_open : p.ap_open) || 0;
      const supplier = isSupplier(p);
      return {
        value: `${KEY}${p._uuid}`,
        label: p.name,
        partner: { _uuid: p._uuid, partner_code: p.partner_code, name: p.name, phone: p.phone, partner_type: p.partner_type },
        supplier,
        owes,
        docs: Number(isIncome ? p.ar_docs : p.ap_docs) || 0,
        // ລາຍຮັບ: ລູກໜີ້ທີ່ຍັງຄ້າງ → ລູກຄ້າ; ລາຍຈ່າຍ: ເຈົ້າໜີ້ທີ່ຍັງຄ້າງ → ຜູ້ສະໜອງ → ລູກຄ້າ
        order: owes > 0 ? 0 : !isIncome && supplier ? 1 : 2,
      };
    };
    const list = rows
      .filter((p) => (Number(p.status) === 1 || p._uuid === partner?._uuid) && TYPES[side].includes(Number(p.partner_type)))
      .map(toOption);
    if (current && !list.some((o) => o.partner._uuid === current._uuid)) list.push(toOption(current));
    return list.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [rows, partner?._uuid, current, side, isIncome]);

  const selected = partner ? options.find((o) => o.partner._uuid === partner._uuid) : undefined;
  const typed = name.trim();

  // ຍັງບໍ່ໄດ້ພິມ ຫຼື ຊື່ຍັງກົງກັບຄົນທີ່ເລືອກ → ສະແດງທັງໝົດ; ພິມແລ້ວ → ກັ່ນຕາມ ຊື່/ລະຫັດ/ເບີໂທ
  const filterBy = (keyword: string, item: unknown) => {
    const q = keyword.trim().toLowerCase();
    if (!q || (partner && keyword === partner.name)) return true;
    const p = (item as Option).partner;
    return [p.name, p.partner_code, p.phone].some((v) => String(v ?? '').toLowerCase().includes(q));
  };

  const renderOption = (_: unknown, item: unknown) => {
    const { partner: p, owes } = item as Option;
    return (
      <PartnerLabel partner={p}>
        {owes > 0 && (
          <em className="acc-cust-owes">{t(isIncome ? 'incomeCustomerOwes' : 'expensePartyOwes')} ₭{formatNumber(owes)}</em>
        )}
      </PartnerLabel>
    );
  };

  const type = (text: string) => {
    if (text.startsWith(KEY)) return;
    // ແກ້ຊື່ຫຼັງເລືອກແລ້ວ → ບໍ່ແມ່ນຄົນໃນລາຍຊື່ອີກ (ປ້ອນເອງ)
    onChange({ partner: partner && text === partner.name ? partner : null, name: text.slice(0, MAX_NAME) });
  };

  const icon = partner
    ? (isSupplier(partner) ? 'fa-truck-field' : 'fa-user')
    : typed ? 'fa-pen' : 'fa-magnifying-glass';

  return (
    <div className="is-wide rs-form-group">
      <label className="form-label">{t(isIncome ? 'incomeCustomer' : 'expenseParty')}</label>
      <div className="acc-cust-field">
        <div className={`acc-cust-box${partner ? ' is-linked' : typed ? ' is-manual' : ''}${partner && isSupplier(partner) ? ' is-supplier' : ''}`}>
          <span className="acc-cust-box-icon"><i className={`fa-solid ${icon}`} /></span>
          <AutoComplete
            data={options}
            value={name}
            onChange={(v) => type(String(v ?? ''))}
            onSelect={(_, item) => {
              const p = (item as unknown as Option).partner;
              onChange({ partner: p, name: p.name });
            }}
            filterBy={filterBy}
            renderOption={renderOption}
            placeholder={t(isIncome ? 'incomeCustomerPlaceholder' : 'expensePartyPlaceholder')}
            popupClassName="acc-cust-menu"
          />
          {name && (
            <button type="button" className="acc-cust-clear" title={t('custClear')} aria-label={t('custClear')}
              onClick={() => onChange({ partner: null, name: '' })}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        {canCreate && (
          <Button className="acc-cust-add" onClick={() => setAdding(true)}>
            <i className="fa-solid fa-user-plus" /> {t('incomeCustomerNew')}
          </Button>
        )}
      </div>

      {partner ? (
        <p className="acc-cust-state is-linked">
          <i className="fa-solid fa-circle-check" />
          <span>{t('custLinked')}</span>
          {[partner.partner_code, partner.phone].filter(Boolean).map((v) => <b key={String(v)}>{v}</b>)}
        </p>
      ) : typed && (
        <p className="acc-cust-state is-manual">
          <i className="fa-solid fa-pen" />
          <span>{t('custManual')}</span>
          {canCreate && (
            <button type="button" onClick={() => setAdding(true)}>
              <i className="fa-solid fa-user-plus" /> {t(isIncome ? 'custSaveAsCustomer' : 'custSaveAsParty')}
            </button>
          )}
        </p>
      )}

      {selected && selected.owes > 0 && (
        <p className="acc-cust-hint">
          <i className="fa-solid fa-circle-info" />
          <span>
            {t(isIncome ? 'incomeCustomerDebtHint' : 'expensePartyDebtHint')} ₭{formatNumber(selected.owes)} ({selected.docs} {t('incomeCustomerDocs')})
            {' — '}{t(isIncome ? 'incomeCustomerDebtUse' : 'expensePartyDebtUse')}
          </span>
        </p>
      )}

      {adding && (
        <PartnerForm
          kind={isIncome ? AR : AP}
          data={null}
          initialName={partner ? '' : typed}
          partners={rows}
          onClose={() => setAdding(false)}
          onSaved={(created) => {
            reload();
            if (created) onChange({ partner: created, name: created.name });
          }}
        />
      )}
    </div>
  );
};

export default CustomerField;
