import { useMemo, useState } from 'react';
import { Input, InputGroup, Loader, Toggle } from 'rsuite';
import AppPage from '../../../components/Elements/AppPage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { GROUPS, defaultLedgerRange, groupOf, money, naturalOf, type ChartAccount } from './glApi';
import { AccountCode, GlNotReady, useChartAccounts } from './glKit';
import { AccountLedgerView } from './AccountLedgerModal';

const hasLines = (a: ChartAccount) => Number(a.lines) > 0;

/**
 * ປຶ້ມບັນຊີໃຫຍ່ (ໜ້າຕ່າງ generalLedger ໃນ Shell.tsx) — ຊ້າຍ: ບັນຊີລົງລາຍການໄດ້ທັງໝົດໃນຜັງບັນຊີ ຈັດຕາມກຸ່ມ
 * ພ້ອມຍອດສະສົມ (GET /chart-account/fetch); ຂວາ: ປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີທີ່ເລືອກ (POST /gl/ledger).
 * ຊ່ວງວັນທີຄົງໄວ້ຕອນປ່ຽນບັນຊີ — ທຽບຫຼາຍບັນຊີໃນຊ່ວງດຽວກັນໄດ້
 */
const GeneralLedgerPage = () => {
  const t = useT();
  const lf = useLangField();
  const { rows, loading, notReady } = useChartAccounts();
  const [keyword, setKeyword] = useState('');
  /** null = ຍັງບໍ່ໄດ້ເລືອກເອງ (ຕາມຄ່າຕັ້ງຕົ້ນ: ເປີດຖ້າມີບັນຊີທີ່ມີລາຍການ) */
  const [activeOnlyPick, setActiveOnly] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dates, setDates] = useState<[Date, Date]>(defaultLedgerRange);

  const postable = useMemo(
    () => rows
      .filter((a) => Number(a.is_postable) === 1 && Number(a.status) === 1)
      .sort((a, b) => String(a.account_code).localeCompare(String(b.account_code), undefined, { numeric: true })),
    [rows],
  );
  const anyLines = postable.some(hasLines);
  const activeOnly = activeOnlyPick ?? anyLines;

  const q = keyword.trim().toLowerCase();
  const shown = postable.filter((a) =>
    (!activeOnly || hasLines(a))
    && (!q || `${a.account_code} ${a.name_la} ${a.name_en ?? ''} ${a.name_cn ?? ''}`.toLowerCase().includes(q)));

  // ບໍ່ໄດ້ເລືອກ → ບັນຊີທຳອິດທີ່ມີລາຍການ (ຫຼື ບັນຊີທຳອິດ)
  const selected = postable.find((a) => a._uuid === selectedId) ?? postable.find(hasLines) ?? postable[0];
  const side = Number(selected?.normal_side);

  if (notReady) {
    return <AppPage title={t('accountAppGeneralLedger')} showHeader={false}><GlNotReady /></AppPage>;
  }

  return (
    <AppPage title={t('accountAppGeneralLedger')} subtitle={t('accountAppGeneralLedger')} showHeader={false}>
      <div className="acc-gl acc-gl-book">
        {/* ---- ຊ້າຍ: ເລືອກບັນຊີ ---- */}
        <aside className="acc-gl-book-list">
          <InputGroup inside className="acc-type-search">
            <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
            <Input placeholder={t('glSearchAccount')} value={keyword} onChange={setKeyword} />
            {keyword && (
              <InputGroup.Button onClick={() => setKeyword('')} aria-label={t('cancel')}>
                <i className="fa-solid fa-xmark" />
              </InputGroup.Button>
            )}
          </InputGroup>
          <label className="acc-gl-book-filter">
            <Toggle size="sm" checked={activeOnly} onChange={setActiveOnly} />
            <span>{t('glBookActiveOnly')}</span>
          </label>

          {loading && !rows.length ? (
            <div className="text-center py-4"><Loader content={t('loadingDots')} vertical /></div>
          ) : !shown.length ? (
            <p className="acc-gl-book-none">{t('glBookNoMatch')}</p>
          ) : (
            GROUPS.map((g) => {
              const list = shown.filter((a) => Number(a.account_group) === g.value);
              if (!list.length) return null;
              return (
                <section key={g.value} className="acc-gl-book-group">
                  <h6><i className={`fa-solid ${g.icon}`} /> {g.value} · {t(g.label)} <small>{list.length}</small></h6>
                  {list.map((a) => {
                    const balance = naturalOf(Number(a.normal_side), (Number(a.debit) || 0) - (Number(a.credit) || 0));
                    return (
                      <button key={a._uuid} type="button" aria-pressed={a._uuid === selected?._uuid}
                        className={`acc-gl-book-item${a._uuid === selected?._uuid ? ' is-active' : ''}`}
                        onClick={() => setSelectedId(a._uuid)}
                      >
                        <AccountCode code={a.account_code} group={a.account_group} />
                        <span className="acc-gl-book-name">{lf(a, 'name')}</span>
                        <b className={balance < 0 ? 'is-negative' : ''}>{money(balance)}</b>
                      </button>
                    );
                  })}
                </section>
              );
            })
          )}
        </aside>

        {/* ---- ຂວາ: ປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີທີ່ເລືອກ ---- */}
        <section className="acc-gl-book-main">
          {selected ? (
            <>
              <header className="acc-gl-ledger-head acc-gl-book-head">
                <AccountCode code={selected.account_code} group={selected.account_group} />
                <span>
                  <h3>{lf(selected, 'name')}</h3>
                  <small>{t(groupOf(selected.account_group).label)} · {t(side === 1 ? 'glSideDebit' : 'glSideCredit')} · LAK</small>
                </span>
              </header>
              <AccountLedgerView account={selected} dates={dates} onDates={setDates} />
            </>
          ) : !loading && (
            <div className="acc-class-empty"><i className="fa-solid fa-book" /><p>{t('glBookPick')}</p></div>
          )}
        </section>
      </div>
    </AppPage>
  );
};

export default GeneralLedgerPage;
