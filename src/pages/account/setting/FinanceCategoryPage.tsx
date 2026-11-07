import { useRef, useState, type KeyboardEvent } from 'react';
import { Form, Loader, Textarea, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { Notific } from '../../../utils/Notification';
import type { FinanceSubCategory } from '../../../utils/selectOption';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SearchBox, SettingModal } from './settingKit';
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
  /** ທຸກລາຍການຍ່ອຍ (ລວມທີ່ປິດ) ຕາມລຳດັບ */
  subs?: FinanceSubCategory[];
};

/** ແຖວລາຍການຍ່ອຍໃນຟອມ — key ໃຊ້ພາຍໃນຟອມເທົ່ານັ້ນ */
type SubRow = { key: number; _uuid?: number; name: string; status: number };
let subSeq = 0;

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
  const [subs, setSubs] = useState<SubRow[]>(() => (data?.subs ?? []).map((s) => ({ key: ++subSeq, _uuid: s._uuid, name: s.name, status: Number(s.status) })));
  /** ຊ່ອງພິມເພີ່ມລາຍການຍ່ອຍທ້າຍລາຍການ — Enter = ເພີ່ມ ແລ້ວພິມອັນຕໍ່ໄປໄດ້ເລີຍ */
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);
  const [inputs, setInputs] = useState<any>({
    type_code: data?.type_code ?? suggestCode(codes, isIncome ? 'IN-' : 'EX-'),
    type_name: data?.type_name ?? '',
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    type_code: requiredField(t('inputRequired'), 'string'),
    type_name: requiredField(t('inputRequired'), 'string'),
  });

  const keyOf = (name: string) => name.trim().toLowerCase();
  const named = subs.filter((r) => r.name.trim());
  const dupes = new Set(named.map((r) => keyOf(r.name)).filter((n, i, all) => all.indexOf(n) !== i));
  const activeCount = named.filter((r) => r.status).length;
  const draftDupe = !!draft.trim() && named.some((r) => keyOf(r.name) === keyOf(draft));

  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    if (draftDupe) return Notific.warning('fcSubDuplicate');
    setSubs((list) => [...list, { key: ++subSeq, name, status: 1 }]);
    setDraft('');
    draftRef.current?.focus();
  };
  const updateSub = (key: number, patch: Partial<SubRow>) => setSubs((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  /** Enter ໃນແຖວທີ່ແກ້ຢູ່ = ໄປຊ່ອງເພີ່ມລາຍການຍ່ອຍ */
  const onSubKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    draftRef.current?.focus();
  };
  const onDraftKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    addDraft();
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (dupes.size || draftDupe) return Notific.warning('fcSubDuplicate');
    // ພິມໃນຊ່ອງເພີ່ມແລ້ວ ແຕ່ຍັງບໍ່ກົດ Enter — ບັນທຶກນຳ ບໍ່ໃຫ້ຫາຍ
    const rows = draft.trim() ? [...named, { key: 0, name: draft, status: 1 }] : named;
    const payload = rows.map((r) => ({ _uuid: r._uuid, name: r.name.trim(), status: r.status }));
    const ok = await runSave(
      () => saveSetting('/finance-category', data?._uuid, { ...inputs, typestatus: kind, subs: payload, ...(data ? {} : { status: 1 }) }),
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
        <FormSection title={t('fcSubs')}
          note={named.length > 0 && <span className="acc-fc-subs-count"><b>{activeCount}</b> {t('active')}{named.length > activeCount && <> · {named.length - activeCount} {t('inactive')}</>}</span>}
        >
          <div className="is-wide acc-fc-subs">
            <p className="acc-fc-subs-hint"><i className="fa-solid fa-circle-info" /> {t('fcSubsNote')}</p>
            <div className="acc-fc-sub-list">
              {subs.length === 0 && (
                <div className="acc-fc-sub-empty">
                  <i className="fa-solid fa-list-ul" />
                  <span>{t('fcSubEmpty')}</span>
                </div>
              )}
              {subs.map((row, index) => {
                const on = !!row.status;
                const dupe = !!row.name.trim() && dupes.has(keyOf(row.name));
                return (
                  <div key={row.key} className={`acc-fc-sub${on ? '' : ' is-off'}${dupe ? ' has-error' : ''}`}>
                    <span className="acc-fc-sub-no">{index + 1}</span>
                    <input className="acc-fc-sub-name" value={row.name} maxLength={150} placeholder={t('fcSubPlaceholder')}
                      aria-label={`${t('fcSubs')} ${index + 1}`} onChange={(e) => updateSub(row.key, { name: e.target.value })} onKeyDown={onSubKey}
                    />
                    {row._uuid ? (
                      <label className={`acc-fc-sub-state${on ? ' is-on' : ''}`} title={t(on ? 'active' : 'inactive')}>
                        <Toggle size="sm" checked={on} onChange={(value) => updateSub(row.key, { status: value ? 1 : 0 })} />
                        <span>{t(on ? 'active' : 'inactive')}</span>
                      </label>
                    ) : (
                      <span className="acc-fc-sub-new"><i className="fa-solid fa-circle-plus" /> {t('fcSubNew')}</span>
                    )}
                    <button type="button" className="acc-fc-sub-remove" aria-label={`${t('delete')} ${row.name}`} title={t('delete')}
                      onClick={() => setSubs((list) => list.filter((r) => r.key !== row.key))}
                    >
                      <i className="fa-regular fa-trash-can" />
                    </button>
                  </div>
                );
              })}
              <div className={`acc-fc-sub-quick${draftDupe ? ' has-error' : ''}`}>
                <span className="acc-fc-sub-plus"><i className="fa-solid fa-plus" /></span>
                <input ref={draftRef} value={draft} maxLength={150} placeholder={t('fcSubQuick')} aria-label={t('fcSubAdd')}
                  autoFocus={!!data && !subs.length} onChange={(e) => setDraft(e.target.value)} onKeyDown={onDraftKey}
                />
                {draft.trim() ? (
                  <button type="button" className="acc-fc-sub-add" disabled={draftDupe} onClick={addDraft}>
                    {t('fcSubAddShort')} <kbd>Enter</kbd>
                  </button>
                ) : null}
              </div>
            </div>
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
      && (!q || `${r.type_code} ${r.type_name} ${r.description ?? ''} ${(r.subs ?? []).map((x) => x.name).join(' ')}`.toLowerCase().includes(q)))
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
        <SearchBox value={keyword} onChange={setKeyword} placeholder={t('accountTypeSearch')} grow />
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
                {(() => {
                  const on = (r.subs ?? []).filter((x) => Number(x.status) === 1);
                  return on.length ? (
                    <ul className="acc-fc-sub-chips" aria-label={t('fcSubs')}>
                      {on.slice(0, 5).map((x) => <li key={x._uuid}>{x.name}</li>)}
                      {on.length > 5 && <li className="is-more">+{on.length - 5}</li>}
                    </ul>
                  ) : null;
                })()}
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
