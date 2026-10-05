import { useRef, useState } from 'react';
import { Form, Input, InputGroup, Loader, Textarea, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from './settingKit';
import { nextCode, runSave, saveSetting, useSettingList } from './settingApi';

/** 1 = ປະເພດລາຍຮັບ, 2 = ປະເພດລາຍຈ່າຍ (tbl_finance_categories.typestatus) */
type Kind = 1 | 2;

type FinanceCategory = {
  _uuid: number;
  type_code: string;
  type_name: string;
  typestatus: Kind;
  description?: string;
  status: number;
};

/**
 * ລະຫັດຕໍ່ໄປຕາມຮູບແບບທີ່ໃຊ້ຢູ່ — ເອົາສ່ວນໜ້າຂອງລະຫັດທີ່ໃຫຍ່ສຸດ (1001-003 → "1001-") ແລ້ວ +1 → 1001-004.
 * ຍັງບໍ່ມີລະຫັດກໍ່ເລີ່ມຈາກ fallback (IN-001 / EX-001)
 */
const suggestCode = (codes: string[], fallback: string) => {
  const last = codes
    .map((c) => String(c ?? ''))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop();
  const prefix = last ? last.replace(/\d+$/, '') : fallback;
  return nextCode(prefix, codes.filter((c) => String(c ?? '').startsWith(prefix)));
};

const FinanceCategoryForm = ({ kind, data, codes, onClose, onSaved }: {
  kind: Kind;
  data: FinanceCategory | null;
  codes: string[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const isIncome = kind === 1;
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    type_code: data?.type_code ?? suggestCode(codes, isIncome ? 'IN-' : 'EX-'),
    type_name: data?.type_name ?? '',
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    type_code: requiredField(t('inputRequired'), 'string'),
    type_name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const ok = await runSave(
      () => saveSetting('/finance-category', data?._uuid, { ...inputs, typestatus: kind, ...(data ? {} : { status: 1 }) }),
      setSaving,
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal
      title={t(data ? (isIncome ? 'fcEditIncome' : 'fcEditExpense') : (isIncome ? 'fcAddIncome' : 'fcAddExpense'))}
      hint={t('fcHint')}
      icon={isIncome ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}
      saving={saving}
      onClose={onClose}
      onSubmit={submit}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="type_code" label={t('accountTypeCode')} />
            <InputField name="type_name" label={t('fcName')} />
          </div>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

type StatusFilter = 'all' | 'active' | 'inactive';

const isActive = (r: FinanceCategory) => Number(r.status) === 1;

/**
 * ປະເພດລາຍຮັບ / ປະເພດລາຍຈ່າຍ — ຕາຕະລາງດຽວກັນ (tbl_finance_categories) ແຍກດ້ວຍ typestatus.
 * ໃຊ້ຈັດກຸ່ມລາຍການຮັບ-ຈ່າຍ ເພື່ອລາຍງານ; ປິດໃຊ້ງານແທນການລຶບ ເພື່ອບໍ່ໃຫ້ລາຍການເກົ່າເສຍປະເພດ.
 * ຫົວສີຕາມປະເພດ (ຂຽວ = ລາຍຮັບ, ແດງ = ລາຍຈ່າຍ) + ຕົວເລກສະຫຼຸບ, ແຖບຄົ້ນຫາ/ສະຖານະ, ບັດທີ່ເປີດ-ປິດໃຊ້ງານໄດ້ເລີຍ.
 */
const FinanceCategoryPage = ({ kind }: { kind: Kind }) => {
  const t = useT();
  const isIncome = kind === 1;
  const icon = isIncome ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
  const { rows, loading, reload } = useSettingList<FinanceCategory>(`/finance-category/fetch/${kind}?limit=1000`);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<FinanceCategory | null | undefined>(undefined);

  const activeCount = rows.filter(isActive).length;
  const q = keyword.trim().toLowerCase();
  const shown = rows
    .filter((r) =>
      (status === 'all' || (status === 'active') === isActive(r))
      && (!q || `${r.type_code} ${r.type_name} ${r.description ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => String(a.type_code).localeCompare(String(b.type_code), undefined, { numeric: true }));
  const hasFilter = !!q || status !== 'all';
  const clearFilters = () => {
    setKeyword('');
    setStatus('all');
  };

  /** ເປີດ/ປິດໃຊ້ງານຈາກບັດເລີຍ — PUT ສະເພາະ status (backend ໃຊ້ instance.update ຈຶ່ງບໍ່ແຕະຖັນອື່ນ) */
  const toggleStatus = async (r: FinanceCategory, on: boolean) => {
    const ok = await runSave(
      () => saveSetting('/finance-category', r._uuid, { status: on ? 1 : 0 }),
      (busy) => setBusyId(busy ? r._uuid : null),
    );
    if (ok) reload();
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: rows.length },
    { key: 'active', label: t('active'), count: activeCount },
    { key: 'inactive', label: t('inactive'), count: rows.length - activeCount },
  ];

  return (
    <div className={`acc-fc acc-tone ${isIncome ? 'is-emerald' : 'is-coral'}`}>
      {/* ---- ຫົວ: ໄອຄອນ + ຊື່ + ສະຫຼຸບ + ປຸ່ມເພີ່ມ ---- */}
      <header className="acc-fc-hero">
        <span className="acc-fc-hero-icon"><i className={`fa-solid ${icon}`} /></span>
        <span className="acc-fc-hero-text">
          <h3>{t(isIncome ? 'accountSetIncomeType' : 'accountSetExpenseType')}</h3>
          <small>{t(isIncome ? 'fcIncomeHint' : 'fcExpenseHint')}</small>
        </span>
        <dl className="acc-fc-hero-stats">
          <div>
            <dt>{t('total')}</dt>
            <dd>{rows.length}</dd>
          </div>
          <div className="is-on">
            <dt>{t('active')}</dt>
            <dd>{activeCount}</dd>
          </div>
          <div className="is-off">
            <dt>{t('inactive')}</dt>
            <dd>{rows.length - activeCount}</dd>
          </div>
        </dl>
        <button type="button" className="acc-fc-add" disabled={!canCreate} onClick={() => setEditing(null)}>
          <i className="fa-solid fa-plus" /> {t(isIncome ? 'fcAddIncome' : 'fcAddExpense')}
        </button>
      </header>

      {/* ---- ຄົ້ນຫາ + ສະຖານະ ---- */}
      <div className="acc-fc-toolbar">
        <InputGroup inside className="acc-type-search">
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input placeholder={t('accountTypeSearch')} value={keyword} onChange={setKeyword} />
          {keyword && (
            <InputGroup.Button onClick={() => setKeyword('')} aria-label={t('cancel')}>
              <i className="fa-solid fa-xmark" />
            </InputGroup.Button>
          )}
        </InputGroup>
        <div className="acc-type-segment" role="tablist">
          {statusTabs.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={status === s.key}
              className={status === s.key ? 'is-active' : ''} onClick={() => setStatus(s.key)}
            >
              {s.label} <em>{s.count}</em>
            </button>
          ))}
        </div>
        {hasFilter && (
          <button type="button" className="acc-type-clear" onClick={clearFilters}>
            <i className="fa-solid fa-filter-circle-xmark" /> {t('accountTypeClearFilter')}
          </button>
        )}
      </div>

      {/* ---- ລາຍການ — ໂຫຼດຄືນຫຼັງເປີດ/ປິດ ບໍ່ລ້າງລາຍການອອກກ່ອນ (ບໍ່ກະພິບ) ---- */}
      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : shown.length ? (
        <div className="acc-fc-grid">
          {shown.map((r) => {
            const active = isActive(r);
            return (
              <article key={r._uuid} className={`acc-fc-card${active ? '' : ' is-off'}`}>
                <div className="acc-fc-card-top">
                  <span className="acc-fc-code">{r.type_code}</span>
                  <button type="button" className="acc-type-card-edit" disabled={!canEdit}
                    aria-label={t('edit')} title={t('edit')} onClick={() => setEditing(r)}
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                </div>
                <h4 title={r.type_name}>{r.type_name}</h4>
                <p className={r.description ? '' : 'is-empty'} title={r.description}>
                  {r.description || t('fcNoDescription')}
                </p>
                <footer>
                  <span className="acc-fc-kind">
                    <i className={`fa-solid ${icon}`} /> {t(isIncome ? 'fcKindIncome' : 'fcKindExpense')}
                  </span>
                  <label className={`acc-fc-switch${active ? ' is-on' : ''}`}>
                    <span>{active ? t('active') : t('inactive')}</span>
                    <Toggle size="sm" checked={active} loading={busyId === r._uuid}
                      disabled={!canEdit || busyId != null} onChange={(on) => toggleStatus(r, on)}
                    />
                  </label>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="acc-class-empty">
          <i className={`fa-solid ${hasFilter ? 'fa-filter-circle-xmark' : icon}`} />
          <p>{hasFilter ? t('fcNoMatch') : t('noData')}</p>
          {hasFilter ? (
            <button type="button" className="acc-type-clear mt-2" onClick={clearFilters}>
              {t('accountTypeClearFilter')}
            </button>
          ) : (
            <button type="button" className="acc-fc-add mt-2" disabled={!canCreate} onClick={() => setEditing(null)}>
              <i className="fa-solid fa-plus" /> {t(isIncome ? 'fcAddIncome' : 'fcAddExpense')}
            </button>
          )}
        </div>
      )}

      {editing !== undefined && (
        <FinanceCategoryForm
          kind={kind}
          data={editing}
          codes={rows.map((r) => r.type_code)}
          onClose={() => setEditing(undefined)}
          onSaved={reload}
        />
      )}
    </div>
  );
};

export default FinanceCategoryPage;
