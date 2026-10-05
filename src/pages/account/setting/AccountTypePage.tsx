import { useEffect, useMemo, useState } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import { deleteApi, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useCurrency } from '../../../utils/selectOption';
import { useT } from '../../../context/LanguageContext';
import type { AccountClass } from './AccountClassForm';
import AccountTypeForm, { type AccountType } from './AccountTypeForm';
import { toneOf } from './accountTone';

type StatusFilter = 'all' | 'active' | 'inactive';

const isActive = (r: AccountType) => Number(r.status) === 1;

const countBy = (list: AccountType[], key: 'typeId' | 'currencyId') =>
  list.reduce<Record<number, number>>((m, r) => {
    const k = Number(r[key]);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

/**
 * ປະເພດບັນຊີ — ດຶງທັງໝົດເທື່ອດຽວຈາກ POST /type-treasury/fetch (typeTreasuryController.getTypeTreasury)
 * ແລ້ວກັ່ນຕອງຢູ່ໜ້າ (ໝວດ / ສະກຸນເງິນ / ສະຖານະ / ຄຳຄົ້ນ) ເພື່ອໃຫ້ນັບຈຳນວນໃນແຕ່ລະ chip ໄດ້ທັນທີ.
 * ບັດຈັດກຸ່ມຕາມໝວດບັນຊີ ແລະ ພັບກຸ່ມໄດ້.
 */
const AccountTypePage = () => {
  const t = useT();
  const currencies = useCurrency();
  const [rows, setRows] = useState<AccountType[]>([]);
  const [classes, setClasses] = useState<AccountClass[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [typeId, setTypeId] = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  /** undefined = ປິດຟອມ, null = ເພີ່ມໃໝ່, ມີແຖວ = ແກ້ໄຂແຖວນັ້ນ */
  const [editing, setEditing] = useState<AccountType | null | undefined>(undefined);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await postApi('/type-treasury/fetch', {}, { params: { limit: 1000 } });
      setRows(res.data?.data || []);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await getApi('/type-account/option');
      setClasses(res.data?.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchData();
  }, []);

  /** ສະກຸນເງິນຂອງແຖວ — ໃຊ້ຂອງທີ່ backend include ມາ, ບໍ່ມີກໍ່ຊອກຈາກລາຍການສະກຸນເງິນຕາມ currencyId */
  const currencyOf = (item: AccountType) => {
    if (item.currency) return item.currency;
    const opt = (currencies as any[]).find((c) => Number(c.value) === Number(item.currencyId));
    return opt ? { name: String(opt.label), icon: opt.icon as string | undefined, laos: undefined as string | undefined } : null;
  };
  const classOf = (item: AccountType) => item.types ?? classes.find((c) => c._uuid === item.typeId);

  // ---- ກັ່ນຕອງ: ຄຳຄົ້ນ + ສະຖານະ ເປັນພື້ນ, ແລ້ວນັບ chip ຂອງແຕ່ລະມິຕິໂດຍບໍ່ນັບຕົວກັ່ນຕອງຂອງມິຕິນັ້ນເອງ ----
  const q = keyword.trim().toLowerCase();
  const base = rows.filter((r) =>
    (status === 'all' || (status === 'active') === isActive(r))
    && (!q || `${r.treasury_code ?? ''} ${r.treasury_name ?? ''} ${r.description ?? ''}`.toLowerCase().includes(q))
  );
  const byCurrency = base.filter((r) => currencyId == null || Number(r.currencyId) === currencyId);
  const byClass = base.filter((r) => typeId == null || r.typeId === typeId);
  const shown = byCurrency.filter((r) => typeId == null || r.typeId === typeId);

  const classCounts = countBy(byCurrency, 'typeId');
  const currencyCounts = countBy(byClass, 'currencyId');
  const allCurrencyCounts = countBy(rows, 'currencyId');
  /** ສະແດງສະເພາະສະກຸນເງິນທີ່ມີປະເພດບັນຊີໃຊ້ຢູ່ (ແລະ ອັນທີ່ກຳລັງເລືອກ) — ບໍ່ໃຫ້ chip ຫວ່າງລົ້ນແຖວ */
  const currencyChips = (currencies as any[]).filter((c) => allCurrencyCounts[Number(c.value)] || Number(c.value) === currencyId);

  const activeCount = rows.filter(isActive).length;
  const usedClassCount = Object.keys(countBy(rows, 'typeId')).length;
  const hasFilter = !!q || typeId != null || currencyId != null || status !== 'all';
  const clearFilters = () => {
    setKeyword('');
    setTypeId(null);
    setCurrencyId(null);
    setStatus('all');
  };

  /** ຈັດກຸ່ມຕາມໝວດ — ລຽງຕາມລະຫັດໝວດ */
  const groups = useMemo(() => {
    const map = new Map<number, { cls?: AccountClass; items: AccountType[] }>();
    shown.forEach((r) => {
      const g = map.get(r.typeId) ?? { cls: classOf(r), items: [] };
      g.items.push(r);
      map.set(r.typeId, g);
    });
    return [...map.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => String(a.cls?.type_code ?? '').localeCompare(String(b.cls?.type_code ?? '')));
  }, [shown, classes]);

  /** ລຶບປະເພດບັນຊີ — backend ປະຕິເສດ (400) ຖ້າຍັງມີບັນຊີເງິນຄັງໃຊ້ປະເພດນີ້ຢູ່ ແລະ ສົ່ງເຫດຜົນມາສະແດງ */
  const remove = (item: AccountType) =>
    Notific.confirm(`${t('accountTypeDeleteConfirm')} (${item.treasury_code} · ${item.treasury_name})`, async () => {
      try {
        await deleteApi(`/type-treasury/${btoa(String(item._uuid))}`);
        Notific.success('acsDeleted');
        setEditing(undefined);
        fetchData();
      } catch (error) {
        console.error(error);
        Notific.error(getErrorMessage(error));
      }
    });

  const toggleGroup = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: rows.length },
    { key: 'active', label: t('active'), count: activeCount },
    { key: 'inactive', label: t('inactive'), count: rows.length - activeCount },
  ];

  return (
    <div className="acc-type">
      {/* ---- ຫົວໜ້າ: ສະຫຼຸບ + ປຸ່ມເພີ່ມ ---- */}
      <div className="acc-type-head">
        <div className="acc-type-kpis">
          <div className="acc-type-kpi">
            <i className="fa-solid fa-layer-group" />
            <span><small>{t('total')}</small><b>{rows.length}</b></span>
          </div>
          <div className="acc-type-kpi is-green">
            <i className="fa-solid fa-circle-check" />
            <span><small>{t('active')}</small><b>{activeCount}</b></span>
          </div>
          <div className="acc-type-kpi is-violet">
            <i className="fa-solid fa-sitemap" />
            <span><small>{t('accountSetAccountClass')}</small><b>{usedClassCount}</b></span>
          </div>
        </div>
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setEditing(null)}>
          <i className="fa-solid fa-plus" /> {t('accountTypeAdd')}
        </button>
      </div>

      {/* ---- ແຜງກັ່ນຕອງ ---- */}
      <div className="acc-type-filters">
        <div className="acc-type-filter-top">
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

        <div className="acc-type-filter-row">
          <span className="acc-type-filter-label"><i className="fa-solid fa-sitemap" /> {t('accountSetAccountClass')}</span>
          <div className="acc-type-chips">
            <button type="button" className={`acc-type-chip${typeId == null ? ' is-active' : ''}`} onClick={() => setTypeId(null)}>
              {t('all')} <em>{byCurrency.length}</em>
            </button>
            {classes.map((c) => (
              <button key={c._uuid} type="button"
                className={`acc-type-chip acc-tone ${toneOf(c.type_code)}${typeId === c._uuid ? ' is-active' : ''}${classCounts[c._uuid] ? '' : ' is-empty'}`}
                onClick={() => setTypeId(typeId === c._uuid ? null : c._uuid)}
                title={`${c.type_code} · ${c.type_name}`}
              >
                <i className="acc-type-dot" /> <b>{c.type_code}</b> {c.type_name} <em>{classCounts[c._uuid] ?? 0}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="acc-type-filter-row">
          <span className="acc-type-filter-label"><i className="fa-solid fa-coins" /> {t('accountTypeCurrency')}</span>
          <div className="acc-type-chips">
            <button type="button" className={`acc-type-chip${currencyId == null ? ' is-active' : ''}`} onClick={() => setCurrencyId(null)}>
              {t('all')} <em>{byClass.length}</em>
            </button>
            {currencyChips.map((c) => {
              const id = Number(c.value);
              return (
                <button key={id} type="button"
                  className={`acc-type-chip${currencyId === id ? ' is-active' : ''}${currencyCounts[id] ? '' : ' is-empty'}`}
                  onClick={() => setCurrencyId(currencyId === id ? null : id)}
                >
                  {c.icon && <span className="acc-type-cur-icon">{c.icon}</span>} {c.label} <em>{currencyCounts[id] ?? 0}</em>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- ລາຍການ ---- */}
      {isLoading ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : groups.length ? (
        groups.map(({ id, cls, items }) => {
          const open = !collapsed.has(id);
          return (
            <section key={id} className={`acc-type-group acc-tone ${toneOf(cls?.type_code ?? '')}`}>
              <button type="button" className="acc-type-group-head" aria-expanded={open} onClick={() => toggleGroup(id)}>
                <span className="acc-type-group-code">{cls?.type_code ?? '—'}</span>
                <span className="acc-type-group-name">{cls?.type_name ?? t('notSpecified')}</span>
                <span className="acc-type-group-count">{items.length}</span>
                <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ms-auto`} />
              </button>

              {open && (
                <div className="acc-type-grid">
                  {items.map((item) => {
                    const active = isActive(item);
                    const cur = currencyOf(item);
                    return (
                      <article key={item._uuid} className={`acc-type-card${active ? '' : ' is-off'}`}>
                        <div className="acc-type-card-top">
                          <span className="acc-type-card-code">{item.treasury_code}</span>
                          <span className={`acc-class-status${active ? ' is-active' : ''}`}>
                            <i className="fa-solid fa-circle" /> {active ? t('active') : t('inactive')}
                          </span>
                          <button type="button" className="acc-type-card-edit" disabled={!canEdit}
                            aria-label={t('edit')} title={t('edit')}
                            onClick={() => setEditing(item)}
                          >
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button type="button" className="acc-type-card-edit is-danger" disabled={!canDelete}
                            aria-label={t('delete')} title={t('delete')}
                            onClick={() => remove(item)}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>

                        <h4 title={item.treasury_name}>{item.treasury_name}</h4>
                        <p className="acc-type-card-desc" title={item.description}>{item.description || '—'}</p>

                        <div className="acc-type-card-info">
                          <div>
                            <small><i className="fa-solid fa-sitemap" /> {t('accountSetAccountClass')}</small>
                            {cls ? <b title={cls.type_name}>{cls.type_code} · {cls.type_name}</b> : <em>{t('notSpecified')}</em>}
                          </div>
                          <div>
                            <small><i className="fa-solid fa-coins" /> {t('accountTypeCurrency')}</small>
                            {cur ? <b>{cur.icon} {cur.name}{cur.laos ? ` · ${cur.laos}` : ''}</b> : <em>{t('notSpecified')}</em>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      ) : (
        <div className="acc-class-empty">
          <i className={`fa-solid ${hasFilter ? 'fa-filter-circle-xmark' : 'fa-layer-group'}`} />
          <p>{hasFilter ? t('accountTypeNoMatch') : t('noData')}</p>
          {hasFilter && (
            <button type="button" className="acc-type-clear mt-2" onClick={clearFilters}>
              {t('accountTypeClearFilter')}
            </button>
          )}
        </div>
      )}

      {editing !== undefined && (
        <AccountTypeForm
          data={editing}
          classes={classes}
          currencies={currencies as any}
          usedCodes={rows.map((r) => String(r.treasury_code))}
          onClose={() => setEditing(undefined)}
          onSaved={fetchData}
          onDelete={editing ? () => remove(editing) : undefined}
        />
      )}
    </div>
  );
};

export default AccountTypePage;
